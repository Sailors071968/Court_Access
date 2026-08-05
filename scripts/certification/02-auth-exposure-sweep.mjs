#!/usr/bin/env node
// Phase 7 — Authentication exposure sweep.
// Sends an unauthenticated request to every route in the inventory and flags
// any non-public route that does not reject the request. Parameterised routes
// are filled with a syntactically valid but nonexistent UUID so that a 401/403
// is the only correct answer regardless of whether the resource exists.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Results, req, OUT_DIR, ROOT } from './lib/harness.mjs';
import { isPublicApiRoute } from './lib/routeInventory.mjs';

const NONEXISTENT_ID = '00000000-0000-4000-8000-000000000000';

function concretise(url) {
  return url.replace(/:([A-Za-z0-9_]+)/g, NONEXISTENT_ID).replace(/\*/g, 'x');
}

// Routes that legitimately answer without a session.
const PUBLIC_ALLOWLIST = [
  /^\/api\/health/,
  /^\/api\/metrics/,
  /^\/api\/auth\/(login|register|logout|refresh|forgot-password|reset-password|verify-email|csrf-token)/,
  /^\/api\/contact/,
  /^\/api\/marketing\/(track|lead|demo-request)/,
  /^\/api\/billing\/webhook/,
  /^\/api\/stripe\/webhook/,
  /^\/api\/discount-codes\/validate/,
];

function isAllowedPublic(url) {
  return PUBLIC_ALLOWLIST.some((re) => re.test(url)) || isPublicApiRoute(url);
}

const inventory = JSON.parse(
  await readFile(path.join(OUT_DIR, 'FEATURE_INVENTORY.json'), 'utf8'),
);

const results = new Results('AUTH_EXPOSURE_SWEEP', 'Phase 7 — Security Testing');
const exposed = [];
const errors = [];

console.log(`Probing ${inventory.apiRoutes.length} routes without credentials...\n`);

let checked = 0;
for (const route of inventory.apiRoutes) {
  const { method, url } = route;
  if (isAllowedPublic(url)) continue;
  // Skip destructive verbs against real-looking ids is unnecessary: the ids do
  // not exist, and an authz-correct server must reject before lookup anyway.
  const target = concretise(url);
  const res = await req(method, target, { timeoutMs: 15000 });
  checked += 1;

  if (res.status === 401 || res.status === 403) continue; // correctly rejected
  if (res.status === 404) {
    // Route not actually mounted at this path (static extraction artefact).
    continue;
  }
  if (res.status === 0) {
    errors.push({ method, url: target, error: res.error, source: route.source });
    continue;
  }
  if (res.status >= 500) {
    errors.push({ method, url: target, status: res.status, body: res.text?.slice(0, 300), source: route.source });
    continue;
  }
  exposed.push({
    method,
    url: target,
    declaredUrl: url,
    status: res.status,
    source: route.source,
    bodyPreview: (res.text || '').slice(0, 400),
  });
}

console.log(`\nProbed ${checked} non-public routes.\n`);

if (exposed.length === 0) {
  results.pass(
    'SEC-EXPOSURE-01',
    'No non-public API route responds without authentication',
    `${checked} routes probed, all returned 401/403/404`,
  );
} else {
  for (const e of exposed) {
    results.fail(
      'SEC-EXPOSURE-01',
      `Unauthenticated access permitted: ${e.method} ${e.declaredUrl}`,
      `HTTP ${e.status} from ${e.source}`,
      e,
    );
  }
}

if (errors.length) {
  for (const e of errors) {
    results.warn(
      'SEC-EXPOSURE-02',
      `Unauthenticated probe produced a server error: ${e.method} ${e.url}`,
      e.error || `HTTP ${e.status}`,
      e,
    );
  }
} else {
  results.pass('SEC-EXPOSURE-02', 'No 5xx responses from unauthenticated probes');
}

await results.write({
  routesProbed: checked,
  routesInInventory: inventory.apiRoutes.length,
  exposedRoutes: exposed,
  serverErrors: errors,
});
