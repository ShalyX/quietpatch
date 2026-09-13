import type {
  Configuration,
  ConnectedAPI,
  InitialAPI
} from '@midnight-ntwrk/dapp-connector-api';
import { safeMidnightErrorDetail } from './midnightErrorDetails';

export const DEFAULT_NETWORK_ID = import.meta.env.VITE_NETWORK_ID ?? 'undeployed';
const SUPPORTED_CONNECTOR_MAJOR = 4;
const CONNECTION_TIMEOUT_MS = 30_000;
const DUST_READ_TIMEOUT_MS = 8_000;
const DUST_READ_ATTEMPTS = 3;
const DUST_RETRY_DELAY_MS = 1_000;

export interface WalletConnection {
  readonly initial: InitialAPI;
  readonly connected: ConnectedAPI;
  readonly configuration: Configuration;
  readonly networkId: string;
  readonly shieldedAddress: string;
  readonly unshieldedAddress: string;
}

export interface DustBalance {
  readonly cap: bigint;
  readonly balance: bigint;
}

function connectorMajorVersion(version: string): number | null {
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  return Number.isInteger(major) ? major : null;
}

type ConnectorError = {
  type?: unknown;
  code?: unknown;
  reason?: unknown;
  cause?: unknown;
};

function errorChain(error: unknown): ConnectorError[] {
  const chain: ConnectorError[] = [];
  const visited = new Set<unknown>();
  let current = error;

  for (let depth = 0; current && depth < 6 && !visited.has(current); depth += 1) {
    visited.add(current);
    if (typeof current !== 'object') break;
    const record = current as ConnectorError;
    chain.push(record);
    current = record.cause;
  }

  return chain;
}

function connectorErrorCode(error: unknown): string | undefined {
  return errorChain(error)
    .find((candidate) => candidate.type === 'DAppConnectorAPIError' && typeof candidate.code === 'string')
    ?.code as string | undefined;
}

function connectorErrorReason(error: unknown): string | undefined {
  const reason = errorChain(error)
    .find((candidate) => candidate.type === 'DAppConnectorAPIError' && typeof candidate.reason === 'string')
    ?.reason;
  if (typeof reason !== 'string') return undefined;

  const cleanReason = reason.replace(/\s+/g, ' ').trim();
  // Do not put serialized transactions, keys, or other large payloads in the UI.
  if (!cleanReason || cleanReason.length > 240 || /[0-9a-f]{64,}/i.test(cleanReason)) return undefined;
  return cleanReason;
}

function safeErrorMessage(error: unknown): string | undefined {
  return safeMidnightErrorDetail(error);
}

function transactionFailureMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('finalizedTxData' in error)) return undefined;
  const finalized = (error as { finalizedTxData?: { status?: unknown; segmentStatusMap?: unknown } }).finalizedTxData;
  if (!finalized || typeof finalized.status !== 'string') return undefined;

  if (finalized.status === 'FailEntirely') {
    return 'Midnight rejected the deployment before inclusion. Check that Lace is on Undeployed and that this account has enough tDUST, then retry.';
  }
  if (finalized.status === 'FailFallible') {
    return 'Midnight included the deployment but its fallible phase failed. Retry with a fresh deployment and do not reuse the failed address.';
  }
  return `Midnight finalized the deployment with status ${finalized.status}.`;
}

export function userFacingMidnightError(error: unknown, fallback: string): string {
  const code = connectorErrorCode(error);
  const reason = connectorErrorReason(error);
  if (code === 'Rejected') return 'Lace rejected the transaction. Approve the request in Lace and try again.';
  if (code === 'PermissionRejected') return 'Lace denied QuietPatch permission. Reconnect the site in Lace and try again.';
  if (code === 'Disconnected') return 'Lace disconnected while processing the transaction. Unlock it, select Undeployed, and try again.';
  if (code === 'InvalidRequest') return reason
    ? `Lace rejected the transaction: ${reason}`
    : 'Lace rejected the transaction as invalid. Check the wallet network and tDUST balance, then try again.';
  if (code === 'InternalError') return reason
    ? `Lace could not process the transaction: ${reason}`
    : 'Lace could not process the transaction. Check that the wallet is unlocked and has tDUST, then try again.';

  const transactionFailure = transactionFailureMessage(error);
  if (transactionFailure) return transactionFailure;

  const message = safeErrorMessage(error);
  if (message?.includes("Remote API with channel 'feature-flags' was shutdown") || message?.includes('object can no longer be used')) {
    const networkLabel = DEFAULT_NETWORK_ID === 'undeployed' ? 'Undeployed' : DEFAULT_NETWORK_ID;
    return `Lace closed its connection channel. Fully reload the Lace extension, unlock it on ${networkLabel}, reload this page, and connect again.`;
  }
  if (message === 'Failed to fetch' || message?.toLowerCase().includes('failed to fetch')) {
    return 'QuietPatch cannot reach the Midnight node or indexer. Keep the local tunnel running, reload this page, and reconnect after the services recover.';
  }
  return message || fallback;
}

function connectionError(error: unknown, networkId: string): Error {
  const networkLabel = networkId === 'undeployed' ? 'Undeployed' : networkId;
  switch (connectorErrorCode(error)) {
    case 'Rejected':
      return new Error(`The wallet connection was declined in Lace. Open Lace and approve QuietPatch on the ${networkLabel} network, then try again.`);
    case 'PermissionRejected':
      return new Error('QuietPatch is blocked in Lace. Open Lace settings, allow this site, and try connecting again.');
    case 'Disconnected':
      return new Error(`Lace disconnected before the connection finished. Unlock Lace, select ${networkLabel}, and try again.`);
    case 'InternalError':
      return new Error(`Lace could not process the connection. Unlock the wallet, confirm it is on ${networkLabel}, and retry.`);
    default:
      return new Error(userFacingMidnightError(
        error,
        `Lace did not finish the ${networkId} connection. Make sure the wallet is unlocked and the approval popup was completed.`
      ));
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  message: string,
  timeoutMs = CONNECTION_TIMEOUT_MS
): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function isDustBalance(value: unknown): value is DustBalance {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { cap?: unknown; balance?: unknown };
  return typeof candidate.cap === 'bigint' && typeof candidate.balance === 'bigint';
}

/**
 * Lace can accept a connection before its wallet state has finished syncing.
 * Keep this read-only retry bounded so a temporarily unavailable balance does
 * not turn into a deployment attempt with unknown fee resources.
 */
export async function getDustBalanceWhenReady(connected: ConnectedAPI): Promise<DustBalance> {
  let lastError: unknown;

  for (let attempt = 0; attempt < DUST_READ_ATTEMPTS; attempt += 1) {
    try {
      const dust = await withTimeout(
        connected.getDustBalance(),
        'Lace is still syncing the tDUST balance.',
        DUST_READ_TIMEOUT_MS
      );
      if (!isDustBalance(dust)) {
        throw new Error('Lace returned an invalid tDUST balance.');
      }
      return dust;
    } catch (error) {
      lastError = error;
      if (attempt < DUST_READ_ATTEMPTS - 1) await sleep(DUST_RETRY_DELAY_MS);
    }
  }

  if (lastError instanceof Error && lastError.message !== 'Lace is still syncing the tDUST balance.') {
    throw lastError;
  }
  throw new Error('Lace did not return the tDUST balance. Unlock Lace, wait for it to sync, and try again.');
}

function sameNetworkId(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function discoverMidnightWallets(): InitialAPI[] {
  if (typeof window === 'undefined' || !window.midnight) return [];
  return Object.values(window.midnight).filter(
    (wallet): wallet is InitialAPI =>
      !!wallet &&
      typeof wallet === 'object' &&
      typeof wallet.connect === 'function' &&
      typeof wallet.apiVersion === 'string'
  );
}

export function findMidnightWallet(): InitialAPI | undefined {
  if (typeof window === 'undefined' || !window.midnight) return undefined;
  const compatibleEntries = Object.entries(window.midnight).filter(([, wallet]) =>
    !!wallet &&
    typeof wallet.connect === 'function' &&
    typeof wallet.apiVersion === 'string' &&
    connectorMajorVersion(wallet.apiVersion) === SUPPORTED_CONNECTOR_MAJOR
  );
  const laceEntry = compatibleEntries.find(([key, wallet]) =>
    key.toLowerCase() === 'mnlace' ||
    wallet.name.toLowerCase().includes('lace') ||
    wallet.rdns.toLowerCase().includes('lace')
  );
  return laceEntry?.[1] ?? compatibleEntries[0]?.[1];
}

export async function connectMidnightWallet(
  networkId: string = DEFAULT_NETWORK_ID
): Promise<WalletConnection> {
  const initial = findMidnightWallet();
  if (!initial) {
    throw new Error('No compatible Midnight wallet was found. Install Lace or another v4 wallet and try again.');
  }

  // Call connect immediately from the click handler so Lace can open its authorization popup.
  let connected: ConnectedAPI;
  try {
    // Do not put a timer or another async step between the click and Lace.
    // Lace may keep this promise pending while its authorization UI is open.
    connected = await initial.connect(networkId);
  } catch (error) {
    throw connectionError(error, networkId);
  }
  try {
    const [status, configuration, addresses, unshieldedAddress] = await withTimeout(
      Promise.all([
        connected.getConnectionStatus(),
        connected.getConfiguration(),
        connected.getShieldedAddresses(),
        connected.getUnshieldedAddress()
      ]),
      'Lace connected but did not return its network details. Refresh the page and try again.'
    );

    if (status.status !== 'connected' || !sameNetworkId(status.networkId, networkId)) {
      throw new Error(`Wallet connected to ${status.status === 'connected' ? status.networkId : 'no network'}, expected ${networkId}.`);
    }

    return {
      initial,
      connected,
      configuration,
      networkId,
      shieldedAddress: addresses.shieldedAddress,
      unshieldedAddress: unshieldedAddress.unshieldedAddress
    };
  } catch (error) {
    throw connectionError(error, networkId);
  }
}
