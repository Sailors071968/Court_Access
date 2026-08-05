#!/usr/bin/env node
// Phase 12 — Master production certification report.
//
// Rolls the individual suite reports up into one product-readiness statement.
// It only reports what the suites measured: any feature in the inventory that
// no suite exercised is marked UNKNOWN rather than assumed to work.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OUT_DIR, ROOT } from './lib/harness.mjs';

const exec = promisify(execFile);

const SUITES = [
  ['AUTH_EXPOSURE_SWEEP', 'Unauthenticated exposure sweep', 'Phase 7'],
  ['SECURITY_CERTIFICATION', 'Security', 'Phase 7'],
  ['INGESTION_CERTIFICATION', 'Document, media and failure handling', 'Phase 3/4/5'],
  ['READ_SURFACE_CERTIFICATION', 'Authenticated read surface', 'Phase 2'],
  ['WORKFLOW_CERTIFICATION', 'Litigation workflow and data integrity', 'Phase 2/8'],
  ['STRESS_CERTIFICATION', 'Stress and performance', 'Phase 6/11'],
  ['RECOVERY_CERTIFICATION', 'Recovery', 'Phase 10'],
  ['BROWSER_CERTIFICATION', 'Browser verification', 'Phase 9'],
];

async function loadJson(name) {
  try {
    return JSON.parse(await readFile(path.join(OUT_DIR, `${name}.json`), 'utf8'));
  } catch {
    return null;
  }
}

const inventory = await loadJson('FEATURE_INVENTORY');
const loaded = [];
for (const [file, label, phase] of SUITES) {
  const data = await loadJson(file);
  if (data) loaded.push({ file, label, phase, data });
}

const totals = { PASS: 0, FAIL: 0, WARNING: 0, UNKNOWN: 0, total: 0 };
for (const s of loaded) {
  for (const k of ['PASS', 'FAIL', 'WARNING', 'UNKNOWN']) totals[k] += s.data.summary[k] ?? 0;
  totals.total += s.data.summary.total ?? 0;
}

// ---------------------------------------------------------------------------
// Feature-level verdicts
//
// A feature counts as exercised when a check in some suite touched one of its
// routes or pages. Anything untouched stays UNKNOWN.
// ---------------------------------------------------------------------------

const allChecks = loaded.flatMap((s) => s.data.checks.map((c) => ({ ...c, suite: s.label })));

// Attribution is by route, not by prose. Each suite records the API paths it
// requested and the SPA paths it navigated to, with ids collapsed to :id.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const canonical = (p) => p.replace(UUID_RE, ':id').replace(/:[A-Za-z][A-Za-z0-9_]*/g, ':id');

// Being probed for a 401 proves authorization, not that the feature works, so
// the exposure sweep's routes are tracked separately and never counted as
// functional coverage.
const AUTHZ_ONLY_SUITES = new Set(['AUTH_EXPOSURE_SWEEP']);

const exercisedApi = new Set();
const exercisedSpa = new Set();
const authzProbedApi = new Set();

for (const s of loaded) {
  const target = AUTHZ_ONLY_SUITES.has(s.file) ? authzProbedApi : exercisedApi;
  for (const entry of s.data.exercisedApiRoutes ?? []) {
    const [method, p] = entry.split(' ');
    target.add(`${method} ${canonical(p)}`);
  }
  if (!AUTHZ_ONLY_SUITES.has(s.file)) {
    for (const p of s.data.exercisedSpaRoutes ?? []) exercisedSpa.add(canonical(p));
  }
}

// Map each failing or warning check onto the feature whose routes it names, so
// a feature is only marked FAIL when a check about that feature failed.
function featureOfText(text, features) {
  for (const f of features) {
    for (const r of [...f.apiRoutes, ...f.spaRoutes]) {
      const p = r.split(' ').pop().split(' ->')[0];
      const prefix = p.split('/:')[0];
      if (prefix.length > 8 && text.includes(prefix)) return f.feature;
    }
  }
  return null;
}

const features = inventory?.features ?? [];
const problemsByFeature = new Map();
for (const c of allChecks) {
  if (c.status !== 'FAIL' && c.status !== 'WARNING') continue;
  const text = `${c.id} ${c.name} ${c.detail ?? ''}`;
  const owner = featureOfText(text, features) ?? 'Unattributed';
  if (!problemsByFeature.has(owner)) problemsByFeature.set(owner, []);
  problemsByFeature.get(owner).push(c);
}

const featureVerdicts = [];
for (const feature of features) {
  const apiHit = feature.apiRoutes.filter((r) => {
    const [method, p] = r.split(' ');
    return exercisedApi.has(`${method} ${canonical(p)}`);
  });
  const authzHit = feature.apiRoutes.filter((r) => {
    const [method, p] = r.split(' ');
    return authzProbedApi.has(`${method} ${canonical(p)}`);
  });
  const spaHit = feature.spaRoutes.filter((r) => exercisedSpa.has(canonical(r.split(' ->')[0])));
  const problems = problemsByFeature.get(feature.feature) ?? [];

  let status = 'UNKNOWN';
  if (apiHit.length > 0 || spaHit.length > 0) {
    if (problems.some((p) => p.status === 'FAIL')) status = 'FAIL';
    else if (problems.some((p) => p.status === 'WARNING')) status = 'WARNING';
    else status = 'PASS';
  } else if (authzHit.length > 0) {
    // Its endpoints were confirmed to refuse anonymous callers, but nothing
    // exercised the feature itself.
    status = 'AUTHZ ONLY';
  }

  featureVerdicts.push({
    feature: feature.feature,
    status,
    apiRoutes: feature.apiRouteCount,
    apiRoutesExercised: apiHit.length,
    apiRoutesAuthzProbedOnly: authzHit.length,
    spaRoutes: feature.spaRouteCount,
    spaRoutesExercised: spaHit.length,
    failing: problems.filter((p) => p.status === 'FAIL').map((p) => p.name).slice(0, 5),
    warning: problems.filter((p) => p.status === 'WARNING').map((p) => p.name).slice(0, 5),
  });
}

const featureCounts = featureVerdicts.reduce(
  (acc, f) => ({ ...acc, [f.status]: (acc[f.status] ?? 0) + 1 }),
  { PASS: 0, FAIL: 0, WARNING: 0, UNKNOWN: 0, 'AUTHZ ONLY': 0 },
);

// ---------------------------------------------------------------------------
// Readiness
//
// Deliberately conservative: a check that was never run cannot count towards
// readiness, and features nobody exercised drag the figure down.
// ---------------------------------------------------------------------------

const checkScore = totals.total ? (totals.PASS + 0.5 * totals.WARNING) / totals.total : 0;
// A feature only confirmed to refuse anonymous callers counts a quarter: its
// access control is proven, its behaviour is not.
const featureScore = featureVerdicts.length
  ? (featureCounts.PASS + 0.5 * featureCounts.WARNING + 0.25 * featureCounts['AUTHZ ONLY']) /
    featureVerdicts.length
  : 0;
const readiness = Math.round((checkScore * 0.6 + featureScore * 0.4) * 1000) / 10;

const criticalDefects = allChecks.filter((c) => c.status === 'FAIL');

let launchStatus = 'NOT READY';
if (criticalDefects.length === 0 && readiness >= 85) launchStatus = 'READY';
else if (criticalDefects.length === 0 && readiness >= 60) launchStatus = 'READY WITH LIMITATIONS';
else if (criticalDefects.length <= 3 && readiness >= 60) launchStatus = 'READY WITH LIMITATIONS';

// ---------------------------------------------------------------------------
// Environment provenance
// ---------------------------------------------------------------------------

async function cmd(c) {
  try {
    const { stdout } = await exec('bash', ['-lc', c]);
    return stdout.trim();
  } catch {
    return 'unavailable';
  }
}

const environment = {
  commit: await cmd('git -C /workspace rev-parse HEAD'),
  branch: await cmd('git -C /workspace rev-parse --abbrev-ref HEAD'),
  node: await cmd('node --version'),
  postgres: await cmd("psql --version 2>/dev/null | head -1 || echo 'n/a'"),
  redis: await cmd("redis-server --version 2>/dev/null | awk '{print $1, $3}' || echo 'n/a'"),
  chromium: 'Playwright Chromium (headless shell 149)',
  neo4j: 'not configured — knowledge-graph checks not run',
  stripe: 'no live keys configured — billing checks not run',
  objectStorage: 'no R2/S3 credentials — uploads stored on local disk',
  ocr: 'tesseract.js 7 with bundled eng traineddata',
};

const screenshots = await readdir(path.join(OUT_DIR, 'screenshots')).catch(() => []);

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const report = {
  report: 'PRODUCTION_CERTIFICATION',
  generatedAt: new Date().toISOString(),
  environment,
  method:
    'Every result below was produced by executing the platform: PostgreSQL 16 and Redis 7 provisioned, ' +
    'all Prisma migrations applied, the Fastify API and its BullMQ workers running, the built SPA served ' +
    'over the same same-origin /api arrangement as production, and a real Chromium driving the interface. ' +
    'No result is inferred from source inspection.',
  summary: {
    totalChecks: totals.total,
    pass: totals.PASS,
    fail: totals.FAIL,
    warning: totals.WARNING,
    unknown: totals.UNKNOWN,
    checkPassRate: Math.round(checkScore * 1000) / 10,
    featuresInInventory: featureVerdicts.length,
    featuresPass: featureCounts.PASS,
    featuresFail: featureCounts.FAIL,
    featuresWarning: featureCounts.WARNING,
    featuresAuthorizationOnly: featureCounts['AUTHZ ONLY'],
    featuresUnknown: featureCounts.UNKNOWN,
    productionReadinessPercent: readiness,
    criticalDefectsRemaining: criticalDefects.length,
    recommendedLaunchStatus: launchStatus,
  },
  inventory: inventory?.totals ?? null,
  suites: loaded.map((s) => ({
    report: s.file,
    area: s.label,
    phase: s.phase,
    ...s.data.summary,
  })),
  featureVerdicts: featureVerdicts.sort((a, b) => a.feature.localeCompare(b.feature)),
  remainingDefects: criticalDefects.map((c) => ({ suite: c.suite, id: c.id, name: c.name, detail: c.detail })),
  warnings: allChecks
    .filter((c) => c.status === 'WARNING')
    .map((c) => ({ suite: c.suite, id: c.id, name: c.name, detail: c.detail })),
  screenshots: screenshots.map((s) => `reports/certification/screenshots/${s}`),
};

await writeFile(path.join(OUT_DIR, 'PRODUCTION_CERTIFICATION.json'), JSON.stringify(report, null, 2));

// --- Markdown ---------------------------------------------------------------

const row = (c) => `| ${c.area} | ${c.phase} | ${c.total} | ${c.PASS} | ${c.FAIL} | ${c.WARNING} | ${c.passRate}% |`;

const md = `# CourtAccess V1 — Production Certification

Generated ${report.generatedAt}
Commit \`${environment.commit}\` on branch \`${environment.branch}\`

## How these results were produced

${report.method}

Where something could not be measured in this environment it is recorded as
UNKNOWN. Nothing here is inferred from reading source code.

## Result

| | |
|---|---|
| Production readiness | **${readiness}%** |
| Recommended launch status | **${launchStatus}** |
| Checks executed | ${totals.total} |
| Passed | ${totals.PASS} |
| Failed | ${totals.FAIL} |
| Warnings | ${totals.WARNING} |
| Features in inventory | ${featureVerdicts.length} |
| Features exercised and passing | ${featureCounts.PASS} |
| Features failing | ${featureCounts.FAIL} |
| Features with warnings | ${featureCounts.WARNING} |
| Features where only access control was proven | ${featureCounts['AUTHZ ONLY']} |
| Features not exercised at all (UNKNOWN) | ${featureCounts.UNKNOWN} |
| Critical defects remaining | ${criticalDefects.length} |

Readiness weights the executed checks at 60% and per-feature coverage at 40%.
A feature that no suite exercised counts as zero, so the figure reflects what
was actually proven rather than what exists in the codebase.

## Suites

| Area | Phase | Checks | Pass | Fail | Warn | Rate |
|---|---|---|---|---|---|---|
${loaded.map((s) => row({ area: s.label, phase: s.phase, ...s.data.summary })).join('\n')}

## Inventory

| | |
|---|---|
| API routes | ${inventory?.totals.apiRoutes ?? 'n/a'} |
| SPA routes | ${inventory?.totals.spaRoutes ?? 'n/a'} |
| Prisma models | ${inventory?.totals.prismaModels ?? 'n/a'} |
| Features | ${inventory?.totals.features ?? 'n/a'} |

## Feature verdicts

A feature is PASS when at least one of its routes was exercised functionally
and no check about it failed. "Access control only" counts routes that were
confirmed to refuse an anonymous caller but were never driven with a valid
session — that proves authorization, not behaviour, so those features are
marked AUTHZ ONLY rather than PASS.

| Feature | Status | API routes exercised | Access control only | UI routes exercised |
|---|---|---|---|---|
${report.featureVerdicts
  .map(
    (f) =>
      `| ${f.feature} | ${f.status} | ${f.apiRoutesExercised}/${f.apiRoutes} | ${f.apiRoutesAuthzProbedOnly}/${f.apiRoutes} | ${f.spaRoutesExercised}/${f.spaRoutes} |`,
  )
  .join('\n')}

## Remaining defects

${
  criticalDefects.length === 0
    ? 'No failing checks remain in the executed suites.'
    : criticalDefects.map((c) => `- **${c.id}** (${c.suite}) — ${c.name}${c.detail ? `: ${c.detail}` : ''}`).join('\n')
}

## Warnings

${
  report.warnings.length === 0
    ? 'None.'
    : report.warnings.map((c) => `- **${c.id}** (${c.suite}) — ${c.name}${c.detail ? `: ${c.detail}` : ''}`).join('\n')
}

## What this run could not measure

- **Knowledge graph** — Neo4j is not configured in this environment, so graph
  population and querying were not exercised.
- **Billing and Stripe** — no live or test Stripe keys are available, so
  checkout, webhooks and subscription lifecycle were not exercised.
- **Object storage** — no R2/S3 credentials, so uploads were served from local
  disk. The presigned-upload path was not exercised.
- **Email delivery** — no SES credentials, so verification, invitation and
  password-reset mail was not delivered end to end.
- **Speech transcription** — not implemented in the product; audio and video
  are stored but their spoken content is not searchable.

These are recorded as UNKNOWN, not as passes.
`;

await writeFile(path.join(OUT_DIR, 'PRODUCTION_CERTIFICATION.md'), md);

console.log(md.split('\n').slice(0, 60).join('\n'));
console.log(`\nWrote ${path.join(OUT_DIR, 'PRODUCTION_CERTIFICATION.json')} and .md`);
