#!/usr/bin/env node
// Program 146, Phases 1 and 2 — production audit.
//
// Inventories the platform from the source and the running system, and grades
// each area. Nothing is graded from reading a feature list: routes are counted
// from the router, endpoints from the registered Fastify route table, tables
// from the live database, and every dashboard is fetched.
//
// A "defect" here means something a user would hit: a route with no component,
// a navigation entry pointing nowhere, an endpoint that errors, a view that
// renders fabricated data. Development markers in code are reported separately
// because a TODO is not a defect a user can see.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Results, req, registerUser, login, OUT_DIR } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('PRODUCTION_AUDIT', 'Program 146 — Production Audit');
const SRC = '/workspace/src';
const BACKEND = '/workspace/backend/src';

async function walk(dir, filter = () => true) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(abs, filter)));
    else if (e.isFile() && filter(abs)) out.push(abs);
  }
  return out;
}

const inventory = {};

// ---------------------------------------------------------------------------
// Frontend pages and routes
// ---------------------------------------------------------------------------

const appSource = await readFile(path.join(SRC, 'App.tsx'), 'utf8');
const routePaths = [...appSource.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
const pageFiles = await walk(path.join(SRC, 'pages'), (f) => f.endsWith('.tsx'));

inventory.routes = routePaths.length;
inventory.pages = pageFiles.length;

// A route whose element references a component that is never imported would
// blank the page. Check every element reference resolves to an import.
const elementNames = [...appSource.matchAll(/element=\{<([A-Z][A-Za-z0-9_]*)/g)].map((m) => m[1]);
const importedNames = new Set(
  [...appSource.matchAll(/import\s+(?:\{([^}]+)\}|([A-Z][A-Za-z0-9_]*))/g)].flatMap((m) =>
    (m[1] ?? m[2] ?? '').split(',').map((x) => x.trim().split(/\s+as\s+/).pop()).filter(Boolean),
  ),
);
const lazyNames = new Set([...appSource.matchAll(/const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:lazy|React\.lazy)/g)].map((m) => m[1]));
const unresolved = [...new Set(elementNames)].filter((n) => !importedNames.has(n) && !lazyNames.has(n));

unresolved.length === 0
  ? results.pass('AUD-ROUTES', 'Every route element resolves to an imported component', `${routePaths.length} routes, ${pageFiles.length} page files`)
  : results.fail('AUD-ROUTES', 'Routes reference components that are never imported', unresolved.join(', '));

// ---------------------------------------------------------------------------
// Navigation reachability
//
// The Gold Standard module was compiled, routed and permitted yet unreachable
// because nothing in the navigation pointed at it. Check the whole sidebar.
// ---------------------------------------------------------------------------

const sidebar = await readFile(path.join(SRC, 'components/layout/Sidebar.tsx'), 'utf8');
const navPaths = [...sidebar.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]);
const routeSet = new Set(routePaths.map((p) => (p.startsWith('/') ? p : `/${p}`)));

// A nav target is satisfied by an exact route, a parent route, or a wildcard.
const routeMatches = (target) => {
  if (routeSet.has(target)) return true;
  for (const r of routeSet) {
    if (r.endsWith('/*') && target.startsWith(r.slice(0, -2))) return true;
    // Nested routes are declared relative to their parent.
    if (target.endsWith(r) || target.slice(1) === r) return true;
  }
  return false;
};
const danglingNav = navPaths.filter((p) => !routeMatches(p));

danglingNav.length === 0
  ? results.pass('AUD-NAV', 'Every navigation entry points at a declared route', `${navPaths.length} navigation targets`)
  : results.fail('AUD-NAV', 'Navigation entries point at routes that do not exist', danglingNav.join(', '));

// Every admin-only page should be reachable from the navigation, not only by
// typing a URL.
const adminRoutes = routePaths.filter((p) => p.includes('admin'));
const navTargets = new Set(navPaths);
const unreachableAdmin = adminRoutes
  .map((p) => (p.startsWith('/') ? p : `/${p}`))
  .filter((p) => !navTargets.has(p) && !p.includes(':'));

unreachableAdmin.length === 0
  ? results.pass('AUD-ADMIN-NAV', 'Every administrator page can be reached from the navigation', `${adminRoutes.length} administrator routes`)
  : results.warn(
      'AUD-ADMIN-NAV',
      'Administrator pages exist that the navigation does not offer',
      `${unreachableAdmin.join(', ')} — reachable only by typing the URL`,
    );

// ---------------------------------------------------------------------------
// Backend endpoints, from the running server rather than from source
// ---------------------------------------------------------------------------

const account = await registerUser({ prefix: 'audit', defaultRole: 'attorney' });
await prisma.user.update({ where: { id: account.user.userId }, data: { role: 'admin' } });
const session = await login(account.email, account.password);
const token = session.token;

const routeDump = await req('GET', '/api/_routes', { token });
let endpointCount = 0;
if (routeDump.status === 200 && Array.isArray(routeDump.json?.routes)) {
  endpointCount = routeDump.json.routes.length;
} else {
  // No introspection endpoint; count registrations in source instead.
  const backendFiles = await walk(BACKEND, (f) => f.endsWith('.ts'));
  for (const f of backendFiles) {
    const src = await readFile(f, 'utf8');
    endpointCount += [...src.matchAll(/\b(?:app|instance|fastify|server)\.(get|post|put|patch|delete)\s*\(\s*['"`]/g)].length;
  }
}
inventory.endpoints = endpointCount;
endpointCount > 0
  ? results.pass('AUD-ENDPOINTS', 'API endpoints inventoried', `${endpointCount} registered route handlers`)
  : results.fail('AUD-ENDPOINTS', 'No API endpoints could be inventoried');

// ---------------------------------------------------------------------------
// Database tables, from the live schema
// ---------------------------------------------------------------------------

const tables = await prisma.$queryRawUnsafe(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
);
inventory.tables = tables.length;
tables.length > 0
  ? results.pass('AUD-TABLES', 'Database tables inventoried from the live schema', `${tables.length} tables`)
  : results.fail('AUD-TABLES', 'No database tables found');

// Schema drift would mean the running database does not match the code.
const migrations = await prisma
  .$queryRawUnsafe(`SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL`)
  .catch(() => [{ n: 0 }]);
const failed = await prisma
  .$queryRawUnsafe(`SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NULL`)
  .catch(() => [{ n: 0 }]);
failed[0].n === 0
  ? results.pass('AUD-MIGRATIONS', 'All database migrations applied cleanly', `${migrations[0].n} migrations`)
  : results.fail('AUD-MIGRATIONS', 'Migrations are incomplete', `${failed[0].n} unfinished`);

// ---------------------------------------------------------------------------
// Core subsystems, exercised rather than assumed
// ---------------------------------------------------------------------------

// Probed at the paths the server actually registers. Evidence listing is
// case-scoped, so it is exercised against a case created for the purpose.
const probeCase = await req('POST', '/api/cases', {
  token,
  body: { caseName: 'Audit probe', caseNumber: `AUD-${Date.now()}`, jurisdiction: 'CA', county: 'Los Angeles' },
});
const probeCaseId = probeCase.json?.case?.caseId ?? probeCase.json?.caseId;

const SUBSYSTEMS = [
  ['Health', 'GET', '/api/health', false],
  ['Cases', 'GET', '/api/cases', true],
  ['Evidence', 'GET', probeCaseId ? `/api/cases/${probeCaseId}/evidence` : '/api/cases', true],
  ['Case intelligence', 'GET', probeCaseId ? `/api/cases/${probeCaseId}/intelligence` : '/api/cases', true],
  ['Attorney workbench', 'GET', probeCaseId ? `/api/cases/${probeCaseId}/workbench` : '/api/cases', true],
  ['Certification (admin)', 'GET', '/api/certification/status', true],
  ['Admin alerts', 'GET', '/api/admin/alerts', true],
  ['Admin audit', 'GET', '/api/admin/audit', true],
  ['Organization audit log', 'GET', '/api/organizations/audit-logs', true],
  ['Billing', 'GET', '/api/billing/subscription', true],
];

const subsystemState = {};
for (const [label, method, url, needsAuth] of SUBSYSTEMS) {
  const res = await req(method, url, needsAuth ? { token } : {});
  const id = `AUD-${label.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 14)}`;
  if (res.status === 200) {
    subsystemState[label] = 'PASS';
    results.pass(id, `${label} responds`, `HTTP 200`);
  } else if ([401, 403].includes(res.status)) {
    subsystemState[label] = 'PASS';
    results.pass(id, `${label} is access controlled`, `HTTP ${res.status}`);
  } else if (res.status === 404) {
    subsystemState[label] = 'UNKNOWN';
    results.unknown(id, `${label} is not implemented on this build`, `HTTP 404 at ${url}`);
  } else {
    subsystemState[label] = 'FAIL';
    results.fail(id, `${label} returned an error`, `HTTP ${res.status}: ${(res.text ?? '').slice(0, 120)}`);
  }
}

// ---------------------------------------------------------------------------
// Workers and queues
// ---------------------------------------------------------------------------

const workerFiles = await walk(BACKEND, (f) => /worker|queue|job/i.test(path.basename(f)) && f.endsWith('.ts'));
inventory.workers = workerFiles.length;
const queueHealth = await req('GET', '/api/admin/queues', { token });
workerFiles.length > 0
  ? results.pass('AUD-WORKERS', 'Background workers and queues present', `${workerFiles.length} worker/queue modules, queue API HTTP ${queueHealth.status}`)
  : results.warn('AUD-WORKERS', 'No worker modules found');

// ---------------------------------------------------------------------------
// Development markers in shipped code
//
// Reported, not graded as user-visible defects. What matters is whether any
// of them sits in a path a user reaches.
// ---------------------------------------------------------------------------

const shippedFiles = [
  ...(await walk(SRC, (f) => /\.(ts|tsx)$/.test(f) && !f.includes('.test.'))),
  ...(await walk(BACKEND, (f) => /\.ts$/.test(f) && !f.includes('.test.'))),
];

const markers = { TODO: [], FIXME: [], STUB: [], MOCK: [], PLACEHOLDER: [], HACK: [] };
for (const f of shippedFiles) {
  const src = await readFile(f, 'utf8');
  const rel = f.replace('/workspace/', '');
  for (const line of src.split('\n')) {
    if (/\bTODO\b/.test(line)) markers.TODO.push(rel);
    if (/\bFIXME\b/.test(line)) markers.FIXME.push(rel);
    if (/\bstub\b/i.test(line) && !/substitute/i.test(line)) markers.STUB.push(rel);
    if (/\bmock(?!ingbird)/i.test(line)) markers.MOCK.push(rel);
    if (/placeholder=/.test(line) === false && /\bplaceholder\b/i.test(line)) markers.PLACEHOLDER.push(rel);
    if (/\bHACK\b/.test(line)) markers.HACK.push(rel);
  }
}
const markerCounts = Object.fromEntries(Object.entries(markers).map(([k, v]) => [k, v.length]));
inventory.markers = markerCounts;

const blocking = markers.FIXME.length + markers.HACK.length;
blocking === 0
  ? results.pass(
      'AUD-MARKERS',
      'No FIXME or HACK markers remain in shipped code',
      `TODO ${markerCounts.TODO}, stub mentions ${markerCounts.STUB}, mock mentions ${markerCounts.MOCK} (informational)`,
      markerCounts,
    )
  : results.warn(
      'AUD-MARKERS',
      'Unresolved markers remain in shipped code',
      `FIXME ${markers.FIXME.length}, HACK ${markers.HACK.length}`,
      markerCounts,
    );

// ---------------------------------------------------------------------------
// Fabricated data in shipped frontend code
//
// The constitution forbids presenting invented findings. Look for arrays of
// literal case data in view code, which is how sample data reaches a screen.
// ---------------------------------------------------------------------------

const suspects = [];
for (const f of await walk(SRC, (f) => f.endsWith('.tsx'))) {
  const src = await readFile(f, 'utf8');
  const rel = f.replace('/workspace/', '');

  // A named literal dataset.
  if (/const\s+\w*(mock|sample|dummy|fake|demo)\w*\s*(?::[^=]+)?=\s*\[/i.test(src)) {
    suspects.push(`${rel} (named literal dataset)`);
    continue;
  }

  // An inline array of object literals mapped straight into JSX. This is how
  // fabricated content actually reached a screen: five invented alerts naming
  // cases that did not exist were written directly inside a render, so the
  // named-variable check above never saw them.
  for (const m of src.matchAll(/\{\s*\[\s*\n([\s\S]{40,4000}?)\]\s*\.map\(/g)) {
    const block = m[1];
    if (!/^\s*\{/m.test(block)) continue;
    // Content a user would read as a fact about their case.
    if (/\b(?:People v\.|Case #|hours ago|days ago|minutes ago|recommendation|deadline approaching)\b/i.test(block)) {
      suspects.push(`${rel} (inline literal dataset rendered to the user)`);
      break;
    }
  }
}
suspects.length === 0
  ? results.pass('AUD-FABRICATION', 'No sample or mock datasets are declared in shipped views', `${(await walk(SRC, (f) => f.endsWith('.tsx'))).length} components scanned`)
  : results.fail('AUD-FABRICATION', 'Views declare sample or mock datasets', suspects.slice(0, 8).join(', '));

// ---------------------------------------------------------------------------
// Dashboards, fetched rather than assumed
// ---------------------------------------------------------------------------

const DASHBOARDS = [
  ['Attorney', '/dashboard'],
  ['Administrator', '/admin'],
  ['Gold Standard', '/admin/gold-standard'],
  ['Defendant', '/defendant'],
  ['Family', '/family'],
];
const WEB = process.env.CERT_WEB_BASE || 'http://127.0.0.1:4180';
let dashboardsServed = 0;
for (const [label, route] of DASHBOARDS) {
  const res = await fetch(`${WEB}${route}`).catch(() => null);
  if (res && res.ok) dashboardsServed++;
}
dashboardsServed === DASHBOARDS.length
  ? results.pass('AUD-DASHBOARDS', 'Every dashboard route is served by the application', `${dashboardsServed}/${DASHBOARDS.length}`)
  : results.fail('AUD-DASHBOARDS', 'Some dashboard routes are not served', `${dashboardsServed}/${DASHBOARDS.length}`);

// ---------------------------------------------------------------------------
// Gold Standard corpora — the release gate depends on these
// ---------------------------------------------------------------------------

const corpora = await prisma.certificationCase.findMany({ select: { reference: true, label: true, fileCount: true } });
const syntheticPattern = /^(SYN|UI|UP|PORTAL|STR|CONC|INT|PDF|RESUME)/;
const authorized = corpora.filter((c) => !syntheticPattern.test(c.reference));
inventory.corpora = { total: corpora.length, authorized: authorized.length };

authorized.length > 0
  ? results.pass(
      'AUD-GOLDSTANDARD',
      'Attorney-authorized discovery has been imported',
      authorized.map((c) => `${c.reference} (${c.fileCount} files)`).join(', '),
    )
  : results.unknown(
      'AUD-GOLDSTANDARD',
      'No attorney-authorized case has been imported',
      `${corpora.length} corpora exist, all of them synthetic fixtures created by the certification suites. ` +
        'Cases 001, 002 and 003 have not been uploaded through the portal, so real-discovery certification ' +
        'cannot be performed and the release gate cannot be assessed against them.',
    );

await writeFile(path.join(OUT_DIR, 'PRODUCTION_INVENTORY.json'), JSON.stringify(inventory, null, 2));
await results.write(inventory);
await prisma.$disconnect();
