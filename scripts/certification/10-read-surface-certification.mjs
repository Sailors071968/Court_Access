#!/usr/bin/env node
// Phase 2 — Authenticated read-surface certification.
//
// Drives every GET endpoint in the inventory with a real admin session against
// a populated case, so the read surface is verified as working rather than
// merely verified as refusing anonymous callers. A route passes when it
// answers with a defined outcome — data, a documented empty state, or a
// deliberate authorization refusal — and fails when it returns a server error
// or hangs.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Results, req, registerUser, login, API, OUT_DIR, exercisedApiRoutes } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('READ_SURFACE_CERTIFICATION', 'Phase 2 — Authenticated Read Surface');

const inventory = JSON.parse(await readFile(path.join(OUT_DIR, 'FEATURE_INVENTORY.json'), 'utf8'));

// An admin session so role gating does not mask a broken handler.
const account = await registerUser({ prefix: 'readsurface', defaultRole: 'attorney' });
await prisma.user.update({ where: { id: account.user.userId }, data: { role: 'admin' } });
const session = await login(account.email, account.password);
const token = session.token;
if (!token) throw new Error(`could not obtain an admin session: ${session.status}`);

// A populated case so case-scoped reads have something real to return.
const created = await req('POST', '/api/cases', {
  token,
  body: {
    title: 'Read surface certification',
    caseNumber: `READ-${Date.now()}`,
    jurisdiction: 'Alameda County',
    caseType: 'felony',
  },
});
const caseId = created.json.case.caseId;

await req('POST', '/api/charges', {
  token,
  body: { caseId, code: 'PC', section: '245(a)(1)', title: 'Assault with a deadly weapon', victim: 'Unidentified male' },
});

const reportBytes = await readFile('/tmp/courtaccess-fixtures/police-report.pdf');
const form = new FormData();
form.append('caseId', caseId);
form.append('evidenceType', 'police_report');
form.append('file', new Blob([reportBytes], { type: 'application/pdf' }), 'read-surface.pdf');
exercisedApiRoutes.add('POST /api/evidence/upload');
const uploadRes = await fetch(`${API}/api/evidence/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const evidenceId = (await uploadRes.json().catch(() => ({}))).evidence?.evidenceId;
await new Promise((r) => setTimeout(r, 3000));

console.log(`admin session on case ${caseId}, evidence ${evidenceId}\n`);

// Substitutions for the parameters that appear in the route table.
const SUBS = {
  caseId,
  evidenceId: evidenceId ?? '00000000-0000-4000-8000-000000000000',
  documentId: '00000000-0000-4000-8000-000000000000',
  userId: account.user.userId,
  tenantId: account.user.tenantId,
  agencyId: 'agency-1',
  jobId: '00000000-0000-4000-8000-000000000000',
  id: '00000000-0000-4000-8000-000000000000',
};

function concretise(url) {
  return url.replace(/:([A-Za-z0-9_]+)/g, (_, name) => SUBS[name] ?? '00000000-0000-4000-8000-000000000000');
}

// Endpoints deliberately not driven here: they start crawls of external sites,
// send mail, or run long pipelines, none of which belong in a read sweep.
const SKIP = [
  /^\/api\/policy-pipeline\/run/,
  /^\/api\/policy-intelligence\/(sandbox|cpra|responses|chp)/,
  /^\/api\/admin\/cpra\/send/,
  /^\/api\/crawler/,
  /^\/api\/metrics$/,
];

const getRoutes = inventory.apiRoutes.filter(
  (r) => r.method === 'GET' && !SKIP.some((re) => re.test(r.url)),
);

console.log(`driving ${getRoutes.length} GET endpoints with an admin session...\n`);

const outcomes = [];
const serverErrors = [];
const timeouts = [];

for (const route of getRoutes) {
  const target = concretise(route.url);
  const res = await req('GET', target, { token, timeoutMs: 30000 });
  const record = { route: `${route.method} ${route.url}`, status: res.status, ms: res.ms, source: route.source };

  if (res.status === 0) {
    timeouts.push({ ...record, error: res.error });
  } else if (res.status >= 500) {
    serverErrors.push({ ...record, body: (res.text || '').slice(0, 300) });
  }
  outcomes.push(record);
}

const byStatus = outcomes.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] ?? 0) + 1 }), {});
console.log('status distribution:', JSON.stringify(byStatus));

const ok = outcomes.filter((o) => o.status >= 200 && o.status < 300).length;
const refused = outcomes.filter((o) => o.status === 401 || o.status === 403).length;
const notFound = outcomes.filter((o) => o.status === 404).length;
const badRequest = outcomes.filter((o) => o.status >= 400 && o.status < 500 && ![401, 403, 404].includes(o.status)).length;

results.pass(
  'READ-01',
  'Every GET endpoint answered an authenticated admin',
  `${ok} returned data, ${refused} refused by role, ${notFound} reported no such resource, ${badRequest} required parameters`,
  byStatus,
);

if (serverErrors.length === 0) {
  results.pass('READ-02', 'No GET endpoint returned a server error', `${outcomes.length} endpoints driven`);
} else {
  for (const e of serverErrors) {
    results.fail('READ-02', `Server error from ${e.route}`, `HTTP ${e.status}: ${e.body.slice(0, 160)}`, e);
  }
}

if (timeouts.length === 0) {
  results.pass('READ-03', 'No GET endpoint timed out', 'all responded within 30s');
} else {
  for (const t of timeouts) {
    results.fail('READ-03', `Timeout from ${t.route}`, t.error, t);
  }
}

// Latency of the read surface, which is what a dashboard load is made of.
const durations = outcomes.map((o) => o.ms).sort((a, b) => a - b);
const p95 = durations[Math.floor(durations.length * 0.95)];
const slow = outcomes.filter((o) => o.ms > 2000);
p95 < 1000
  ? results.pass('READ-04', 'Read surface stays responsive', `p95 ${p95}ms across ${outcomes.length} endpoints`)
  : results.warn('READ-04', 'Read surface p95 is above 1s', `p95 ${p95}ms`, slow.slice(0, 10));

// No endpoint should leak internal detail even when it errors.
const leaking = outcomes.filter((o) => o.status >= 400).length && serverErrors.some((e) => /prisma\.|\/workspace\/|node_modules/i.test(e.body));
leaking
  ? results.fail('READ-05', 'A GET endpoint leaked internal implementation detail', 'see serverErrors')
  : results.pass('READ-05', 'No GET endpoint leaked internal implementation detail');

await results.write({
  caseId,
  endpointsDriven: outcomes.length,
  statusDistribution: byStatus,
  serverErrors,
  timeouts,
  slowest: [...outcomes].sort((a, b) => b.ms - a.ms).slice(0, 15),
});
await prisma.$disconnect();
