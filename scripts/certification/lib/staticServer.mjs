#!/usr/bin/env node
// Serves the built SPA and proxies /api to the backend, mirroring the nginx
// arrangement used in production so browser verification exercises the same
// same-origin setup the product ships with.

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = process.env.CERT_DIST || '/workspace/dist';
const API_TARGET = process.env.CERT_API_TARGET || 'http://127.0.0.1:3001';
const PORT = parseInt(process.env.CERT_WEB_PORT || '4180', 10);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api')) {
    const target = new URL(req.url, API_TARGET);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);

    const headers = { ...req.headers };
    delete headers.host;
    delete headers['content-length'];

    try {
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      });
      const buf = Buffer.from(await upstream.arrayBuffer());
      const out = {};
      upstream.headers.forEach((v, k) => {
        if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) out[k] = v;
      });
      res.writeHead(upstream.status, out);
      res.end(buf);
    } catch (err) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Upstream unavailable', detail: String(err) }));
    }
    return;
  }

  // Static assets, with SPA history fallback to index.html.
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(DIST, urlPath);
  if (!filePath.startsWith(DIST)) filePath = path.join(DIST, 'index.html');

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, 'index.html');
    await stat(filePath);
  } catch {
    filePath = path.join(DIST, 'index.html');
  }

  res.writeHead(200, { 'content-type': TYPES[path.extname(filePath)] ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[cert-web] serving ${DIST} on http://127.0.0.1:${PORT} (api -> ${API_TARGET})`);
});
