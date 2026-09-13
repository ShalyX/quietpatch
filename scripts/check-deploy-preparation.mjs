// Offline diagnostic: uses synthetic keys and never connects to a wallet or submits.
import { readFile } from 'node:fs/promises';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { sampleSigningKey, CostModel } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { createUnprovenDeployTxFromVerifierKeys } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract } from '../contract/src/managed/quietpatch/contract/index.js';

setNetworkId('undeployed');
const syntheticState = {
  maintainerSecretKey: new Uint8Array(32).fill(1),
  researcherSecretKey: new Uint8Array(32).fill(2),
  reportDigest: new Uint8Array(32), reportNonce: new Uint8Array(32), severity: 0n
};
const witnesses = Object.fromEntries([
  ['maintainerSecretKey', 'maintainerSecretKey'], ['researcherSecretKey', 'researcherSecretKey'],
  ['privateReportDigest', 'reportDigest'], ['privateReportNonce', 'reportNonce'], ['privateSeverity', 'severity']
].map(([name, field]) => [name, ctx => [ctx.privateState, ctx.privateState[field]]]));
const compiledContract = CompiledContract.withWitnesses(CompiledContract.make('quietpatch', Contract), witnesses);
const zk = new FetchZkConfigProvider('http://artifacts.invalid/', async url => {
  const file = new URL('../contract/src/managed/quietpatch/' + new URL(url).pathname.slice(1), import.meta.url);
  return new Response(await readFile(file));
});
let stage = 'constructor and verifier keys';
try {
  const data = await createUnprovenDeployTxFromVerifierKeys(zk, '00'.repeat(32), {
    compiledContract, signingKey: sampleSigningKey(), initialPrivateState: syntheticState
  }, '00'.repeat(32));
  console.log('PASS: constructor and verifier keys');
  stage = 'deployment proving';
  let requests = 0;
  const prover = new Proxy({}, { get: (_, name) => async () => {
    requests++;
    throw new Error(`Unexpected proving request: ${String(name)}`);
  }});
  const proven = await data.private.unprovenTx.prove(prover, CostModel.initialCostModel());
  console.log(`PASS: deployment proving; external prover requests: ${requests}; serialized bytes: ${proven.serialize().length}`);
} catch (error) {
  // Synthetic inputs only. Print error metadata, never the transaction or keys.
  console.error('FAIL:', stage);
  let current = error;
  for (let depth = 0; current && depth < 5; depth++, current = current.cause) {
    console.error({ name: current.name, tag: current._tag, message: current.message, stack: current.stack?.split('\n').slice(0, 5).join('\n') });
  }
  process.exitCode = 1;
}
