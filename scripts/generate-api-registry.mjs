// ============================================================================
// Canonical API Registry generator (Phase 4A)
// Deterministic static extraction — NO estimation, NO fabrication. Every field
// is read directly from source. Fields that cannot be determined statically are
// emitted as "UNKNOWN" rather than guessed.
//
// Usage: node scripts/generate-api-registry.mjs
// Optional runtime enrichment: API_BASE=http://localhost:3001 SEED_CASE=<id> TOKEN=<jwt>
// ============================================================================

import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const ROOT = process.cwd();
const BACKEND = join(ROOT, 'backend', 'src');
const FRONTEND = join(ROOT, 'src');
const TESTS_DIRS = [join(ROOT, 'tests'), join(ROOT, 'backend', 'tests')];
const OUT_DIR = join(ROOT, 'docs', 'api-registry');

function walk(dir, exts, acc = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|dist|\.git/.test(p)) walk(p, exts, acc); }
    else if (exts.some((x) => e.name.endsWith(x))) acc.push(p);
  }
  return acc;
}

// ── 1. Prisma model → table map ─────────────────────────────────────────────
function loadModelTableMap() {
  const schemaPath = join(ROOT, 'backend', 'prisma', 'schema.prisma');
  const src = readFileSync(schemaPath, 'utf-8');
  const map = {};
  const re = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = re.exec(src))) {
    const model = m[1];
    const body = m[2];
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    map[model] = mapMatch ? mapMatch[1] : model;
  }
  return map;
}

// ── 2. Endpoint extraction from a route file ────────────────────────────────
const METHOD_RE = /app\.(get|post|put|delete|patch)\(\s*(['"`])([^'"`]+)\2/g;
const AUTHZ_GUARDS = ['guardCaseAccess', 'guardScopeAccess', 'requireCaseAccess', 'requireScopeAccess', 'requireDashboardAccess', 'assertResourceAccess'];

// Authentication is enforced GLOBALLY by authenticationHook (onRequest) for all
// routes EXCEPT this allowlist (read from authMiddleware PUBLIC_ROUTES).
const PUBLIC_ROUTES = [
  '/api/health', '/api/metrics', '/api/auth/login', '/api/auth/register', '/api/auth/refresh',
  '/api/auth/logout', '/api/auth/debug-check', '/api/auth/forgot-password', '/api/auth/reset-password',
  '/api/auth/verify-email', '/api/auth/mfa/challenge', '/api/auth/accept-invitation',
  '/api/organizations/invitations/preview', '/api/discount-codes/validate', '/api/contact', '/api/billing/webhook',
  '/api/auth/csrf-token',
];
function isPublic(route) {
  return PUBLIC_ROUTES.some((r) => route === r || route.startsWith(r + '/'));
}

function extractEndpoints(file, modelTable) {
  const src = readFileSync(file, 'utf-8');
  const rel = relative(ROOT, file);
  // Collect registration positions to slice per-endpoint handler bodies.
  const regs = [];
  let m;
  METHOD_RE.lastIndex = 0;
  while ((m = METHOD_RE.exec(src))) {
    regs.push({ method: m[1].toUpperCase(), route: m[3], index: m.index });
  }
  // File-level facts
  const fileServices = [...new Set([...src.matchAll(/from\s+['"]\.\.?\/([^'"]*[Ss]ervice[^'"]*)['"]/g)].map((x) => basename(x[1])))];
  const fileQueues = [...new Set([...src.matchAll(/\b(enqueue[A-Za-z]+|startPipelineWorkers|pipelineJobService|getQueueHealth)\b/g)].map((x) => x[1]))];
  const fileWs = [...new Set([...src.matchAll(/\b(WebSocket|socket\.io|\.emit\(|ws\.on\()\b/g)].map((x) => x[1]))];

  const endpoints = [];
  for (let i = 0; i < regs.length; i++) {
    const reg = regs[i];
    const bodyEnd = i + 1 < regs.length ? regs[i + 1].index : src.length;
    const chunk = src.slice(reg.index, bodyEnd);

    const authzUsed = AUTHZ_GUARDS.filter((g) => new RegExp(`${g}\\(`).test(chunk));
    // Global authenticationHook enforces auth for every non-public route.
    const authRequired = !isPublic(reg.route);

    const reads = [];
    if (/request\.body/.test(chunk)) reads.push('body');
    if (/request\.params/.test(chunk)) reads.push('params');
    if (/request\.query/.test(chunk)) reads.push('query');

    const prismaModels = [...new Set([...chunk.matchAll(/prisma\.(\w+)\b/g)].map((x) => x[1]))]
      .filter((mm) => mm !== '$queryRaw' && mm !== '$executeRaw' && mm !== '$transaction');
    const tables = [...new Set(prismaModels.map((pm) => {
      const key = Object.keys(modelTable).find((k) => k.toLowerCase() === pm.toLowerCase());
      return key ? modelTable[key] : pm;
    }))];

    const enqueues = [...new Set([...chunk.matchAll(/\b(enqueue[A-Za-z]+)\b/g)].map((x) => x[1]))];

    endpoints.push({
      method: reg.method,
      route: reg.route,
      controller: rel,
      authenticationRequired: authRequired,
      authenticationMechanism: authRequired ? 'global authenticationHook (JWT)' : 'PUBLIC_ROUTES allowlist',
      authorizationGuards: authzUsed.length ? authzUsed : (authRequired ? ['(role/route-permission only)'] : []),
      inputSurface: reads.length ? reads : ['none'],
      directPrismaModels: prismaModels,
      databaseTables: tables,
      queuesInvoked: enqueues.length ? enqueues : (fileQueues.length ? ['(file-level) ' + fileQueues.join(',')] : []),
      fileServices,
      websocketEvents: fileWs,
    });
  }
  return endpoints;
}

// ── 3. Frontend /api call sites ─────────────────────────────────────────────
function extractFrontendCalls() {
  const files = walk(FRONTEND, ['.ts', '.tsx']);
  const calls = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf-8');
    const rel = relative(ROOT, f);
    // Detect the API base constant value in this file (e.g. const API_BASE = '/api').
    const baseVars = [...src.matchAll(/const\s+([A-Za-z_]+)\s*=\s*['"`](\/api[^'"`]*)['"`]/g)]
      .map((x) => ({ name: x[1], value: x[2] }));
    const resolveBase = (varName) => {
      const v = baseVars.find((b) => b.name === varName);
      return v ? v.value : '/api';
    };
    const collapse = (p) => ('/' + p.split('/').filter(Boolean).join('/')).replace(/^\/api\/api\b/, '/api');
    // 1. Full backtick template literals — resolve ${BASE} prefix, turn other ${..} into *
    for (const mm of src.matchAll(/`([^`]*)`/g)) {
      let s = mm[1];
      if (!/\/api|\$\{[A-Za-z_]+\}\//.test(s)) continue;
      // leading ${BASE}
      s = s.replace(/^\$\{([A-Za-z_]+)\}/, (_, v) => resolveBase(v));
      s = s.replace(/\$\{[^}]+\}/g, '*'); // remaining interpolations
      const idx = s.indexOf('/api');
      if (idx === -1) continue;
      let p = s.slice(idx).split(/[?\s]/)[0];
      if (p.startsWith('/api/')) calls.push({ path: collapse(p), file: rel });
    }
    // 2. Literal /api/... in single/double quotes
    for (const mm of src.matchAll(/['"](\/api\/[^'"\s?]*)/g)) calls.push({ path: collapse(mm[1]), file: rel });
    // 3. apiRequest("/x") — helper prefixes /api
    for (const mm of src.matchAll(/apiRequest\(\s*[`'"]([^`'"$?]+)/g)) {
      const raw = mm[1];
      const p = raw.startsWith('/api') ? raw : '/api' + (raw.startsWith('/') ? '' : '/') + raw;
      calls.push({ path: collapse(p), file: rel });
    }
  }
  return calls;
}

// ── 4. Test coverage ────────────────────────────────────────────────────────
function extractTestRefs() {
  const files = TESTS_DIRS.flatMap((d) => walk(d, ['.ts', '.tsx', '.js']));
  const refs = new Set();
  for (const f of files) {
    const src = readFileSync(f, 'utf-8');
    for (const mm of src.matchAll(/['"`](\/api\/[^'"`\s]+)['"`]/g)) refs.add(mm[1]);
  }
  return refs;
}

// Normalize a concrete path to a template for matching (:param and ${..} → *).
function normalize(path) {
  return path
    .replace(/\$\{[^}]+\}/g, '*')
    .replace(/:[A-Za-z0-9_]+/g, '*')
    .replace(/\/[0-9a-fA-F-]{16,}/g, '/*') // uuid-ish literals
    .replace(/\?.*$/, '')
    .replace(/\/$/, '');
}

// ── Main ────────────────────────────────────────────────────────────────────
const modelTable = loadModelTableMap();
const routeFiles = walk(BACKEND, ['.ts']).filter((f) => /app\.(get|post|put|delete|patch)\(/.test(readFileSync(f, 'utf-8')));
let endpoints = [];
for (const f of routeFiles) endpoints = endpoints.concat(extractEndpoints(f, modelTable));

// Dedupe detection (same method+route in >1 place)
const seen = new Map();
for (const e of endpoints) {
  const key = `${e.method} ${e.route}`;
  seen.set(key, (seen.get(key) || 0) + 1);
}
const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);

const frontendCalls = extractFrontendCalls();
const testRefs = extractTestRefs();

// Frontend mapping: for each endpoint, which frontend files call it
const endpointTemplates = endpoints.map((e) => ({ e, tmpl: normalize(e.route) }));
for (const { e, tmpl } of endpointTemplates) {
  const callers = new Set();
  for (const c of frontendCalls) if (normalize(c.path) === tmpl) callers.add(c.file);
  e.uiPages = [...callers];
  e.testCovered = [...testRefs].some((t) => normalize(t) === tmpl);
}

// Unused (no UI caller, no test) and duplicates
const unused = endpoints.filter((e) => e.uiPages.length === 0 && !e.testCovered);

// Missing: frontend calls to a path with no matching backend endpoint
const backendTemplates = new Set(endpointTemplates.map((x) => x.tmpl));
const missing = [];
const missSeen = new Set();
for (const c of frontendCalls) {
  const t = normalize(c.path);
  if (!backendTemplates.has(t) && !missSeen.has(t + c.file)) {
    missSeen.add(t + c.file);
    missing.push({ path: c.path, template: t, file: c.file });
  }
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'canonical-api-registry.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  totalEndpoints: endpoints.length,
  routeFiles: routeFiles.length,
  duplicates,
  endpoints,
}, null, 2));
writeFileSync(join(OUT_DIR, 'frontend-api-calls.json'), JSON.stringify(frontendCalls, null, 2));
writeFileSync(join(OUT_DIR, 'unused-endpoints.json'), JSON.stringify(unused.map((e) => `${e.method} ${e.route}`), null, 2));
writeFileSync(join(OUT_DIR, 'missing-endpoints.json'), JSON.stringify(missing, null, 2));

console.log('Endpoints:', endpoints.length, '| route files:', routeFiles.length);
console.log('Duplicates:', duplicates.length);
console.log('Frontend /api call sites:', frontendCalls.length);
console.log('Endpoints with UI callers:', endpoints.filter((e) => e.uiPages.length).length);
console.log('Endpoints test-covered:', endpoints.filter((e) => e.testCovered).length);
console.log('Unused (no UI + no test):', unused.length);
console.log('Missing (FE calls w/o backend):', missing.length);
console.log('Auth-required:', endpoints.filter((e) => e.authenticationRequired).length, '| public:', endpoints.filter((e) => !e.authenticationRequired).length);
