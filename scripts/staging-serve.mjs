// ============================================================================
// Staging static server + API reverse proxy (zero external deps).
// Serves the built frontend from dist/ and proxies /api/* to the backend.
// Usage: node scripts/staging-serve.mjs
//   PORT        (default 8080)         — port to listen on
//   API_TARGET  (default 127.0.0.1:3001) — backend host:port for /api proxy
// ============================================================================

import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = parseInt(process.env.PORT || '8080', 10);
const [API_HOST, API_PORT] = (process.env.API_TARGET || '127.0.0.1:3001').split(':');
const DIST = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json',
};

function proxyApi(req, res) {
  const proxyReq = http.request(
    { host: API_HOST, port: API_PORT, path: req.url, method: req.method, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad gateway to API', detail: err.message }));
  });
  req.pipe(proxyReq);
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = normalize(join(DIST, urlPath));
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  // SPA fallback: serve index.html for non-file routes.
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(DIST, 'index.html');
  }
  const type = MIME[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  if ((req.url || '').startsWith('/api')) return proxyApi(req, res);
  return serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[staging] serving ${DIST} on http://0.0.0.0:${PORT} (API -> ${API_HOST}:${API_PORT})`);
});
