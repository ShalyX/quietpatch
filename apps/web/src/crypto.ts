import type { Bounty, ReportDraft } from './types';
import {
  CompactTypeBytes,
  CompactTypeVector,
  convertFieldToBytes,
  persistentHash
} from '@midnight-ntwrk/compact-runtime';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encryptedBytes(value: string): Uint8Array {
  return base64ToBytes(value);
}

function bytesHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function bytes32FromText(value: string): Uint8Array {
  const bytes = encoder.encode(value);
  if (bytes.length > 32) throw new Error('The value must fit in 32 bytes.');
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return padded;
}

export function bytes32FromHex(value: string): Uint8Array {
  const normalized = value.replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/i.test(normalized)) throw new Error('Expected a 32-byte hexadecimal value.');
  return Uint8Array.from(normalized.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

const reportCommitmentType = new CompactTypeVector(5, new CompactTypeBytes(32));

export function createReportCommitment(
  bountyId: Uint8Array,
  reportDigest: Uint8Array,
  reportNonce: Uint8Array,
  severity: number
): string {
  if (bountyId.length !== 32 || reportDigest.length !== 32 || reportNonce.length !== 32) {
    throw new Error('Commitment inputs must be 32 bytes each.');
  }
  const domain = bytes32FromText('quietpatch:report:');
  const severityBytes = convertFieldToBytes(32, BigInt(severity), 'QuietPatch report severity');
  return `0x${bytesHex(persistentHash(reportCommitmentType, [domain, bountyId, reportDigest, reportNonce, severityBytes]))}`;
}

export async function createDisclosureDigest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value.trim())));
}

export async function createSessionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function exportSessionKey(key: CryptoKey): Promise<string> {
  return JSON.stringify(await crypto.subtle.exportKey('jwk', key));
}

export async function importSessionKey(serialized: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    JSON.parse(serialized) as JsonWebKey,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptReport(
  draft: ReportDraft,
  bounty: Bounty,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string; reportDigest: string; commitment: string; reportNonce: Uint8Array }> {
  const reportNonce = crypto.getRandomValues(new Uint8Array(32));
  const nonce = bytesToBase64(reportNonce);
  const canonical = JSON.stringify({ version: 1, bountyId: bounty.id, ...draft, nonce });
  const plainBytes = encoder.encode(canonical);
  const reportDigestBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', plainBytes));
  const reportDigest = bytesHex(reportDigestBytes);
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes as unknown as BufferSource },
    key,
    plainBytes as unknown as BufferSource
  );
  const commitment = createReportCommitment(
    bytes32FromText(bounty.id),
    reportDigestBytes,
    reportNonce,
    draft.severity
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(ivBytes),
    reportDigest,
    commitment,
    reportNonce
  };
}

export async function decryptReport(
  bundle: { ciphertext: string; iv: string },
  key: CryptoKey
): Promise<ReportDraft & { bountyId: string; nonce: string }> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(bundle.iv) as unknown as BufferSource },
    key,
    base64ToBytes(bundle.ciphertext) as unknown as BufferSource
  );
  return JSON.parse(decoder.decode(plain)) as ReportDraft & { bountyId: string; nonce: string };
}
