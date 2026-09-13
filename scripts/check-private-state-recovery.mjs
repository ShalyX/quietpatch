import { createDecipheriv, createHash, pbkdf2Sync } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const contractAddress = process.argv[2];
const chromeProfile = process.argv[3];
if (!/^[0-9a-f]{64}$/i.test(contractAddress ?? '') || !chromeProfile) {
  throw new Error('Usage: node scripts/check-private-state-recovery.mjs <contract-address> <chrome-profile>');
}

const fingerprint = (value) => createHash('sha256').update(value).digest('hex').slice(0, 12);
const passwords = new Set();
const sessionDir = join(chromeProfile, 'Session Storage');
for (const name of readdirSync(sessionDir)) {
  let bytes;
  try {
    bytes = readFileSync(join(sessionDir, name));
  } catch {
    continue;
  }
  for (const encoding of ['utf8', 'utf16le']) {
    const text = bytes.toString(encoding);
    for (const match of text.matchAll(/QuietPatch![0-9a-f-]{36}7/gi)) passwords.add(match[0]);
  }
}

const indexedDbLog = readFileSync(join(
  chromeProfile,
  'IndexedDB',
  'http_localhost_5173.indexeddb.leveldb',
  '000004.log'
));
const latin = indexedDbLog.toString('latin1');
const addressPositions = [];
for (let at = latin.indexOf(contractAddress); at >= 0; at = latin.indexOf(contractAddress, at + 1)) {
  addressPositions.push(at);
}

const encodedPayloads = new Set();
for (const match of latin.matchAll(/AtZMgOqBedKGJQ2q54Ufci\+O\/ZnpUisqrFEbqsXn9Iqv[A-Za-z0-9+/=]+/g)) {
  const payloadAt = match.index ?? 0;
  if (addressPositions.some((addressAt) => payloadAt > addressAt && payloadAt - addressAt < 512)) {
    encodedPayloads.add(match[0]);
  }
}

const recovered = [];
for (const password of passwords) {
  for (const encoded of encodedPayloads) {
    // Chromium's IndexedDB record suffix can begin with base64-looking bytes.
    // Trim a short suffix range and accept only authenticated AES-GCM results.
    for (let trim = 0; trim <= 24 && trim < encoded.length; trim += 1) {
      try {
        const packed = Buffer.from(encoded.slice(0, encoded.length - trim), 'base64');
        const version = packed[0];
        if (version !== 1 && version !== 2) continue;
        const salt = packed.subarray(1, 33);
        const iv = packed.subarray(33, 45);
        const authTag = packed.subarray(45, 61);
        const ciphertext = packed.subarray(61);
        const iterations = version === 1 ? 100_000 : 600_000;
        const key = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
        const parsed = JSON.parse(plaintext);
        recovered.push({
          passwordFingerprint: fingerprint(password),
          payloadFingerprint: fingerprint(encoded),
          fields: Object.keys(parsed).sort()
        });
        break;
      } catch {
        // Wrong password or an IndexedDB suffix that is still attached.
      }
    }
  }
}

console.log(JSON.stringify({
  passwordCandidates: [...passwords].map(fingerprint),
  contractRecordCount: addressPositions.length,
  encryptedPayloadCount: encodedPayloads.size,
  recovered
}, null, 2));
