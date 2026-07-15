// ============================================================================
// Program 122 — Statewide Criminal Statutory Acquisition Engine
// Automated, deterministic orchestrator: for each California code it discovers
// (bounded), acquires real statute HTML from leginfo, then rebuilds the unified
// knowledge-graph repository in a single deterministic pass. Produces a measured
// acquisition report + a continuous-update diff (new statutes/offenses per run).
//
// Constitution: only real leginfo data is used; nothing is fabricated. All
// reported figures are ACTUAL MEASURED counts. Codes/sections that cannot be
// discovered or parsed are recorded as failures/UNKNOWN, never invented.
//
// Usage:
//   tsx scripts/statewide-acquisition.ts --codes PEN,EVID,VEH --max-pages 20 --max-sections 40
//   (defaults: criminal-priority codes; --max-pages 15; --max-sections 40)
// ============================================================================

import { resolve, join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { discoverCaliforniaCode } from '../src/legislative/discovery.ts';
import { acquireStatuteHtml } from '../src/legislative/acquisition.ts';
import { processStatutePipeline } from '../src/legislative/knowledgeGraph/pipeline.ts';
import { defaultManifestPaths } from '../src/legislative/discoveryManifest.ts';
import { CALIFORNIA_CODES, getCriminalPriorityCodes } from '../src/legislative/caCodes.ts';

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const REPO_DIR = resolve('data/legislative/repositories');
const RAW_DIR = resolve('data/legislative/raw');
const DISC_DIR = resolve('data/legislative/discovery');
const REPORT_PATH = resolve('data/legislative/statewide-acquisition-report.json');

const maxPages = parseInt(arg('max-pages', '15')!, 10);
const maxSections = parseInt(arg('max-sections', '40')!, 10);
const codesArg = arg('codes');
const allFlag = process.argv.includes('--all');
const codes = allFlag
  ? CALIFORNIA_CODES.map((c) => c.abbrev)
  : codesArg
    ? codesArg.split(',').map((c) => c.trim().toUpperCase())
    : getCriminalPriorityCodes().map((c) => c.abbrev);

function repoCount(name: string): number {
  const p = join(REPO_DIR, name, 'records.jsonl');
  if (!existsSync(p)) return 0;
  return readFileSync(p, 'utf-8').split('\n').filter(Boolean).length;
}
const REPOS = ['statutes', 'offenses', 'elements', 'mens_rea', 'exceptions', 'defenses', 'cross_references', 'regulatory_incorporations', 'authorities', 'calcrim_links', 'statute_classifications'];
function snapshot(): Record<string, number> {
  return Object.fromEntries(REPOS.map((r) => [r, repoCount(r)]));
}

async function main() {
  console.log(`\n=== Statewide Acquisition Engine ===`);
  console.log(`Codes: ${codes.join(', ')} | maxPages/code=${maxPages} | maxSections/code=${maxSections}`);
  console.log(`Known California codes in registry: ${CALIFORNIA_CODES.length}`);

  const before = snapshot();
  const perCode: Array<Record<string, unknown>> = [];

  for (const code of codes) {
    const info = CALIFORNIA_CODES.find((c) => c.abbrev === code);
    if (!info) { perCode.push({ code, status: 'UNKNOWN_CODE' }); continue; }
    const paths = defaultManifestPaths(DISC_DIR, code);
    const entry: Record<string, unknown> = { code, name: info.name };
    try {
      // Discover (bounded). Resume if a checkpoint exists to keep it incremental.
      const resumeFrom = existsSync(paths.checkpoint) ? paths.checkpoint : undefined;
      const disc = await discoverCaliforniaCode({ code, outputDir: DISC_DIR, maxPages, resumeFrom });
      entry.discovered = disc.sections?.length ?? disc.stats?.sectionCount ?? 'UNKNOWN';
      // Acquire (bounded, resume/skip-existing to avoid refetch).
      const acq = await acquireStatuteHtml({ code, manifestPath: paths.manifest, rawHtmlDir: RAW_DIR, maxSections, resume: true, skipExisting: true });
      entry.acquired = acq.acquired;
      entry.acquireFailed = acq.failed;
      entry.status = 'OK';
    } catch (e) {
      entry.status = 'FAILED';
      entry.error = e instanceof Error ? e.message : String(e);
    }
    perCode.push(entry);
    console.log(`  [${entry.status}] ${code}: discovered=${entry.discovered ?? '-'} acquired=${entry.acquired ?? 0}`);
  }

  // Deterministic full rebuild of the unified repository from all acquired raw
  // HTML. processStatutePipeline is per-code, so process each acquired code once
  // into the freshly-wiped repository (no append duplicates).
  console.log(`\nRebuilding unified repository from all acquired codes…`);
  rmSync(REPO_DIR, { recursive: true, force: true });
  mkdirSync(REPO_DIR, { recursive: true });
  const proc = { processed: 0, rejected: 0, offenses: 0, classified: 0 };
  const acquiredCodes = CALIFORNIA_CODES
    .map((c) => c.abbrev)
    .filter((c) => existsSync(join(RAW_DIR, c, 'acquisition-index.jsonl')));
  for (const code of acquiredCodes) {
    try {
      const r = await processStatutePipeline({ code, rawHtmlDir: RAW_DIR, repositoryDir: REPO_DIR });
      proc.processed += r.processed; proc.rejected += r.rejected; proc.offenses += r.offenses; proc.classified += r.classified;
      console.log(`  processed ${code}: +${r.processed} statutes, +${r.offenses} offenses`);
    } catch (e) {
      console.log(`  [FAILED] process ${code}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`Processed=${proc.processed} rejected=${proc.rejected} offenses=${proc.offenses} classified=${proc.classified}`);

  const after = snapshot();
  const deltas = Object.fromEntries(REPOS.map((r) => [r, { before: before[r], after: after[r], delta: after[r] - before[r] }]));

  // ---- Continuous validation (Phase 6) + criminal-liability metrics (Phase 2/7) ----
  function readRecords(name: string): Array<Record<string, any>> {
    const p = join(REPO_DIR, name, 'records.jsonl');
    if (!existsSync(p)) return [];
    return readFileSync(p, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }
  const statuteRecs = readRecords('statutes');
  const offenseRecs = readRecords('offenses');
  const fieldVal = (f: any) => (f && typeof f === 'object' && 'value' in f ? f.value : f);

  // Duplicate citations (same code+section appearing more than once).
  const citationCounts = new Map<string, number>();
  for (const s of statuteRecs) {
    const key = `${s.code} ${s.section}`;
    citationCounts.set(key, (citationCounts.get(key) ?? 0) + 1);
  }
  const duplicateCitations = [...citationCounts.entries()].filter(([, n]) => n > 1).map(([k, n]) => ({ citation: k, count: n }));
  // Repealed statutes (deterministic text scan of statute full text).
  const repealed = statuteRecs
    .filter((s) => typeof s.fullText === 'string' && /\brepeal(ed)?\b/i.test(s.fullText))
    .map((s) => `${s.code} ${s.section}`);

  // Criminal-liability classification breakdown (from offense.classification).
  const classificationCounts: Record<string, number> = {};
  for (const o of offenseRecs) {
    const c = String(fieldVal(o.classification) ?? 'UNKNOWN');
    classificationCounts[c] = (classificationCounts[c] ?? 0) + 1;
  }

  const attempted = perCode.filter((e) => e.status === 'OK').map((e) => e.code as string);
  const failed = perCode.filter((e) => e.status !== 'OK').map((e) => e.code as string);
  const codesWithData = new Set(statuteRecs.map((s) => s.code));

  const validation = {
    duplicateCitationCount: duplicateCitations.length,
    duplicateCitations: duplicateCitations.slice(0, 25),
    repealedDetectedCount: repealed.length,
    repealedSample: repealed.slice(0, 25),
    amendedVersionDiffs: 'UNKNOWN — version history not tracked',
  };
  const criminalLiability = {
    qualifiedOffenses: offenseRecs.length,
    classificationBreakdown: classificationCounts,
    regulatoryIncorporations: after.regulatory_incorporations,
    penaltyRelatedExceptions: after.exceptions,
  };
  const codeCoverage = {
    knownCodes: CALIFORNIA_CODES.length,
    codesAttempted: attempted.length,
    codesWithData: codesWithData.size,
    codesWithDataList: [...codesWithData].sort(),
    codesFailed: failed,
    codesRemaining: CALIFORNIA_CODES.map((c) => c.abbrev).filter((c) => !codesWithData.has(c)),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    engineVersion: '1.0.0',
    knownCodes: CALIFORNIA_CODES.length,
    codesRequested: codes,
    perCode,
    processing: { processed: proc.processed, rejected: proc.rejected, offensesIdentified: proc.offenses, classified: proc.classified },
    repository: deltas,
    codeCoverage,
    criminalLiability,
    validation,
    // Continuous-update diff: net new records this run (deterministic).
    updateDiff: Object.fromEntries(REPOS.map((r) => [r, after[r] - before[r]])),
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`Codes with data: ${codeCoverage.codesWithData}/${codeCoverage.knownCodes} | offenses: ${criminalLiability.qualifiedOffenses} | duplicates: ${validation.duplicateCitationCount} | repealed: ${validation.repealedDetectedCount}`);
  console.log(`\nReport: ${REPORT_PATH}`);
  console.log(`Statutes ${before.statutes} -> ${after.statutes} | Offenses ${before.offenses} -> ${after.offenses} | Elements ${before.elements} -> ${after.elements}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
