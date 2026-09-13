import { useEffect, useMemo, useRef, useState } from 'react';
import {
  bytes32FromHex,
  createDisclosureDigest,
  createSessionKey,
  decryptReport,
  encryptReport,
  encryptedBytes,
  exportSessionKey,
  importSessionKey
} from './crypto';
import {
  acceptReport,
  claimPayout,
  clearState,
  disclose,
  loadState,
  rejectReport,
  saveState,
  submitReport
} from './demoLedger';
import type { DemoState, ReportDraft, Role, Severity } from './types';
import { deploymentStageLabels, type DeploymentStage } from './deploymentProgress';
import {
  createQuietPatchProviders,
  deployQuietPatchContract,
  archiveInaccessibleQuietPatchContractAddress,
  rememberQuietPatchContractAddress,
  findQuietPatchContract,
  initializeQuietPatchBounty,
  configuredQuietPatchContractAddress,
  type QuietPatchContractClient,
  type QuietPatchPublicState,
  type QuietPatchProviders,
  type QuietPatchTransaction,
  SavedContractPrivateStateError
} from './midnightClient';
import {
  connectMidnightWallet,
  DEFAULT_NETWORK_ID,
  getDustBalanceWhenReady,
  userFacingMidnightError,
  withTimeout,
  type WalletConnection
} from './wallet';
import type { DustBalance } from './wallet';

type WalletConnectionStage = 'idle' | 'waiting-for-wallet' | 'preparing';
const REPORT_SESSION_KEY = 'quietpatch:report-session-key';

const emptyDraft: ReportDraft = {
  title: '',
  component: 'quietpatch-demo-contract',
  affectedVersion: '0.1.0',
  severity: 4,
  summary: '',
  reproduction: '',
  impact: '',
  suggestedFix: ''
};

const roleCopy: Record<Role, { label: string; note: string }> = {
  observer: { label: 'Observer', note: 'Read the public record' },
  researcher: { label: 'Researcher', note: 'Submit private evidence' },
  maintainer: { label: 'Maintainer', note: 'Review and settle' }
};

function shortHash(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}

function shortAddress(value: string): string {
  return value.length > 16 ? `${value.slice(0, 7)}…${value.slice(-6)}` : value;
}

const TDUST_BASE_UNITS = 1_000_000_000_000_000n;

function formatTDust(value: bigint): string {
  const whole = value / TDUST_BASE_UNITS;
  const hundredths = (value % TDUST_BASE_UNITS) * 100n / TDUST_BASE_UNITS;
  const wholeText = whole.toLocaleString();

  return hundredths === 0n
    ? wholeText
    : `${wholeText}.${hundredths.toString().padStart(2, '0')}`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  );
}

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${status.toLowerCase()}`}>{statusLabel(status)}</span>;
}

function App() {
  const [role, setRole] = useState<Role>('observer');
  const [state, setState] = useState<DemoState>(() => loadState());
  const [draft, setDraft] = useState<ReportDraft>(emptyDraft);
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [reviewDraft, setReviewDraft] = useState<ReportDraft | null>(null);
  const [disclosureText, setDisclosureText] = useState('');
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [dustBalance, setDustBalance] = useState<DustBalance | null>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletConnectionStage, setWalletConnectionStage] = useState<WalletConnectionStage>('idle');
  const walletAttempt = useRef(0);
  const [inaccessibleContractAddress, setInaccessibleContractAddress] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [contractDeploying, setContractDeploying] = useState(false);
  const deploymentBusy = useRef(false);
  const [deploymentProgress, setDeploymentProgress] = useState<string | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [bountyInitializing, setBountyInitializing] = useState(false);
  const [bountyInitialized, setBountyInitialized] = useState(false);
  const [midnightProviders, setMidnightProviders] = useState<QuietPatchProviders | null>(null);
  const [midnightClient, setMidnightClient] = useState<QuietPatchContractClient | null>(null);
  const [chainRefreshing, setChainRefreshing] = useState(false);
  const contractBackedMode = Boolean(midnightClient || configuredQuietPatchContractAddress());

  useEffect(() => saveState(state), [state]);

  useEffect(() => {
    let cancelled = false;
    if (!wallet) {
      setDustBalance(null);
      return;
    }
    void getDustBalanceWhenReady(wallet.connected)
      .then((dust) => {
        if (!cancelled) setDustBalance(dust);
      })
      .catch(() => {
        if (!cancelled) setDustBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  useEffect(() => {
    const serialized = sessionStorage.getItem(REPORT_SESSION_KEY);
    if (!serialized) return;
    void importSessionKey(serialized)
      .then(setSessionKey)
      .catch(() => sessionStorage.removeItem(REPORT_SESSION_KEY));
  }, []);

  const report = state.report;
  const daysLeft = useMemo(() => {
    const hours = Math.max(0, Math.round((new Date(state.bounty.deadline).getTime() - Date.now()) / 3_600_000));
    return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
  }, [state.bounty.deadline]);
  const localDemoExpired = !wallet && new Date(state.bounty.deadline).getTime() <= Date.now();

  function show(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4200);
  }

  function applyPublicChainState(publicState: QuietPatchPublicState, contractAddress?: string) {
    const hasBounty = publicState.bountyStatus !== 'NONE';
    const hasReport = publicState.reportStatus !== 'NONE';
    const minimumSeverity = Math.max(1, Math.min(5, Number(publicState.minimumSeverity))) as Severity;

    setState((current) => {
      const bounty = hasBounty
        ? {
            ...current.bounty,
            minimumSeverity,
            rewardAmount: Number(publicState.rewardAmount),
            deadline: new Date(Number(publicState.submissionDeadline) * 1000).toISOString()
          }
        : current.bounty;

      if (!hasReport) return { ...current, bounty, report: null, bundle: null };

      const reportIsPaid = publicState.reportStatus === 'PAID' || publicState.reportStatus === 'DISCLOSED';
      const reportIsDisclosed = publicState.reportStatus === 'DISCLOSED';

      return {
        ...current,
        bounty,
        report: {
          ...(current.report ?? {
            id: 'QP-RPT-001',
            reportDigest: '',
            submittedAt: new Date().toISOString()
          }),
          commitment: publicState.reportCommitment,
          status: publicState.reportStatus,
          severityPass: publicState.reportSeverityPass,
          payoutClaimedAt: reportIsPaid ? current.report?.payoutClaimedAt ?? new Date().toISOString() : undefined,
          disclosureSummary: reportIsDisclosed ? current.report?.disclosureSummary : undefined,
          disclosureDigest: reportIsDisclosed ? current.report?.disclosureDigest : undefined
        }
      };
    });
    setBountyInitialized(hasBounty);
    if (contractAddress && hasBounty) {
      localStorage.setItem(bountyMarker(contractAddress), 'true');
    }
  }

  async function handleChainRefresh() {
    if (!midnightClient) return;
    setChainRefreshing(true);
    try {
      const publicState = await withTimeout(
        midnightClient.readPublicState(),
        'The chain state could not be refreshed. Check the indexer connection and try again.'
      );
      applyPublicChainState(publicState, midnightClient.contractAddress);
      show('success', 'Public ledger state refreshed from Midnight.');
    } catch (error) {
      show('error', userFacingMidnightError(error, 'The chain state could not be refreshed.'));
    } finally {
      setChainRefreshing(false);
    }
  }

  function bountyMarker(address: string): string {
    return `quietpatch:bounty-initialized:${address}`;
  }

  function currentBountyConfig() {
    const configuredDeadline = new Date(state.bounty.deadline).getTime();
    const minimumDeadline = Date.now() + 1000 * 60 * 60 * 72;
    const deadlineMs = Math.max(configuredDeadline, minimumDeadline);

    return {
      id: state.bounty.id,
      minimumSeverity: BigInt(state.bounty.minimumSeverity),
      rewardAmount: BigInt(state.bounty.rewardAmount),
      submissionDeadline: BigInt(Math.floor(deadlineMs / 1000))
    };
  }

  async function restoreReportSessionKey(): Promise<CryptoKey | null> {
    if (sessionKey) return sessionKey;

    const serialized = sessionStorage.getItem(REPORT_SESSION_KEY);
    if (!serialized) return null;

    try {
      const restored = await importSessionKey(serialized);
      setSessionKey(restored);
      return restored;
    } catch {
      sessionStorage.removeItem(REPORT_SESSION_KEY);
      return null;
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reportSubmitting) return;
    if (contractBackedMode && !midnightClient) {
      show('error', 'This browser has a deployed Midnight contract. Connect the correct wallet before submitting; local simulation is disabled for this workflow.');
      return;
    }
    if (midnightClient && !bountyInitialized) {
      show('error', 'Initialize the bounty on Midnight before submitting a report.');
      return;
    }
    if (!draft.title.trim() || !draft.summary.trim() || !draft.reproduction.trim()) {
      show('error', 'Add a title, summary, and reproduction steps.');
      return;
    }
    setReportSubmitting(true);
    try {
      let key = await restoreReportSessionKey();
      if (!key) key = await createSessionKey();
      if (!sessionKey) setSessionKey(key);
      sessionStorage.setItem(REPORT_SESSION_KEY, await exportSessionKey(key));
      const encrypted = await encryptReport(draft, state.bounty, key);
      let chainTransaction: QuietPatchTransaction | undefined;
      if (midnightClient) {
        chainTransaction = await midnightClient.submitReport({
          commitment: bytes32FromHex(encrypted.commitment),
          reportDigest: bytes32FromHex(encrypted.reportDigest),
          reportNonce: encrypted.reportNonce,
          severity: BigInt(draft.severity)
        });
      }
      let apiReportId: string | undefined;
      try {
        const apiResponse = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8787'}/v1/reports`, {
          method: 'POST',
          headers: {
            'X-Demo-Role': 'researcher',
            'X-Bounty-Id': state.bounty.id,
            'X-Report-Commitment': encrypted.commitment,
            'Content-Type': 'application/octet-stream'
          },
          body: new Blob([encryptedBytes(encrypted.ciphertext) as unknown as ArrayBuffer], {
            type: 'application/octet-stream'
          })
        });
        if (apiResponse.ok) {
          apiReportId = (await apiResponse.json() as { reportId?: string }).reportId;
        }
      } catch {
        // The browser demo can run without the optional bundle service.
      }
      const next = submitReport(
        state,
        { ...encrypted, severity: draft.severity, submittedAt: new Date().toISOString() },
        {
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          reportDigest: encrypted.reportDigest,
          commitment: encrypted.commitment,
          apiReportId,
          submittedAt: new Date().toISOString()
        }
      );
      setState(next);
      show(
        'success',
        chainTransaction
          ? `Encrypted report submitted on Midnight. Transaction ${shortHash(chainTransaction.txId)}.`
          : 'Encrypted report submitted. The public record contains only its commitment.'
      );
      setRole('observer');
    } catch (error) {
      show('error', error instanceof Error ? error.message : 'The report could not be submitted.');
    } finally {
      setReportSubmitting(false);
    }
  }

  async function handleReview() {
    const key = await restoreReportSessionKey();
    if (!state.bundle || !key) {
      show('error', 'This browser session no longer has the maintainer decryption key. Reset and submit a new demo report.');
      return;
    }
    try {
      setReviewDraft(await decryptReport(state.bundle, key));
      show('success', 'The bundle decrypted locally. The API never receives this plaintext.');
    } catch {
      show('error', 'The bundle could not be decrypted or its authentication tag failed.');
    }
  }

  function resetDemo() {
    if (contractBackedMode) {
      // A deployed contract cannot be reset from the browser. Keep its saved
      // address and the current chain view; only discard the local draft and
      // decrypted report session.
      setDraft(emptyDraft);
      setReviewDraft(null);
      setSessionKey(null);
      sessionStorage.removeItem(REPORT_SESSION_KEY);
      setDisclosureText('');
      show('success', 'The local draft was reset. The deployed contract and its on-chain history were kept.');
      return;
    }

    clearState();
    setState(loadState());
    setDraft(emptyDraft);
    setReviewDraft(null);
    setSessionKey(null);
    setMidnightProviders(null);
    setMidnightClient(null);
    setBountyInitialized(false);
    sessionStorage.removeItem(REPORT_SESSION_KEY);
    setDisclosureText('');
    setNotice(null);
  }

  async function handleWalletConnect() {
    const attempt = walletAttempt.current + 1;
    walletAttempt.current = attempt;
    const isCurrentAttempt = () => walletAttempt.current === attempt;
    // Start Lace before any state update or asynchronous setup so the browser
    // still treats the connector call as part of the user's click.
    const connectionPromise = connectMidnightWallet();

    setWalletConnecting(true);
    setWalletConnectionStage('waiting-for-wallet');
    setInaccessibleContractAddress(null);
    try {
      const connection = await connectionPromise;
      if (!isCurrentAttempt()) return;
      setWalletConnectionStage('preparing');
      const setup = (async () => {
        const providers = await createQuietPatchProviders(connection);
        try {
          const contract = await findQuietPatchContract(providers);
          const publicState = contract ? await contract.readPublicState() : null;
          return { providers, contract, publicState, inaccessibleAddress: null };
        } catch (error) {
          if (!(error instanceof SavedContractPrivateStateError)) throw error;
          archiveInaccessibleQuietPatchContractAddress(error.contractAddress);
          return {
            providers,
            contract: null,
            publicState: null,
            inaccessibleAddress: error.contractAddress
          };
        }
      })();
      const { providers, contract, publicState, inaccessibleAddress } = await withTimeout(
        setup,
        'Wallet connected, but Midnight setup did not finish. Check Lace sync and the proof server, then refresh and try again.'
      );
      if (!isCurrentAttempt()) return;
      setWallet(connection);
      setMidnightProviders(providers);
      setMidnightClient(contract);
      setInaccessibleContractAddress(inaccessibleAddress);
      if (publicState) applyPublicChainState(publicState, contract?.contractAddress);
      else setBountyInitialized(false);
      show(
        inaccessibleAddress ? 'error' : 'success',
        inaccessibleAddress
          ? `The old contract ${shortHash(inaccessibleAddress)} was preserved, but its browser decryption key is unavailable. QuietPatch is ready for a fresh deployment when Lace has enough tDUST.`
          : contract
          ? `${connection.initial.name} connected; contract ${shortHash(contract.contractAddress)} is ready.`
          : `${connection.initial.name} connected on ${connection.networkId}; contract providers are ready.`
      );
    } catch (error) {
      if (isCurrentAttempt()) {
        show('error', userFacingMidnightError(error, 'The wallet could not be connected.'));
      }
    } finally {
      if (isCurrentAttempt()) {
        setWalletConnecting(false);
        setWalletConnectionStage('idle');
      }
    }
  }

  function handleWalletConnectCancel() {
    walletAttempt.current += 1;
    setWalletConnecting(false);
    setWalletConnectionStage('idle');
    show('success', 'Wallet connection cancelled. You can retry after opening Lace.');
  }

  function handleWalletDisconnect() {
    walletAttempt.current += 1;
    setWallet(null);
    setMidnightProviders(null);
    setMidnightClient(null);
    setInaccessibleContractAddress(null);
    setBountyInitialized(false);
    setWalletConnectionStage('idle');
    show('success', 'Wallet disconnected from this browser session.');
  }

  async function handleContractDeploy() {
    if (deploymentBusy.current) return;
    const connectedWallet = wallet;
    if (!midnightProviders || !connectedWallet) {
      show('error', 'Connect a Midnight wallet before deploying the contract.');
      return;
    }
    deploymentBusy.current = true;
    setContractDeploying(true);
    setDeploymentError(null);
    let stage: DeploymentStage | 'balance-read' = 'balance-read';
    let dustAtStart: DustBalance | null = null;
    setDeploymentProgress('Reading tDUST balance from Lace');
    try {
      let dust: DustBalance | null = null;
      const registrationChecks = 12;
      for (let check = 1; check <= registrationChecks; check += 1) {
        dust = await getDustBalanceWhenReady(connectedWallet.connected);
        dustAtStart = dust;
        setDustBalance(dust);
        if (dust.cap > 0n && dust.balance > 0n) break;
        if (check < registrationChecks) {
          setDeploymentProgress(
            dust.cap > 0n
              ? `Waiting for spendable tDUST to accrue (${check}/${registrationChecks})`
              : `Waiting for Lace to confirm tDUST registration (${check}/${registrationChecks})`
          );
          await new Promise<void>((resolve) => window.setTimeout(resolve, 5_000));
        }
      }
      if (!dust) throw new Error('Lace did not return a tDUST balance.');
      if (dust.balance <= 0n) {
        throw new Error(
          dust.cap > 0n
            ? 'This account has tDUST capacity but no spendable tDUST yet. Keep Lace unlocked on Undeployed and wait for the balance to grow.'
            : `Lace reports no registered tDUST for ${connectedWallet.unshieldedAddress}. The Generate tDUST transaction has not reached this account yet, or Lace is on a different account.`
        );
      }
      const client = await deployQuietPatchContract(midnightProviders, (nextStage) => {
        stage = nextStage;
        setDeploymentProgress(deploymentStageLabels[nextStage]);
      });
      setMidnightClient(client);
      setInaccessibleContractAddress(null);
      setBountyInitialized(false);
      rememberQuietPatchContractAddress(client.contractAddress);
      localStorage.removeItem(bountyMarker(client.contractAddress));
      setDeploymentProgress(null);
      show('success', `Contract deployed at ${shortHash(client.contractAddress)}. The address is saved in this browser. Click Initialize bounty for the next Lace transaction.`);
    } catch (error) {
      const lastStage = stage as DeploymentStage | 'balance-read';
      const stageLabel = lastStage === 'balance-read' ? 'Reading tDUST balance' : deploymentStageLabels[lastStage];
      const reason = userFacingMidnightError(error, 'No readable reason was returned.');
      const dustContext = lastStage === 'balance' && dustAtStart
        ? ` Lace reported ${formatTDust(dustAtStart.balance)} of ${formatTDust(dustAtStart.cap)} tDUST before balancing.`
        : '';
      const recovery = lastStage === 'submit' || lastStage === 'confirm' || lastStage === 'save'
        ? ' The transaction may already have been submitted. Check its status before deploying again.'
        : '';
      setDeploymentError(`${stageLabel}: ${reason}${dustContext}${recovery}`);
      setDeploymentProgress(null);
    } finally {
      deploymentBusy.current = false;
      setContractDeploying(false);
    }
  }

  async function handleBountyInitialize() {
    if (!midnightClient) {
      show('error', 'Connect to the deployed contract before initializing the bounty.');
      return;
    }
    setBountyInitializing(true);
    try {
      const bountyConfig = currentBountyConfig();
      const transaction = await initializeQuietPatchBounty(midnightClient, bountyConfig);
      const freshDeadline = new Date(Number(bountyConfig.submissionDeadline) * 1000).toISOString();
      setState((current) => ({
        ...current,
        bounty: { ...current.bounty, deadline: freshDeadline }
      }));
      setBountyInitialized(true);
      localStorage.setItem(bountyMarker(midnightClient.contractAddress), 'true');
      show('success', `Bounty initialized on Midnight. Transaction ${shortHash(transaction.txId)}.`);
    } catch (error) {
      show('error', userFacingMidnightError(error, 'The bounty could not be initialized.'));
    } finally {
      setBountyInitializing(false);
    }
  }

  async function transitionWithChain(
    action: (current: DemoState) => DemoState,
    chainAction: (() => Promise<QuietPatchTransaction>) | undefined,
    success: string
  ) {
    if (contractBackedMode && !midnightClient) {
      show('error', 'This browser has a deployed Midnight contract. Connect the correct wallet before changing its workflow; local simulation is disabled.');
      return;
    }
    try {
      const next = action(state);
      const transaction = chainAction ? await chainAction() : undefined;
      setState(next);
      show('success', transaction ? `${success} Transaction ${shortHash(transaction.txId)}.` : success);
    } catch (error) {
      show('error', userFacingMidnightError(error, 'The action failed.'));
    }
  }

  async function handleDisclosure() {
    if (contractBackedMode && !midnightClient) {
      show('error', 'This browser has a deployed Midnight contract. Connect the correct wallet before publishing a disclosure; local simulation is disabled.');
      return;
    }
    const digest = disclosureText.trim() ? await createDisclosureDigest(disclosureText) : undefined;
    await transitionWithChain(
      (current) => disclose(current, disclosureText),
      digest && midnightClient ? () => midnightClient.publishDisclosure(digest) : undefined,
      'Safe disclosure published to the public record.'
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div>
            <div className="brand-name">QuietPatch</div>
            <div className="brand-subtitle">Private disclosure protocol</div>
          </div>
        </div>
        <div className="topbar-actions">
          <span className={`network-chip ${wallet ? 'network-chip-connected' : ''}`} title={wallet ? `Funding address: ${wallet.unshieldedAddress}` : undefined}><span className="pulse-dot" /> {wallet ? `${wallet.initial.name} · ${wallet.networkId}${dustBalance ? ` · ${formatTDust(dustBalance.balance)}/${formatTDust(dustBalance.cap)} tDUST` : ''}` : `${DEFAULT_NETWORK_ID} · local adapter`}</span>
          {wallet && !midnightClient && <button className="text-button wallet-button" onClick={handleContractDeploy} disabled={contractDeploying}>{contractDeploying ? 'Deploying…' : 'Deploy contract'}</button>}
          {wallet && midnightClient && !bountyInitialized && <button className="text-button wallet-button" onClick={handleBountyInitialize} disabled={bountyInitializing}>{bountyInitializing ? 'Initializing…' : 'Initialize bounty'}</button>}
          {wallet && midnightClient && bountyInitialized && <button className="text-button wallet-button" onClick={handleChainRefresh} disabled={chainRefreshing}>{chainRefreshing ? 'Refreshing…' : 'Refresh chain'}</button>}
          <button className="text-button wallet-button" onClick={wallet ? handleWalletDisconnect : handleWalletConnect} disabled={walletConnecting || contractDeploying}>
            {wallet ? shortAddress(wallet.shieldedAddress) : walletConnecting ? (walletConnectionStage === 'preparing' ? 'Preparing…' : 'Waiting for Lace…') : 'Connect wallet'}
          </button>
          <button className="text-button" onClick={resetDemo} disabled={contractDeploying}>Reset local demo</button>
        </div>
      </header>
      {(deploymentProgress || deploymentError) && <div className="wallet-connection-banner" role={deploymentError ? 'alert' : 'status'} aria-live="polite">
        <div><strong>{deploymentError ? 'Deployment needs attention' : 'Deployment in progress'}</strong><span>{deploymentError ?? deploymentProgress}</span></div>
      </div>}
      {inaccessibleContractAddress && !deploymentProgress && !deploymentError && <div className="wallet-connection-banner" role="status" aria-live="polite">
        <div><strong>Old contract preserved</strong><span>{shortHash(inaccessibleContractAddress)} is still saved, but this browser cannot decrypt its private state. No reset or redeploy was performed. A fresh deployment needs more tDUST in Lace.</span></div>
      </div>}
      {localDemoExpired && <div className="wallet-connection-banner" role="status" aria-live="polite">
        <div><strong>Local demo expired</strong><span>This is cached synthetic state from an earlier run. Select Reset local demo to create a fresh 72-hour bounty; no wallet or chain data will be changed.</span></div>
      </div>}
      {walletConnecting && <div className="wallet-connection-banner" role="status" aria-live="polite">
        <span className="wallet-connection-dot" />
        <div>
          <strong>{walletConnectionStage === 'preparing' ? 'Lace approved — preparing Midnight' : 'Waiting for Lace approval'}</strong>
          <span>{walletConnectionStage === 'preparing'
            ? `Loading the ${DEFAULT_NETWORK_ID} configuration and contract state.`
            : `Unlock Lace, select ${DEFAULT_NETWORK_ID}, and approve QuietPatch. If no popup appears, open the Lace extension from Chrome’s toolbar.`}</span>
        </div>
        <button className="text-button" onClick={handleWalletConnectCancel}>Cancel</button>
      </div>}

      <main className="page-wrap">
        <section className="hero-row">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> MIDNIGHT / WAVE 1 PROTOTYPE</div>
            <h1>Fix the bug before<br /><em>you reveal the bug.</em></h1>
            <p className="hero-copy">QuietPatch gives researchers a private path to report vulnerabilities and gives maintainers a public record they can trust.</p>
          </div>
          <div className="hero-stat">
            <div className="stat-label">TEST PAYOUT AMOUNT</div>
            <div className="stat-value">{state.bounty.rewardAmount} <span>tNIGHT</span></div>
            <div className="stat-meta">{localDemoExpired ? 'reset for a fresh demo' : daysLeft} <span className="meta-separator">/</span> minimum severity {state.bounty.minimumSeverity}</div>
          </div>
        </section>

        <div className="role-bar">
          <div className="role-tabs" role="tablist" aria-label="Demo role">
            {(Object.keys(roleCopy) as Role[]).map((item) => (
              <button key={item} className={`role-tab ${role === item ? 'active' : ''}`} onClick={() => setRole(item)} role="tab" aria-selected={role === item}>
                <span className="role-number">0{Object.keys(roleCopy).indexOf(item) + 1}</span>
                <span><strong>{roleCopy[item].label}</strong><small>{roleCopy[item].note}</small></span>
              </button>
            ))}
          </div>
          <div className="role-hint">Switch roles to walk the full disclosure flow</div>
        </div>

        <div className="workspace-grid">
          <section className="workspace-card main-card">
            {role === 'observer' && <ObserverView state={state} onReview={() => setRole('maintainer')} />}
            {role === 'researcher' && <ResearcherView draft={draft} setDraft={setDraft} state={state} onSubmit={handleSubmit} submitting={reportSubmitting} onChain={contractBackedMode} blockedByWallet={Boolean(contractBackedMode && !midnightClient)} />}
            {role === 'maintainer' && <MaintainerView state={state} reviewDraft={reviewDraft} onReview={handleReview} onAccept={() => transitionWithChain(acceptReport, midnightClient?.acceptReport, 'Report accepted. The researcher can now record the payout claim.')} onReject={() => transitionWithChain(rejectReport, midnightClient?.rejectReport, 'Report rejected. No payout claim was created.')} blockedByWallet={Boolean(contractBackedMode && !midnightClient)} />}
          </section>
          <PublicRecord role={role} state={state} disclosureText={disclosureText} setDisclosureText={setDisclosureText} onClaim={() => transitionWithChain(claimPayout, midnightClient?.claimPayout, 'Payout authorization recorded in the ledger.')} onDisclose={handleDisclosure} onChain={contractBackedMode} blockedByWallet={Boolean(contractBackedMode && !midnightClient)} />
        </div>

        <section className="privacy-strip">
          <div className="strip-intro"><span className="strip-icon">◌</span><div><strong>The privacy boundary</strong><span>Plaintext stays in the browser. The ledger sees commitments and state.</span></div></div>
          <div className="strip-item"><span className="strip-check">✓</span><div><strong>Encrypted report</strong><span>AES-GCM before upload</span></div></div>
          <div className="strip-item"><span className="strip-check">✓</span><div><strong>Compact proof</strong><span>Threshold and binding checks</span></div></div>
          <div className="strip-item"><span className="strip-check">✓</span><div><strong>Public process</strong><span>Status without evidence</span></div></div>
        </section>
      </main>

      {notice && <div className={`notice notice-${notice.kind}`} role="status"><span>{notice.kind === 'success' ? '✓' : '!'}</span>{notice.text}</div>}
      <footer className="footer"><span>QUIETPATCH / PRIVATE DISCLOSURE</span><span>Built for Midnight</span></footer>
    </div>
  );
}

function ObserverView({ state, onReview }: { state: DemoState; onReview: () => void }) {
  const report = state.report;
  return (
    <div className="view-stack">
      <ViewHeader kicker="PUBLIC VIEW" title="What the network can see" description="This is the page a stranger can open. It proves that a report exists without publishing the report." />
      <div className="observer-banner"><span className="lock-symbol">⌁</span><div><strong>No report plaintext here.</strong><span>Try the maintainer view to see the same report after local decryption.</span></div><button className="button button-dark" onClick={onReview}>Open maintainer view <span>↗</span></button></div>
      <div className="record-table">
        <RecordRow label="Bounty" value={state.bounty.title} meta={state.bounty.component} />
        <RecordRow label="Deadline" value={formatTime(state.bounty.deadline)} meta={`Minimum severity ${state.bounty.minimumSeverity}`} />
        <RecordRow label="Report" value={report ? report.id : 'No report submitted'} meta={report ? `Submitted ${formatTime(report.submittedAt)}` : 'Waiting for a researcher'} right={report ? <StatusPill status={report.status} /> : <span className="status-pill status-open">Open</span>} />
        {report && <RecordRow label="Commitment" value={shortHash(report.commitment)} meta="Midnight persistent hash" mono />}
      </div>
      <div className="explain-box"><div className="explain-title">Why this matters</div><p>The public can follow the bounty, report status, acceptance, payout, and later disclosure. The exploit, reproduction steps, and raw severity stay out of the public record.</p></div>
    </div>
  );
}

function ResearcherView({ draft, setDraft, state, onSubmit, submitting, onChain, blockedByWallet }: { draft: ReportDraft; setDraft: React.Dispatch<React.SetStateAction<ReportDraft>>; state: DemoState; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; submitting: boolean; onChain: boolean; blockedByWallet: boolean }) {
  const set = (field: keyof ReportDraft, value: string | Severity) => setDraft((current) => ({ ...current, [field]: value }));
  return (
    <div className="view-stack">
      <ViewHeader kicker="RESEARCHER" title="Submit without exposing the exploit" description="Write the report here. The browser encrypts it before the bundle leaves this page." />
      {blockedByWallet && <div className="filled-state"><span className="filled-icon">!</span><div><strong>Network report submission is locked.</strong><span>This browser has a deployed contract. Connect the required Lace account; local simulation is disabled.</span></div></div>}
      {state.report ? <div className="filled-state"><span className="filled-icon">✓</span><div><strong>A report already exists for this demo bounty.</strong><span>Reset the demo to submit another synthetic report.</span></div></div> : <form onSubmit={onSubmit} className="report-form">
        <div className="form-grid two-col">
          <Field label="Report title" required><input value={draft.title} onChange={(event) => set('title', event.target.value)} placeholder="Example: stale proof accepted after revocation" /></Field>
          <Field label="Affected component"><input value={draft.component} onChange={(event) => set('component', event.target.value)} /></Field>
        </div>
        <div className="form-grid three-col">
          <Field label="Affected version"><input value={draft.affectedVersion} onChange={(event) => set('affectedVersion', event.target.value)} /></Field>
          <Field label="Private severity" note={`Bounty needs ${state.bounty.minimumSeverity}+`}><select value={draft.severity} onChange={(event) => set('severity', Number(event.target.value) as Severity)}>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} / 5</option>)}</select></Field>
          <div className="field-static"><span>Proof rule</span><strong>severity ≥ {state.bounty.minimumSeverity}</strong><small>Checked in the Compact circuit</small></div>
        </div>
        <Field label="Short summary" required><textarea value={draft.summary} onChange={(event) => set('summary', event.target.value)} placeholder="What goes wrong? Keep this readable for a maintainer." rows={3} /></Field>
        <Field label="Reproduction steps" required><textarea value={draft.reproduction} onChange={(event) => set('reproduction', event.target.value)} placeholder="1. Deploy the demo contract&#10;2. Submit a revoked proof&#10;3. Observe the accepted result" rows={4} /></Field>
        <div className="form-grid two-col"><Field label="Impact"><textarea value={draft.impact} onChange={(event) => set('impact', event.target.value)} placeholder="Who can be affected and what can they lose?" rows={3} /></Field><Field label="Suggested fix"><textarea value={draft.suggestedFix} onChange={(event) => set('suggestedFix', event.target.value)} placeholder="A short fix idea, if you have one." rows={3} /></Field></div>
        <div className="form-actions"><div className="form-note"><span className="mini-lock">⌁</span> {blockedByWallet ? 'Deploy and initialize the contract before a wallet-backed submission.' : submitting ? (onChain ? 'Preparing and sending the Midnight transaction…' : 'Encrypting the report…') : 'Your report will be encrypted in this browser.'}</div><button className="button button-primary" type="submit" disabled={submitting || blockedByWallet}>{submitting ? 'Submitting…' : 'Encrypt & submit report'} <span>→</span></button></div>
      </form>}
    </div>
  );
}

function MaintainerView({ state, reviewDraft, onReview, onAccept, onReject, blockedByWallet }: { state: DemoState; reviewDraft: ReportDraft | null; onReview: () => void; onAccept: () => void; onReject: () => void; blockedByWallet: boolean }) {
  const report = state.report;
  return (
    <div className="view-stack">
      <ViewHeader kicker="MAINTAINER" title="Review before you reveal" description="Only the maintainer can decrypt the evidence. Acceptance changes the public state." />
      {!report ? <EmptyState title="No report yet" text="Switch to Researcher and submit a synthetic report to open the review queue." /> : <>
        <div className="review-header"><div><span className="record-label">INCOMING REPORT</span><h3>{report.id}</h3></div><StatusPill status={report.status} /></div>
        <div className="review-meta"><span><small>Commitment</small><code>{shortHash(report.commitment)}</code></span><span><small>Proof</small><strong className="verified">✓ Verified</strong></span><span><small>Submitted</small><strong>{formatTime(report.submittedAt)}</strong></span></div>
        {!reviewDraft ? <div className="decrypt-panel"><div className="decrypt-icon">⌁</div><div><strong>Evidence is encrypted</strong><span>Decrypt locally to inspect the report. The plaintext never enters the public record.</span></div><button className="button button-primary" onClick={onReview}>Decrypt in browser <span>→</span></button></div> : <div className="private-report"><div className="private-report-head"><span className="private-tag">PRIVATE REPORT</span><span>Decrypted locally</span></div><h3>{reviewDraft.title}</h3><p className="report-summary">{reviewDraft.summary}</p><div className="private-grid"><PrivateValue label="Component" value={`${reviewDraft.component} / ${reviewDraft.affectedVersion}`} /><PrivateValue label="Severity" value={`${reviewDraft.severity} / 5`} /><PrivateValue label="Impact" value={reviewDraft.impact || 'No impact statement supplied'} /></div><div className="private-block"><span>Reproduction steps</span><p>{reviewDraft.reproduction}</p></div><div className="private-block"><span>Suggested fix</span><p>{reviewDraft.suggestedFix || 'No fix suggestion supplied'}</p></div>{report.status === 'SUBMITTED' && <div className="review-actions"><button className="button button-quiet" onClick={onReject} disabled={blockedByWallet}>Reject report</button><button className="button button-primary" onClick={onAccept} disabled={blockedByWallet}>Accept &amp; unlock payout <span>→</span></button></div>}</div>}
      </>}
    </div>
  );
}

function PublicRecord({ role, state, disclosureText, setDisclosureText, onClaim, onDisclose, onChain, blockedByWallet }: { role: Role; state: DemoState; disclosureText: string; setDisclosureText: React.Dispatch<React.SetStateAction<string>>; onClaim: () => void; onDisclose: () => void; onChain: boolean; blockedByWallet: boolean }) {
  const report = state.report;
  return <aside className="public-panel"><div className="panel-heading"><div><span className="record-label">ON-CHAIN RECORD</span><h2>Public ledger</h2></div><span className="chain-icon">⌘</span></div><div className="ledger-status"><span className="pulse-dot" /> <span>{onChain ? 'Midnight contract state' : 'Live local state'}</span></div><div className="ledger-bounty"><span className="record-label">BOUNTY</span><strong>{state.bounty.title}</strong><span>{state.bounty.rewardAmount} tNIGHT claim amount</span></div><div className="ledger-line" /><div className="ledger-record"><div className="ledger-record-top"><span className="record-label">REPORT STATUS</span>{report ? <StatusPill status={report.status} /> : <StatusPill status="OPEN" />}</div>{report ? <><div className="ledger-id">{report.id}</div><div className="ledger-row"><span>Commitment</span><code>{shortHash(report.commitment)}</code></div><div className="ledger-row"><span>Severity proof</span><strong className="verified">✓ Pass</strong></div><div className="ledger-row"><span>Report body</span><strong className="hidden-value">Hidden</strong></div>{report.payoutClaimedAt && <div className="ledger-row"><span>Payout record</span><strong>{state.bounty.rewardAmount} tNIGHT authorized</strong></div>}{report.disclosureSummary && <div className="disclosure-card"><span className="record-label">SAFE DISCLOSURE</span><p>{report.disclosureSummary}</p></div>}</> : <div className="empty-ledger">The chain is waiting for its first private report.</div>}</div>{role === 'researcher' && report?.status === 'ACCEPTED' && <div className="claim-box"><span>Accepted report</span><strong>Payout authorization is ready</strong><button className="button button-primary full" onClick={onClaim} disabled={blockedByWallet}>Record {state.bounty.rewardAmount} tNIGHT claim <span>→</span></button><small>Test record only. This contract does not transfer tNIGHT.</small></div>}{report && ['ACCEPTED', 'PAID'].includes(report.status) && !report.disclosureSummary && <div className="disclosure-box"><span className="record-label">AFTER THE PATCH</span><strong>Publish a safe summary</strong><textarea value={disclosureText} onChange={(event) => setDisclosureText(event.target.value)} placeholder="Example: Fixed proof replay in v0.1.1" rows={3} /><button className="button button-quiet full" onClick={onDisclose} disabled={blockedByWallet}>Publish summary</button></div>}<div className="panel-foot"><span>Network</span><code>{onChain ? 'midnight' : 'local-demo'}</code></div></aside>;
}

function ViewHeader({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return <div className="view-header"><span className="record-label">{kicker}</span><h2>{title}</h2><p>{description}</p></div>;
}

function Field({ label, note, required, children }: { label: string; note?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="field"><span>{label}{required && <b> *</b>}{note && <small>{note}</small>}</span>{children}</label>;
}

function RecordRow({ label, value, meta, right, mono }: { label: string; value: string; meta: string; right?: React.ReactNode; mono?: boolean }) {
  return <div className="record-row"><div className="record-row-main"><span className="record-label">{label}</span><strong className={mono ? 'mono' : ''}>{value}</strong><small>{meta}</small></div>{right}</div>;
}

function PrivateValue({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><div className="empty-state-mark">◌</div><h3>{title}</h3><p>{text}</p></div>;
}

export default App;
