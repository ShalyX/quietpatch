import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const port = Number(process.env.PORT ?? 8787);
const maxBodyBytes = 2 * 1024 * 1024;

type Bundle = {
  id: string;
  bountyId: string;
  commitment: string;
  submittedAt: string;
  bytes: Buffer;
};

const bundles = new Map<string, Bundle>();

function send(response: ServerResponse, status: number, body: unknown, contentType = 'application/json'): void {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Bounty-Id, X-Report-Commitment, X-Demo-Role',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  response.end(contentType === 'application/json' ? JSON.stringify(body) : body);
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) throw new Error('Bundle is larger than 2 MB.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export function createQuietPatchServer() {
  return createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    send(response, 204, '');
    return;
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/health') {
    send(response, 200, { ok: true, service: 'quietpatch-api', mode: 'memory' });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/v1/reports') {
    try {
      if (request.headers['x-demo-role'] !== 'researcher') {
        send(response, 403, { error: 'Only a researcher session may upload a bundle.' });
        return;
      }
      const bountyId = request.headers['x-bounty-id'];
      const commitment = request.headers['x-report-commitment'];
      if (typeof bountyId !== 'string' || typeof commitment !== 'string') {
        send(response, 400, { error: 'X-Bounty-Id and X-Report-Commitment are required.' });
        return;
      }
      const bytes = await readBody(request);
      const id = randomUUID();
      bundles.set(id, { id, bountyId, commitment, submittedAt: new Date().toISOString(), bytes });
      send(response, 201, { reportId: id });
    } catch (error) {
      send(response, 413, { error: error instanceof Error ? error.message : 'Could not store bundle.' });
    }
    return;
  }

  const match = url.pathname.match(/^\/v1\/reports\/([^/]+)$/);
  if (request.method === 'GET' && match) {
    if (request.headers['x-demo-role'] !== 'maintainer') {
      send(response, 403, { error: 'Only the maintainer session may retrieve a bundle.' });
      return;
    }
    const bundle = bundles.get(match[1]);
    if (!bundle) {
      send(response, 404, { error: 'Report bundle not found.' });
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': bundle.bytes.length,
      'X-Report-Commitment': bundle.commitment,
      'Access-Control-Allow-Origin': '*'
    });
    response.end(bundle.bytes);
    return;
  }

  send(response, 404, { error: 'Not found.' });
  });
}

export const server = createQuietPatchServer();

const entrypoint = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entrypoint === fileURLToPath(import.meta.url)) {
  server.listen(port, () => {
    console.log(`QuietPatch API listening on http://localhost:${port}`);
  });
}
