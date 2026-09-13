import assert from 'node:assert/strict';
import test from 'node:test';
import { observeProvider, type DeploymentStage } from './deploymentProgress';
import { safeMidnightErrorDetail } from './midnightErrorDetails';

test('stage observation preserves provider private fields and does not repeat a failed submission', async () => {
  let calls = 0;
  const stages: DeploymentStage[] = [];
  const failure = new Error('connection lost after submission');
  class Provider {
    #value = 7;
    read() { return this.#value; }
    async submit() { calls++; assert.equal(this.#value, 7); throw failure; }
  }
  const observed = observeProvider(new Provider(), { submit: 'submit' }, stage => stages.push(stage));
  assert.equal(observed.read(), 7);
  await assert.rejects(observed.submit(), error => error === failure);
  assert.equal(calls, 1);
  assert.deepEqual(stages, ['submit']);
});

test('recovers short messages from plain and wrapped wallet errors', () => {
  assert.equal(safeMidnightErrorDetail({ message: 'Wallet unavailable' }), 'Wallet unavailable');
  assert.equal(safeMidnightErrorDetail(new Error('', { cause: { message: 'Wallet unavailable' } })), 'Wallet unavailable');
  assert.match(safeMidnightErrorDetail({ name: 'OperationError', message: '' })!, /cryptographic operation/);
});

test('does not expose transaction payloads or recurse forever through cyclic causes', () => {
  assert.equal(safeMidnightErrorDetail({ message: 'tx: ' + 'ab'.repeat(128) }), undefined);
  assert.equal(safeMidnightErrorDetail({ message: 'x'.repeat(241) }), undefined);
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  assert.equal(safeMidnightErrorDetail(cyclic), undefined);
});
