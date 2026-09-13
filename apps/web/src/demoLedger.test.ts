import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acceptReport,
  claimPayout,
  createInitialState,
  disclose,
  initialState,
  rejectReport,
  submitReport
} from './demoLedger';

const proof = {
  commitment: '0xreport-commitment',
  reportDigest: 'report-digest',
  severity: 4 as const,
  submittedAt: '2026-09-02T20:00:00.000Z'
};

const bundle = {
  iv: 'iv',
  ciphertext: 'ciphertext',
  reportDigest: proof.reportDigest,
  commitment: proof.commitment,
  submittedAt: proof.submittedAt
};

test('creates a fresh synthetic bounty when the local demo is reset', () => {
  const now = Date.parse('2026-09-08T00:00:00.000Z');
  const state = createInitialState(now);
  assert.equal(state.report, null);
  assert.equal(state.bundle, null);
  assert.equal(state.bounty.deadline, '2026-09-11T00:00:00.000Z');
});

test('accepts a report that meets the bounty threshold', () => {
  const submitted = submitReport(initialState, proof, bundle);
  assert.equal(submitted.report?.status, 'SUBMITTED');
  assert.equal(submitted.report?.severityPass, true);
  assert.equal(submitted.bundle?.ciphertext, 'ciphertext');
});

test('rejects a report below the private severity threshold', () => {
  assert.throws(
    () => submitReport(initialState, { ...proof, severity: 3 }, bundle),
    /below this bounty threshold/
  );
});

test('prevents a second report for the demo bounty', () => {
  const submitted = submitReport(initialState, proof, bundle);
  assert.throws(() => submitReport(submitted, proof, bundle), /already has a report/);
});

test('moves an accepted report through payout and disclosure', () => {
  const submitted = submitReport(initialState, proof, bundle);
  const accepted = acceptReport(submitted);
  const paid = claimPayout(accepted);
  const disclosed = disclose(paid, 'Fixed in version 0.1.1.');
  assert.equal(disclosed.report?.status, 'DISCLOSED');
  assert.ok(disclosed.report?.payoutClaimedAt);
  assert.equal(disclosed.report?.disclosureSummary, 'Fixed in version 0.1.1.');
});

test('rejected reports cannot be paid', () => {
  const submitted = submitReport(initialState, proof, bundle);
  const rejected = rejectReport(submitted);
  assert.equal(rejected.report?.status, 'REJECTED');
  assert.throws(() => claimPayout(rejected), /Only accepted reports can be paid/);
});

test('a report cannot be paid twice', () => {
  const submitted = submitReport(initialState, proof, bundle);
  const paid = claimPayout(acceptReport(submitted));
  assert.throws(() => claimPayout(paid), /Only accepted reports can be paid/);
});
