import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const HOST = '127.0.0.1';
const PORT = 5088;
const MAX_BODY_BYTES = 256 * 1024;
const EMULATOR_ENDPOINT = 'http://127.0.0.1:5001/demo-leadflow/southamerica-east1/savwinDryRunMatch';

function readLocalToken() {
  const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const line = envFile.split(/\r?\n/).find((entry) => entry.startsWith('SAVWIN_N8N_HOMOLOG_TOKEN='));
  const token = line?.slice('SAVWIN_N8N_HOMOLOG_TOKEN='.length) || '';
  if (token.length < 32) throw new Error('Configure SAVWIN_N8N_HOMOLOG_TOKEN com pelo menos 32 caracteres em .env.');
  return token;
}

const expectedToken = readLocalToken();

function tokenMatches(value) {
  const provided = String(value || '');
  return provided.length === expectedToken.length
    && timingSafeEqual(Buffer.from(provided), Buffer.from(expectedToken));
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('payload_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/savwin-dry-run') {
    sendJson(response, 404, { ok: false, error: 'not_found' });
    return;
  }
  if (!tokenMatches(request.headers['x-leadflow-homolog-token'])) {
    sendJson(response, 401, { ok: false, error: 'invalid_homologation_token' });
    return;
  }

  try {
    const body = await readBody(request);
    const upstream = await fetch(EMULATOR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-leadflow-homolog-token': expectedToken
      },
      body,
      signal: AbortSignal.timeout(15_000)
    });
    response.writeHead(upstream.status, {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    const status = error?.message === 'payload_too_large' ? 413 : 502;
    sendJson(response, status, { ok: false, error: status === 413 ? 'payload_too_large' : 'emulator_unavailable' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`SavWin homologation gateway listening on http://${HOST}:${PORT}/savwin-dry-run`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
