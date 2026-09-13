import assert from 'node:assert/strict';
import test from 'node:test';
import { bytes32FromText, createReportCommitment } from './crypto';

test('creates the Compact-compatible report commitment', () => {
  const commitment = createReportCommitment(
    bytes32FromText('QP-BTY-001'),
    new Uint8Array(32).fill(1),
    new Uint8Array(32).fill(2),
    4
  );

  assert.equal(
    commitment,
    '0x4f85413c20f39db624fd61b6288974f930cc77b54344457d2fa39a576dc88cc9'
  );
});

test('pads a short public identifier to Bytes<32>', () => {
  const value = bytes32FromText('QP-BTY-001');
  assert.equal(value.length, 32);
  assert.deepEqual(Array.from(value.slice(0, 10)), Array.from(new TextEncoder().encode('QP-BTY-001')));
  assert.ok(value.slice(10).every((byte) => byte === 0));
});
