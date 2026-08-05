// Extracts the API route table from backend source and the SPA route table
// from src/App.tsx. Used to build the certification feature inventory so that
// coverage is measured against the real code rather than a curated list.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      await walk(full, out);
    } else if (/\.(ts|mts|js|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// Matches app.get('/path', ...), fastify.post(`/path`, ...), server.route({ method, url })
const CALL_RE = new RegExp(
  String.raw`\b(?:app|fastify|server|instance)\s*\.\s*(${HTTP_METHODS.join('|')})\s*(?:<[^>]*>)?\s*\(\s*(['"\`])([^'"\`]+)\2`,
  'g',
);

const ROUTE_OBJ_RE =
  /\.route\s*\(\s*\{[^}]*?method\s*:\s*['"`]([A-Z]+)['"`][^}]*?url\s*:\s*['"`]([^'"`]+)['"`]/gs;

export async function collectApiRoutes(backendSrcDir) {
  const files = await walk(backendSrcDir);
  const routes = new Map();

  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const rel = path.relative(path.resolve(backendSrcDir, '../..'), file);

    for (const m of text.matchAll(CALL_RE)) {
      const method = m[1].toUpperCase();
      const url = m[3];
      if (!url.startsWith('/')) continue;
      const key = `${method} ${url}`;
      if (!routes.has(key)) routes.set(key, { method, url, source: rel });
    }

    for (const m of text.matchAll(ROUTE_OBJ_RE)) {
      const key = `${m[1].toUpperCase()} ${m[2]}`;
      if (!routes.has(key)) routes.set(key, { method: m[1].toUpperCase(), url: m[2], source: rel });
    }
  }

  return [...routes.values()].sort((a, b) => (a.url + a.method).localeCompare(b.url + b.method));
}

// <Route path="x" element={<Y />} /> — captures the path and the first
// component name inside the element, which is enough to attribute a page.
const SPA_ROUTE_RE = /<Route\s+([^>]*?)\/?>/gs;

export async function collectSpaRoutes(appTsxPath) {
  const text = await readFile(appTsxPath, 'utf8');
  const routes = [];
  for (const m of text.matchAll(SPA_ROUTE_RE)) {
    const attrs = m[1];
    const pathMatch = attrs.match(/\bpath\s*=\s*"([^"]*)"/);
    const indexMatch = /\bindex\b/.test(attrs);
    if (!pathMatch && !indexMatch) continue;
    const elementMatch = attrs.match(/element\s*=\s*\{\s*<\s*([A-Za-z0-9_]+)/);
    routes.push({
      path: pathMatch ? pathMatch[1] : '(index)',
      component: elementMatch ? elementMatch[1] : 'unknown',
    });
  }
  return routes;
}

export function isPublicApiRoute(url) {
  return (
    url.startsWith('/api/auth/login') ||
    url.startsWith('/api/auth/register') ||
    url.startsWith('/api/auth/forgot-password') ||
    url.startsWith('/api/auth/reset-password') ||
    url.startsWith('/api/auth/verify-email') ||
    url.startsWith('/api/auth/refresh') ||
    url.startsWith('/api/auth/csrf-token') ||
    url === '/api/health' ||
    url.startsWith('/api/health/') ||
    url.startsWith('/api/metrics') ||
    url.startsWith('/api/contact') ||
    url.startsWith('/api/marketing')
  );
}
