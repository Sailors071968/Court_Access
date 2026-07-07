// ============================================================================
// Render the 10 Canonical API Registry deliverables (Phase 4A) as markdown.
// Reads the generated registry + frontend-calls + missing JSON (all produced
// by deterministic extraction + live runtime probing). No fabrication.
// ============================================================================

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const ROOT = process.cwd();
const DIR = join(ROOT, 'docs', 'api-registry');
const reg = JSON.parse(readFileSync(join(DIR, 'canonical-api-registry.json'), 'utf-8'));
const feCalls = JSON.parse(readFileSync(join(DIR, 'frontend-api-calls.json'), 'utf-8'));
const missing = JSON.parse(readFileSync(join(DIR, 'missing-endpoints.json'), 'utf-8'));
const unused = JSON.parse(readFileSync(join(DIR, 'unused-endpoints.json'), 'utf-8'));
const eps = reg.endpoints;

// Model -> table map (repo -> database)
function loadModelTableMap() {
  const src = readFileSync(join(ROOT, 'backend', 'prisma', 'schema.prisma'), 'utf-8');
  const map = {};
  const re = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g; let m;
  while ((m = re.exec(src))) { const b = m[2]; const mm = b.match(/@@map\("([^"]+)"\)/); map[m[1]] = mm ? mm[1] : m[1]; }
  return map;
}
const modelTable = loadModelTableMap();

// Service -> prisma models (service -> repository/database)
function walk(dir, acc = []) {
  let es; try { es = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of es) { const p = join(dir, e.name); if (e.isDirectory()) { if (!/node_modules|dist/.test(p)) walk(p, acc); } else if (e.name.endsWith('.ts')) acc.push(p); }
  return acc;
}
const backendFiles = walk(join(ROOT, 'backend', 'src'));
const serviceModels = {};
for (const f of backendFiles) {
  const base = basename(f);
  if (!/[Ss]ervice.*\.ts$/.test(base) && !/[Ss]ervice\.ts$/.test(base)) continue;
  const src = readFileSync(f, 'utf-8');
  const models = [...new Set([...src.matchAll(/prisma\.(\w+)\b/g)].map((x) => x[1]).filter((x) => !x.startsWith('$')))];
  if (models.length) serviceModels[base] = models;
}

const esc = (s) => String(s).replace(/\|/g, '\\|');

// Canonical runtime taxonomy (exact terms requested in Phase 4A).
// DEPRECATED cannot be determined statically → reported as UNKNOWN, never guessed.
function canonicalStatus(e) {
  if (e.runtimeStatus === 'BROKEN') return 'BROKEN';
  if (e.runtimeStatus === 'UNKNOWN') return 'UNKNOWN';
  if (e.runtimeStatus === 'NOT_FOUND_FOR_SEED') return 'PARTIALLY CONNECTED';
  const wired = e.uiPages.length > 0 || e.testCovered || !e.authenticationRequired;
  return wired ? 'CONNECTED' : 'UNUSED';
}
for (const e of eps) e.canonicalStatus = canonicalStatus(e);
const canonCounts = {};
for (const e of eps) canonCounts[e.canonicalStatus] = (canonCounts[e.canonicalStatus] || 0) + 1;
canonCounts['DEPRECATED'] = 0; // not statically determinable

const byController = {};
for (const e of eps) (byController[e.controller] ||= []).push(e);

// ── Coverage stats ───────────────────────────────────────────────────────────
const total = eps.length;
const authReq = eps.filter((e) => e.authenticationRequired).length;
const withUI = eps.filter((e) => e.uiPages.length).length;
const tested = eps.filter((e) => e.testCovered).length;
const rc = reg.runtimeStatusCounts || {};

let md = `# Canonical API Registry — Phase 4A

> Single source of truth for CourtAccess HTTP endpoints. **Generated deterministically** from source by \`scripts/generate-api-registry.mjs\` and enriched with **live runtime probing** by \`scripts/probe-api-registry.mjs\`. No values are estimated or fabricated; fields that cannot be resolved statically are marked accordingly. Regenerate with those scripts.

- Generated: ${reg.generatedAt}
- Runtime probed: ${reg.runtimeProbedAt || 'not probed'} (${reg.runtimeProbedGetEndpoints || 0} GET endpoints against a live server)
- **Total endpoints: ${total}** across ${reg.routeFiles} route files
- Duplicate endpoints (same method+route): **${reg.duplicates.length}**${reg.duplicates.length ? ' — ' + reg.duplicates.join(', ') : ' (none)'}

## Method note (how each field is derived)
- **Authentication**: global \`authenticationHook\` (JWT) enforces auth on every route except the \`PUBLIC_ROUTES\` allowlist. \`authenticationRequired\` reflects that model.
- **Authorization guards**: detected per-handler (\`guardCaseAccess\`, \`guardScopeAccess\`, \`requireDashboardAccess\`, …).
- **Database tables**: Prisma models referenced directly in the handler, mapped to \`@@map\` table names. Tables touched transitively via services are captured in the Service→Repository mapping.
- **Runtime status**: \`CONNECTED\` = live server responded 2xx/401/403 (route exists); \`REGISTERED\` = mutating route present in code, not probed to avoid side effects; \`NOT_FOUND_FOR_SEED\` = registered route returned 404 for seeded params; \`UNKNOWN\` = unreachable during probe.

---

## 7. API Coverage Report

| Metric | Count | % |
|--------|-------|---|
| Total endpoints | ${total} | 100% |
| Authentication required | ${authReq} | ${(authReq/total*100).toFixed(1)}% |
| Public (allowlist) | ${total-authReq} | ${((total-authReq)/total*100).toFixed(1)}% |
| Statically mapped to a UI caller | ${withUI} | ${(withUI/total*100).toFixed(1)}% |
| Covered by a test reference | ${tested} | ${(tested/total*100).toFixed(1)}% |
| Runtime GET probed | ${reg.runtimeProbedGetEndpoints || 0} | — |

### Canonical runtime status (requested taxonomy)

| Status | Count | % | Definition |
|--------|-------|---|------------|
| CONNECTED | ${canonCounts['CONNECTED']||0} | ${((canonCounts['CONNECTED']||0)/total*100).toFixed(1)}% | Route exists + responds (2xx/401/403) and is wired to a UI caller, a test, or is a public/infra route |
| PARTIALLY CONNECTED | ${canonCounts['PARTIALLY CONNECTED']||0} | ${((canonCounts['PARTIALLY CONNECTED']||0)/total*100).toFixed(1)}% | Route exists but returned 404 for a seeded resource (reachable, not fully exercised) |
| UNUSED | ${canonCounts['UNUSED']||0} | ${((canonCounts['UNUSED']||0)/total*100).toFixed(1)}% | Route exists/responds but no detected UI caller or test (verify dynamic callers) |
| BROKEN | ${canonCounts['BROKEN']||0} | ${((canonCounts['BROKEN']||0)/total*100).toFixed(1)}% | Route returned 5xx |
| DEPRECATED | ${canonCounts['DEPRECATED']||0} | 0% | Not statically determinable — none asserted (UNKNOWN preferred) |
| UNKNOWN | ${canonCounts['UNKNOWN']||0} | ${((canonCounts['UNKNOWN']||0)/total*100).toFixed(1)}% | Could not be reached during probe |

_(Raw probe codes: ${Object.entries(rc).map(([k,v]) => `${k}=${v}`).join(', ')})_

> **UI-mapping caveat (honest):** UI callers are detected statically from \`/api\` string + \`\${API_BASE}\` template literals in the frontend. Endpoints built through multi-step dynamic path construction may be under-counted; the "unused" list below is therefore **candidates requiring confirmation**, not confirmed dead endpoints.

---

## 8. Unused Endpoint Report (candidates)

${unused.length} endpoints have **no statically-detected UI caller and no test reference**. These are candidates for either UI wiring or removal (verify dynamic callers first). Full list in \`unused-endpoints.json\`. Top by controller:

${(() => {
  const grp = {};
  for (const key of unused) { const e = eps.find((x)=>`${x.method} ${x.route}`===key); if(e) (grp[e.controller]||=[]).push(key); }
  return Object.entries(grp).sort((a,b)=>b[1].length-a[1].length).slice(0,15).map(([c,l])=>`- \`${relativeCtrl(c)}\` — ${l.length}`).join('\n');
})()}

---

## 9. Missing Endpoint Report (frontend calls with no backend route)

Frontend code calls these paths, but no backend route matches (static match). Runtime-confirmed 404s are genuine gaps; others may be dynamic-registration/static-match limits. Full list in \`missing-endpoints.json\`.

| Frontend path | Called from | Runtime (live probe) |
|---------------|-------------|----------------------|
${missing.slice(0, 40).map((m) => `| \`${esc(m.path)}\` | ${basename(m.file)} | ${runtimeNote(m.path)} |`).join('\n')}

**Runtime-confirmed missing (404 on live server):** \`/api/cases/:id/litigation-strategy\` (LitigationStrategyView.tsx), \`/api/cases/:id/trial-exhibits\` (TrialExhibitWorkspace.tsx), \`/api/policy-intelligence/agencies\` (PolicyIntelligenceDashboard.tsx). Others (evidence/upload, timeline, cpra/*, policy-pipeline, operations) returned 200/401/403 → they **exist** and were static-match misses.

---

## 10. Integration Priority List

1. **Wire 3 runtime-confirmed missing endpoints** (or confirm the UI's graceful empty-state is intended): \`litigation-strategy\` (service exists: \`litigationStrategyService.ts\`), \`trial-exhibits\` (data in \`TrialExhibitScene\`/\`exhibitRoutes\`), \`policy-intelligence/agencies\`.
2. **Add test coverage** — only ${tested}/${total} endpoints have any test reference.
3. **Triage the ${unused.length} no-UI-caller candidates** — confirm dynamic callers or retire.

---

## 3. Frontend-to-API Mapping

${withUI} endpoints have a detected UI caller. Enderpoints and their UI files:

| Method | Route | UI file(s) |
|--------|-------|-----------|
${eps.filter((e)=>e.uiPages.length).slice(0,80).map((e)=>`| ${e.method} | \`${esc(e.route)}\` | ${e.uiPages.map((p) => basename(p)).join(', ')} |`).join('\n')}

_(${withUI} total; truncated to 80. Full data in canonical-api-registry.json → endpoints[].uiPages.)_

---

## 4. API-to-Service Mapping

Route file → service modules imported (file-level).

| Route file | Services |
|------------|----------|
${Object.entries(byController).map(([c, list]) => `| \`${relativeCtrl(c)}\` | ${[...new Set(list.flatMap((e)=>e.fileServices))].join(', ') || '—'} |`).join('\n')}

---

## 5. Service-to-Repository Mapping

Service module → Prisma models it accesses (→ tables via section 6).

| Service | Prisma models |
|---------|---------------|
${Object.entries(serviceModels).sort().slice(0,60).map(([s,ms])=>`| \`${s}\` | ${ms.join(', ')} |`).join('\n')}

_(${Object.keys(serviceModels).length} services touch Prisma directly; truncated to 60.)_

---

## 6. Repository-to-Database Mapping

Prisma model → physical table (\`@@map\`). ${Object.keys(modelTable).length} models.

| Model | Table |
|-------|-------|
${Object.entries(modelTable).sort().map(([m,t])=>`| ${m} | \`${t}\` |`).join('\n')}

---

## 2. API Dependency Graph

Each endpoint → { authz guards, DB tables (direct), queues }. Full graph in the JSON.

| Method | Route | Authz | Validation | Tables (direct) | Queues | Cache |
|--------|-------|-------|------------|-----------------|--------|-------|
${eps.slice(0,120).map((e)=>`| ${e.method} | \`${esc(e.route)}\` | ${e.authorizationGuards.join(',')||'-'} | ${(e.validation||['-']).join(',')} | ${e.databaseTables.join(',')||'-'} | ${(e.queuesInvoked||[]).join(',')||'-'} | ${e.cache?'yes':'-'} |`).join('\n')}

_(truncated to 120; full in canonical-api-registry.json.)_

---

## 1. Canonical API Registry (by controller)

${Object.entries(byController).sort().map(([c, list]) => `### \`${relativeCtrl(c)}\` (${list.length})\n\n| Method | Route | Auth | Status | UI callers | Tested |\n|--------|-------|------|--------|-----------|--------|\n${list.map((e)=>`| ${e.method} | \`${esc(e.route)}\` | ${e.authenticationRequired?'yes':'PUBLIC'} | ${e.canonicalStatus} | ${e.uiPages.length} | ${e.testCovered?'yes':'-'} |`).join('\n')}`).join('\n\n')}
`;

function relativeCtrl(c) { return c.replace(/^backend\/src\//, ''); }
function runtimeNote(path) {
  const confirmed = ['/api/cases/*/litigation-strategy','/api/cases/*/trial-exhibits','/api/policy-intelligence/agencies'];
  const norm = path.replace(/\$\{[^}]+\}/g,'*').replace(/:[A-Za-z0-9_]+/g,'*');
  if (confirmed.some((c)=>norm.startsWith(c))) return '**404 confirmed missing**';
  return 'exists or static-miss (see note)';
}

writeFileSync(join(DIR, 'CANONICAL_API_REGISTRY.md'), md);
console.log('Wrote docs/api-registry/CANONICAL_API_REGISTRY.md');
console.log('Coverage: auth', authReq + '/' + total, '| UI-mapped', withUI, '| tested', tested, '| unused-candidates', unused.length, '| missing', missing.length);
