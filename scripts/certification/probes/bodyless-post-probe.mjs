#!/usr/bin/env node
// Counts how many mutating endpoints answer a request that carries no body
// with a 5xx instead of a validation error. Fastify leaves request.body
// undefined in that case, so handlers that destructure it throw.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { req, registerUser, OUT_DIR } from '../lib/harness.mjs';

const inventory = JSON.parse(await readFile(path.join(OUT_DIR, 'FEATURE_INVENTORY.json'), 'utf8'));
const { token } = await registerUser({ prefix: 'bodyless', defaultRole: 'admin' });
if (!token) throw new Error('could not register probe user');

const NONEXISTENT = '00000000-0000-4000-8000-000000000000';
const mutating = inventory.apiRoutes.filter((r) => ['POST', 'PUT', 'PATCH'].includes(r.method));

const crashed = [];
let probed = 0;
for (const r of mutating) {
  const url = r.url.replace(/:([A-Za-z0-9_]+)/g, NONEXISTENT);
  // No Content-Type and no body at all.
  const res = await req(r.method, url, { token, timeoutMs: 15000 });
  probed += 1;
  if (res.status >= 500) {
    crashed.push({
      route: `${r.method} ${r.url}`,
      status: res.status,
      message: res.json?.message || (res.text || '').slice(0, 160),
      source: r.source,
    });
  }
}

console.log(`probed ${probed} mutating routes with no request body`);
console.log(`${crashed.length} returned 5xx\n`);
for (const c of crashed.slice(0, 40)) {
  console.log(`  ${c.status} ${c.route}\n      ${c.message}`);
}
if (crashed.length > 40) console.log(`  ... and ${crashed.length - 40} more`);

const leaking = crashed.filter((c) => /Cannot read properties|undefined|is not a function|prisma\./i.test(c.message));
console.log(`\n${leaking.length} of those leak an internal error message to the client`);
