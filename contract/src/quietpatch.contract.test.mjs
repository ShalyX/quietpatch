import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./quietpatch.compact', import.meta.url), 'utf8');

function circuit(name) {
  const start = source.indexOf(`export circuit ${name}`);
  assert.notEqual(start, -1, `missing ${name} circuit`);
  const next = source.indexOf('\nexport circuit ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test('keeps maintainer and researcher authorities on separate witnesses', () => {
  assert.match(source, /witness maintainerSecretKey\(\): Bytes<32>;/);
  assert.match(source, /witness researcherSecretKey\(\): Bytes<32>;/);
  assert.doesNotMatch(source, /witness localSecretKey\(\)/);

  assert.match(circuit('createBounty'), /maintainerSecretKey\(\)/);
  assert.match(circuit('acceptReport'), /maintainerSecretKey\(\)/);
  assert.match(circuit('rejectReport'), /maintainerSecretKey\(\)/);
  assert.match(circuit('submitReport'), /researcherSecretKey\(\)/);
  assert.match(circuit('claimPayout'), /researcherSecretKey\(\)/);
});

test('does not let a maintainer identity satisfy the researcher claim check', () => {
  const claim = circuit('claimPayout');
  assert.match(claim, /reportResearcher == derivePublicKey\(researcherSecretKey\(\), reportCommitment\)/);
  assert.doesNotMatch(claim, /derivePublicKey\(maintainerSecretKey\(\), reportCommitment\)/);
});
