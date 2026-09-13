import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createQuietPatchServer } from './server.js';

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const testServer = createQuietPatchServer();
  await new Promise<void>((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const address = testServer.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => testServer.close((error?: Error) => error ? reject(error) : resolve()));
  }
}

test('reports service health', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, service: 'quietpatch-api', mode: 'memory' });
  });
});

test('stores ciphertext and restricts bundle reads to the maintainer role', async () => {
  await withServer(async (baseUrl) => {
    const upload = await fetch(`${baseUrl}/v1/reports`, {
      method: 'POST',
      headers: {
        'X-Demo-Role': 'researcher',
        'X-Bounty-Id': 'QP-BTY-001',
        'X-Report-Commitment': '0xcommitment'
      },
      body: new Uint8Array([1, 2, 3, 4])
    });
    assert.equal(upload.status, 201);
    const { reportId } = await upload.json() as { reportId: string };

    const observerRead = await fetch(`${baseUrl}/v1/reports/${reportId}`);
    assert.equal(observerRead.status, 403);

    const maintainerRead = await fetch(`${baseUrl}/v1/reports/${reportId}`, {
      headers: { 'X-Demo-Role': 'maintainer' }
    });
    assert.equal(maintainerRead.status, 200);
    assert.deepEqual(Array.from(new Uint8Array(await maintainerRead.arrayBuffer())), [1, 2, 3, 4]);
    assert.equal(maintainerRead.headers.get('X-Report-Commitment'), '0xcommitment');
  });
});

test('rejects a bundle without required headers', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/reports`, {
      method: 'POST',
      headers: { 'X-Demo-Role': 'researcher' },
      body: 'plain text'
    });
    assert.equal(response.status, 400);
  });
});

test('rejects uploads without a researcher session', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/reports`, {
      method: 'POST',
      headers: { 'X-Bounty-Id': 'QP-BTY-001', 'X-Report-Commitment': '0xcommitment' },
      body: new Uint8Array([1])
    });
    assert.equal(response.status, 403);
  });
});
