import './runtime';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import {
  Binding,
  Proof,
  SignatureEnabled,
  Transaction
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  createProofProvider,
  type FinalizedTxData,
  type MidnightProviders
} from '@midnight-ntwrk/midnight-js-types';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract, ledger, pureCircuits, type Ledger } from '@quietpatch/contract';
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import { bytes32FromHex, bytes32FromText } from './crypto';
import { DEFAULT_NETWORK_ID, getDustBalanceWhenReady, userFacingMidnightError, type WalletConnection } from './wallet';
import { observeProvider, type DeploymentStage } from './deploymentProgress';

export const QUIETPATCH_PRIVATE_STATE_ID = 'quietpatch-private-state';
const DEPLOYED_CONTRACT_STORAGE_KEY = `quietpatch:deployed-contract:${DEFAULT_NETWORK_ID}`;
const INACCESSIBLE_CONTRACT_STORAGE_KEY = `quietpatch:inaccessible-contract:${DEFAULT_NETWORK_ID}`;
const BOUNTY_INITIALIZED_STORAGE_PREFIX = 'quietpatch:bounty-initialized:';
export const QUIETPATCH_CIRCUITS = [
  'createBounty',
  'closeBounty',
  'submitReport',
  'acceptReport',
  'rejectReport',
  'claimPayout',
  'publishDisclosure'
] as const;

export type QuietPatchCircuitId = (typeof QUIETPATCH_CIRCUITS)[number];

export type QuietPatchProviders = MidnightProviders<
  QuietPatchCircuitId,
  typeof QUIETPATCH_PRIVATE_STATE_ID,
  QuietPatchPrivateState
>;

export interface QuietPatchPrivateState {
  readonly maintainerSecretKey: Uint8Array;
  readonly researcherSecretKey: Uint8Array;
  readonly reportDigest: Uint8Array;
  readonly reportNonce: Uint8Array;
  readonly severity: bigint;
}

export interface QuietPatchTransaction {
  readonly txId: string;
  readonly blockHeight: number;
}

export type QuietPatchClaimEligibility =
  | { readonly eligible: true }
  | { readonly eligible: false; readonly reason: string };

export type QuietPatchBountyStatus = 'NONE' | 'OPEN' | 'CLOSED';
export type QuietPatchReportStatus = 'NONE' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'PAID' | 'DISCLOSED';

export interface QuietPatchPublicState {
  readonly bountyStatus: QuietPatchBountyStatus;
  readonly reportStatus: QuietPatchReportStatus;
  readonly bountyId: string;
  readonly submissionDeadline: bigint;
  readonly minimumSeverity: bigint;
  readonly rewardAmount: bigint;
  readonly reportCommitment: string;
  readonly reportSeverityPass: boolean;
  readonly disclosureDigest: string;
}

export interface QuietPatchBounty {
  readonly id: string;
  readonly minimumSeverity: bigint;
  readonly rewardAmount: bigint;
  readonly submissionDeadline: bigint;
}

export class SavedContractPrivateStateError extends Error {
  constructor(readonly contractAddress: string, cause: unknown) {
    super('The saved contract exists, but its local private state could not be decrypted.', { cause });
    this.name = 'SavedContractPrivateStateError';
  }
}

export interface QuietPatchContractClient {
  readonly providers: QuietPatchProviders;
  readonly contractAddress: string;
  createBounty(
    bountyId: Uint8Array,
    minimumSeverity: bigint,
    rewardAmount: bigint,
    submissionDeadline: bigint
  ): Promise<QuietPatchTransaction>;
  submitReport(input: {
    commitment: Uint8Array;
    reportDigest: Uint8Array;
    reportNonce: Uint8Array;
    severity: bigint;
  }): Promise<QuietPatchTransaction>;
  acceptReport(): Promise<QuietPatchTransaction>;
  rejectReport(): Promise<QuietPatchTransaction>;
  checkClaimEligibility(): Promise<QuietPatchClaimEligibility>;
  claimPayout(): Promise<QuietPatchTransaction>;
  publishDisclosure(disclosureDigest: Uint8Array): Promise<QuietPatchTransaction>;
  readPublicState(): Promise<QuietPatchPublicState>;
}

type QuietPatchCompiledContract = CompiledContract.CompiledContract<Contract, QuietPatchPrivateState, never>;

type QuietPatchWitnessContext = WitnessContext<Ledger, QuietPatchPrivateState>;

function storagePassword(): string {
  const sessionKey = 'quietpatch:midnight-storage-password';
  const persistentKey = 'quietpatch:midnight-storage-password:v1';
  const existingSession = sessionStorage.getItem(sessionKey);
  if (existingSession) {
    // Keep an existing session's password so the current encrypted database
    // remains readable, while also making future tabs/reloads recoverable.
    if (!localStorage.getItem(persistentKey)) localStorage.setItem(persistentKey, existingSession);
    return existingSession;
  }

  const existingPersistent = localStorage.getItem(persistentKey);
  if (existingPersistent) {
    sessionStorage.setItem(sessionKey, existingPersistent);
    return existingPersistent;
  }

  const value = `QuietPatch!${crypto.randomUUID()}7`;
  sessionStorage.setItem(sessionKey, value);
  localStorage.setItem(persistentKey, value);
  return value;
}

function randomBytes32(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

function initialPrivateState(): QuietPatchPrivateState {
  return {
    maintainerSecretKey: randomBytes32(),
    researcherSecretKey: randomBytes32(),
    reportDigest: new Uint8Array(32),
    reportNonce: new Uint8Array(32),
    severity: 0n
  };
}

function transactionResult(data: Pick<FinalizedTxData, 'txId' | 'blockHeight'>): QuietPatchTransaction {
  return { txId: data.txId, blockHeight: data.blockHeight };
}

const BOUNTY_STATUS_LABELS = ['NONE', 'OPEN', 'CLOSED'] as const;
const REPORT_STATUS_LABELS = ['NONE', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'PAID', 'DISCLOSED'] as const;
const TDUST_BASE_UNITS = 1_000_000_000_000_000n;

function formatTDust(value: bigint): string {
  const whole = value / TDUST_BASE_UNITS;
  const hundredths = (value % TDUST_BASE_UNITS) * 100n / TDUST_BASE_UNITS;
  return hundredths === 0n
    ? whole.toLocaleString()
    : `${whole.toLocaleString()}.${hundredths.toString().padStart(2, '0')}`;
}

function publicStateFromLedger(state: Ledger): QuietPatchPublicState {
  return {
    bountyStatus: BOUNTY_STATUS_LABELS[Number(state.bountyStatus)] ?? 'NONE',
    reportStatus: REPORT_STATUS_LABELS[Number(state.reportStatus)] ?? 'NONE',
    bountyId: toHex(state.bountyId),
    submissionDeadline: state.submissionDeadline,
    minimumSeverity: state.minimumSeverity,
    rewardAmount: state.rewardAmount,
    reportCommitment: toHex(state.reportCommitment),
    reportSeverityPass: state.reportSeverityPass,
    disclosureDigest: toHex(state.disclosureDigest)
  };
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export function createQuietPatchCompiledContract(): QuietPatchCompiledContract {
  return CompiledContract.withWitnesses(CompiledContract.make('quietpatch', Contract), {
    maintainerSecretKey: (context: QuietPatchWitnessContext) => [context.privateState, context.privateState.maintainerSecretKey],
    researcherSecretKey: (context: QuietPatchWitnessContext) => [context.privateState, context.privateState.researcherSecretKey],
    privateReportDigest: (context: QuietPatchWitnessContext) => [context.privateState, context.privateState.reportDigest],
    privateReportNonce: (context: QuietPatchWitnessContext) => [context.privateState, context.privateState.reportNonce],
    privateSeverity: (context: QuietPatchWitnessContext) => [context.privateState, context.privateState.severity]
  }) as unknown as QuietPatchCompiledContract;
}

export async function createQuietPatchProviders(
  connection: WalletConnection
): Promise<QuietPatchProviders> {
  setNetworkId(connection.networkId);

  // Contract calls are balanced and submitted through Lace's connected API.
  // Hinting these methods lets Lace request the relevant permission before the
  // first transaction instead of making the flow look like a local-only write.
  let transactionUsageHinted = false;
  const hintTransactionUsage = async (): Promise<void> => {
    if (transactionUsageHinted || typeof connection.connected.hintUsage !== 'function') return;
    await connection.connected.hintUsage([
      'balanceUnsealedTransaction',
      'submitTransaction'
    ]);
    transactionUsageHinted = true;
  };

  const artifactBaseUrl = new URL('/midnight/quietpatch/', window.location.origin).toString();
  const zkConfigProvider = new FetchZkConfigProvider<QuietPatchCircuitId>(
    artifactBaseUrl,
    fetch.bind(window)
  );
  // Lace exposes a proving-provider method, but for Undeployed it can wait on
  // Lace's internal remote channel instead of reaching the local proof server.
  // Keep Lace for balancing/submission and use the VPS-forwarded proof server
  // explicitly on the local network.
  const provingProvider = connection.networkId === 'undeployed'
    ? httpClientProvingProvider(
        'http://localhost:6300',
        zkConfigProvider
      )
    : typeof connection.connected.getProvingProvider === 'function'
      ? await connection.connected.getProvingProvider(zkConfigProvider.asKeyMaterialProvider())
      : httpClientProvingProvider(
          connection.configuration.proverServerUri ?? 'http://localhost:6300',
          zkConfigProvider
        );
  const proofProvider = createProofProvider(provingProvider);
  const addresses = await connection.connected.getShieldedAddresses();
  const privateStateProvider = levelPrivateStateProvider({
    midnightDbName: 'quietpatch',
    privateStateStoreName: 'quietpatch-private-states',
    signingKeyStoreName: 'quietpatch-signing-keys',
    privateStoragePasswordProvider: storagePassword,
    accountId: addresses.shieldedAddress
  });

  return {
    privateStateProvider,
    publicDataProvider: indexerPublicDataProvider(
      connection.configuration.indexerUri,
      connection.configuration.indexerWsUri
    ),
    zkConfigProvider,
    proofProvider,
    walletProvider: {
      getCoinPublicKey: () => addresses.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => addresses.shieldedEncryptionPublicKey,
      balanceTx: async (tx) => {
        await hintTransactionUsage();
        try {
          const balanced = await connection.connected.balanceUnsealedTransaction(toHex(tx.serialize()));
          return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
            'signature',
            'proof',
            'binding',
            fromHex(balanced.tx)
          );
        } catch (error) {
          let dustStatus = 'Lace did not return a current tDUST balance.';
          try {
            const dust = await getDustBalanceWhenReady(connection.connected);
            dustStatus = `Lace reports ${formatTDust(dust.balance)} of ${formatTDust(dust.cap)} tDUST available.`;
          } catch {
            // Keep the original balancing failure as the cause.
          }
          const reason = userFacingMidnightError(
            error,
            'Lace did not provide a detailed coin-selection reason.'
          );
          throw new Error(
            `Lace could not balance this contract transaction. ${reason} ${dustStatus}`,
            { cause: error }
          );
        }
      }
    },
    midnightProvider: {
      submitTx: async (tx) => {
        await hintTransactionUsage();
        await connection.connected.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      }
    }
  };
}

type QuietPatchCallTx = {
  createBounty(
    bountyId: Uint8Array,
    minimumSeverity: bigint,
    rewardAmount: bigint,
    submissionDeadline: bigint
  ): Promise<{ public: Pick<FinalizedTxData, 'txId' | 'blockHeight'> }>;
  submitReport(commitment: Uint8Array): Promise<{ public: Pick<FinalizedTxData, 'txId' | 'blockHeight'> }>;
  acceptReport(): Promise<{ public: Pick<FinalizedTxData, 'txId' | 'blockHeight'> }>;
  rejectReport(): Promise<{ public: Pick<FinalizedTxData, 'txId' | 'blockHeight'> }>;
  claimPayout(): Promise<{ public: Pick<FinalizedTxData, 'txId' | 'blockHeight'> }>;
  publishDisclosure(disclosureDigest: Uint8Array): Promise<{ public: Pick<FinalizedTxData, 'txId' | 'blockHeight'> }>;
};

type QuietPatchDeployedContract = {
  readonly deployTxData: {
    readonly public: Pick<FinalizedTxData, 'txId' | 'blockHeight'> & { contractAddress: string };
  };
  readonly callTx: QuietPatchCallTx;
};

function createClient(
  providers: QuietPatchProviders,
  deployed: QuietPatchDeployedContract
): QuietPatchContractClient {
  const contractAddress = deployed.deployTxData.public.contractAddress;

  const checkClaimEligibility = async (): Promise<QuietPatchClaimEligibility> => {
    const [contractState, privateState] = await Promise.all([
      providers.publicDataProvider.queryContractState(contractAddress),
      providers.privateStateProvider.get(QUIETPATCH_PRIVATE_STATE_ID)
    ]);

    if (!contractState) {
      return { eligible: false, reason: 'The current Midnight contract state is unavailable. Refresh the chain connection before claiming.' };
    }
    if (!privateState) {
      return { eligible: false, reason: 'This browser has no private claim key for the report. Use the same browser and Lace account that submitted the report. Do not clear QuietPatch browser data.' };
    }

    const state = ledger(contractState.data);
    if (REPORT_STATUS_LABELS[Number(state.reportStatus)] !== 'ACCEPTED') {
      return { eligible: false, reason: 'This report is no longer awaiting a payout claim. Refresh the public record before trying again.' };
    }

    const derivedResearcher = pureCircuits.derivePublicKey(
      privateState.researcherSecretKey,
      state.reportCommitment
    );
    if (!bytesEqual(derivedResearcher, state.reportResearcher)) {
      return { eligible: false, reason: 'This connected Lace account does not hold the report’s private claim key. Switch to the original researcher account, reconnect QuietPatch, and try again. Do not reset this browser.' };
    }

    return { eligible: true };
  };

  return {
    providers,
    contractAddress,
    async createBounty(bountyId, minimumSeverity, rewardAmount, submissionDeadline) {
      const result = await deployed.callTx.createBounty(
        bountyId,
        minimumSeverity,
        rewardAmount,
        submissionDeadline
      );
      return transactionResult(result.public);
    },
    async submitReport({ commitment, reportDigest, reportNonce, severity }) {
      if (commitment.length !== 32 || reportDigest.length !== 32 || reportNonce.length !== 32) {
        throw new Error('A report commitment, digest, and nonce must each be 32 bytes.');
      }
      const current = await providers.privateStateProvider.get(QUIETPATCH_PRIVATE_STATE_ID);
      await providers.privateStateProvider.set(QUIETPATCH_PRIVATE_STATE_ID, {
        ...(current ?? initialPrivateState()),
        reportDigest,
        reportNonce,
        severity
      });
      const result = await deployed.callTx.submitReport(commitment);
      return transactionResult(result.public);
    },
    async acceptReport() {
      const result = await deployed.callTx.acceptReport();
      return transactionResult(result.public);
    },
    async rejectReport() {
      const result = await deployed.callTx.rejectReport();
      return transactionResult(result.public);
    },
    checkClaimEligibility,
    async claimPayout() {
      const eligibility = await checkClaimEligibility();
      if (!eligibility.eligible) throw new Error(eligibility.reason);
      const result = await deployed.callTx.claimPayout();
      return transactionResult(result.public);
    },
    async publishDisclosure(disclosureDigest) {
      if (disclosureDigest.length !== 32) throw new Error('A disclosure digest must be 32 bytes.');
      const result = await deployed.callTx.publishDisclosure(disclosureDigest);
      return transactionResult(result.public);
    },
    async readPublicState() {
      const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
      if (!contractState) throw new Error('The deployed contract has no readable public state yet.');
      return publicStateFromLedger(ledger(contractState.data));
    }
  };
}

export function configuredQuietPatchContractAddress(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const inaccessibleAddress = window.localStorage.getItem(INACCESSIBLE_CONTRACT_STORAGE_KEY);
  const address = import.meta.env.VITE_CONTRACT_ADDRESS?.trim();
  // A build-time address must not override an address that this browser has
  // explicitly quarantined after a private-state decryption failure.
  if (address && address !== inaccessibleAddress) return address;
  const savedAddress = window.localStorage.getItem(DEPLOYED_CONTRACT_STORAGE_KEY);
  if (savedAddress && savedAddress !== inaccessibleAddress) return savedAddress;

  // Older builds removed the primary pointer when "Reset demo" was clicked,
  // but left the successful bounty marker behind. Recover that address instead
  // of asking the wallet to pay for a duplicate contract deployment.
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(BOUNTY_INITIALIZED_STORAGE_PREFIX)) continue;
    const recoveredAddress = key.slice(BOUNTY_INITIALIZED_STORAGE_PREFIX.length);
    if (!/^[0-9a-f]{64}$/i.test(recoveredAddress)) continue;
    if (recoveredAddress === inaccessibleAddress) continue;
    window.localStorage.setItem(DEPLOYED_CONTRACT_STORAGE_KEY, recoveredAddress);
    return recoveredAddress;
  }
  return undefined;
}

export function rememberQuietPatchContractAddress(address: string): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DEPLOYED_CONTRACT_STORAGE_KEY, address);
  }
}

export function forgetQuietPatchContractAddress(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(DEPLOYED_CONTRACT_STORAGE_KEY);
  }
}

export function archiveInaccessibleQuietPatchContractAddress(address: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(INACCESSIBLE_CONTRACT_STORAGE_KEY, address);
  if (window.localStorage.getItem(DEPLOYED_CONTRACT_STORAGE_KEY) === address) {
    window.localStorage.removeItem(DEPLOYED_CONTRACT_STORAGE_KEY);
  }
}

function isContractStateMismatch(error: unknown): boolean {
  return error instanceof Error && (
    error.message.includes('mismatched verifier keys') ||
    error.message.includes('are undefined or have mismatched verifier keys')
  );
}

function isPrivateStateDecryptionError(error: unknown): boolean {
  const candidate = error as { name?: unknown; message?: unknown };
  const message = [candidate.name, candidate.message, String(error)]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
  return message.includes('OperationError') ||
    message.toLowerCase().includes('decrypt') ||
    message.toLowerCase().includes('authentication tag');
}

export async function findQuietPatchContract(
  providers: QuietPatchProviders,
  contractAddress = configuredQuietPatchContractAddress()
): Promise<QuietPatchContractClient | null> {
  if (!contractAddress) return null;
  const compiledContract = createQuietPatchCompiledContract();
  let found: unknown;
  try {
    // The LevelDB provider scopes private state by contract address. The
    // discovery helper sets this too, but the existing-state check below runs
    // before discovery and must set it explicitly.
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existingPrivateState = await providers.privateStateProvider.get(QUIETPATCH_PRIVATE_STATE_ID);
    if (existingPrivateState) {
      // The deploy transaction stores the contract's private state under this
      // ID. On reconnect, omitting initialPrivateState is important: supplying
      // both values would replace the maintainer and researcher secrets.
      found = await findDeployedContract(providers, {
        compiledContract,
        contractAddress,
        privateStateId: QUIETPATCH_PRIVATE_STATE_ID
      });
    } else {
      // A new wallet needs its own researcher witness state before it can
      // submit a report. This branch only runs when no local state exists.
      found = await findDeployedContract(providers, {
        compiledContract,
        contractAddress,
        privateStateId: QUIETPATCH_PRIVATE_STATE_ID,
        initialPrivateState: initialPrivateState()
      });
    }
  } catch (error) {
    if (isPrivateStateDecryptionError(error)) {
      throw new SavedContractPrivateStateError(contractAddress, error);
    }
    if (isContractStateMismatch(error)) {
      throw new Error('The saved contract does not match the current compiled contract. Its address has been preserved. Restore matching contract artifacts or explicitly choose a new deployment.', { cause: error });
    }
    throw error;
  }
  return createClient(providers, found as unknown as QuietPatchDeployedContract);
}

export async function deployQuietPatchContract(
  providers: QuietPatchProviders,
  onStage: (stage: DeploymentStage) => void = () => {}
): Promise<QuietPatchContractClient> {
  onStage('prepare');
  const observed: QuietPatchProviders = {
    ...providers,
    proofProvider: observeProvider(providers.proofProvider, { proveTx: 'prove' }, onStage),
    walletProvider: observeProvider(providers.walletProvider, { balanceTx: 'balance' }, onStage),
    midnightProvider: observeProvider(providers.midnightProvider, { submitTx: 'submit' }, onStage),
    publicDataProvider: observeProvider(providers.publicDataProvider, { watchForTxData: 'confirm' }, onStage),
    privateStateProvider: observeProvider(providers.privateStateProvider, {
      setContractAddress: 'save', set: 'save', setSigningKey: 'save'
    }, onStage)
  };
  const deployed = await deployContract(observed, {
    compiledContract: createQuietPatchCompiledContract(),
    privateStateId: QUIETPATCH_PRIVATE_STATE_ID,
    initialPrivateState: initialPrivateState()
  });
  // Deployment and the first circuit call are separate Midnight transactions.
  // Return the client immediately so the address is not lost if createBounty needs
  // a second Lace approval or fails because of fees/proof-server state.
  return createClient(providers, deployed as unknown as QuietPatchDeployedContract);
}

export async function initializeQuietPatchBounty(
  client: QuietPatchContractClient,
  bounty: QuietPatchBounty
): Promise<QuietPatchTransaction> {
  return client.createBounty(
    bytes32FromText(bounty.id),
    bounty.minimumSeverity,
    bounty.rewardAmount,
    bounty.submissionDeadline
  );
}

export function reportInputFromHex(value: string): Uint8Array {
  return bytes32FromHex(value);
}
