#!/usr/bin/env tsx
/**
 * Release Certification — replay the entire Sacramento Certification Corpus.
 *
 * Every release must pass every previously verified/certified roster pair.
 * If any previously certified day regresses, the release FAILS.
 *
 * Gold standard = investigator manual classification for that day
 * (NEW / EXISTING / RETURNING / REVIEW) — never a fixed constant like "67".
 *
 * Usage:
 *   cd backend
 *   npm run cert:release -- --version 1.2.0
 *
 * Exit codes:
 *   0 = CERTIFIED (all runnable verified pairs passed)
 *   1 = FAIL (regression / missed / false new)
 *   2 = BLOCKED / UNKNOWN (no runnable corpus pairs — PDFs or classifications missing)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parsePdfRoster } from '../src/intelligence/inmates/parsers/pdfParser.js';
import { SACRAMENTO_PDF } from '../src/intelligence/inmates/parsers/sacramento.js';
import { buildCanonicalRoster } from '../src/intelligence/inmates/canonicalRoster.js';
import { validateCanonicalRoster } from '../src/intelligence/inmates/parseValidation.js';
import { normalizeRosterName } from '../src/intelligence/inmates/rosterComparison.js';
import {
  loadManualClassification,
  diffAgainstManual,
  summaryCounts,
} from '../src/intelligence/inmates/manualClassification.js';
import { formatCertificationEvidence } from '../src/intelligence/inmates/unknown.js';

interface CorpusEntry {
  id: string;
  priorDate: string;
  currentDate: string;
  status: string;
  dir: string;
  notes?: string;
}

interface PairResult {
  id: string;
  status: 'CERTIFIED' | 'FAIL' | 'BLOCKED' | 'SKIPPED' | 'UNKNOWN';
  missedInmates: number;
  falseNew: number;
  regression: boolean;
  manualNewCount: number | null;
  niisNewCount: number | null;
  detail: string;
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function resolvePdf(entryDir: string, meta: Record<string, unknown>, which: 'yesterday' | 'today'): string | null {
  const artifacts = (meta.artifacts ?? {}) as Record<string, string>;
  const candidates = which === 'yesterday'
    ? [
        join(entryDir, artifacts.yesterdayPdf || 'yesterday.pdf'),
        join(entryDir, 'prior.pdf'),
        typeof meta.yesterdayPdfPath === 'string' ? meta.yesterdayPdfPath : '',
        typeof meta.priorPdfPath === 'string' ? meta.priorPdfPath : '',
      ]
    : [
        join(entryDir, artifacts.todayPdf || 'today.pdf'),
        join(entryDir, 'current.pdf'),
        typeof meta.todayPdfPath === 'string' ? meta.todayPdfPath : '',
        typeof meta.currentPdfPath === 'string' ? meta.currentPdfPath : '',
      ];
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

async function replayPair(args: {
  corpusRoot: string;
  entry: CorpusEntry;
}): Promise<PairResult> {
  const entryDir = join(args.corpusRoot, args.entry.dir);
  const metaPath = join(entryDir, 'meta.json');
  if (!existsSync(metaPath)) {
    return {
      id: args.entry.id,
      status: 'BLOCKED',
      missedInmates: 0,
      falseNew: 0,
      regression: false,
      manualNewCount: null,
      niisNewCount: null,
      detail: 'meta.json missing',
    };
  }

  const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, unknown>;
  const status = String(meta.status ?? args.entry.status);

  // Only gate releases on verified / certified pairs.
  if (!['verified', 'certified', 'regressed'].includes(status)) {
    return {
      id: args.entry.id,
      status: 'SKIPPED',
      missedInmates: 0,
      falseNew: 0,
      regression: false,
      manualNewCount: null,
      niisNewCount: null,
      detail: `status=${status} — not yet verified; skipped for release gate`,
    };
  }

  const priorPdf = resolvePdf(entryDir, meta, 'yesterday');
  const currentPdf = resolvePdf(entryDir, meta, 'today');
  const classificationPath = join(
    entryDir,
    ((meta.artifacts as Record<string, string> | undefined)?.manualClassification)
      || 'manual-classification.md',
  );

  if (!priorPdf || !currentPdf) {
    return {
      id: args.entry.id,
      status: 'BLOCKED',
      missedInmates: 0,
      falseNew: 0,
      regression: status === 'certified',
      manualNewCount: null,
      niisNewCount: null,
      detail: `Durable PDFs absent (prior=${Boolean(priorPdf)} current=${Boolean(currentPdf)})`,
    };
  }
  if (!existsSync(classificationPath)) {
    return {
      id: args.entry.id,
      status: 'BLOCKED',
      missedInmates: 0,
      falseNew: 0,
      regression: status === 'certified',
      manualNewCount: null,
      niisNewCount: null,
      detail: 'manual-classification.md missing',
    };
  }

  const manual = loadManualClassification(classificationPath, {
    defaultRosterDate: args.entry.currentDate,
  });
  // Empty template (no names) is not evidence.
  if (manual.new.length === 0 && manual.existing.length === 0) {
    return {
      id: args.entry.id,
      status: 'BLOCKED',
      missedInmates: 0,
      falseNew: 0,
      regression: status === 'certified',
      manualNewCount: 0,
      niisNewCount: null,
      detail: 'Manual classification empty — investigator evidence not recorded',
    };
  }

  const priorParse = await parsePdfRoster(priorPdf, SACRAMENTO_PDF.columnMap, {
    rosterDate: args.entry.priorDate,
  });
  const currentParse = await parsePdfRoster(currentPdf, SACRAMENTO_PDF.columnMap, {
    rosterDate: args.entry.currentDate,
  });

  const priorRoster = buildCanonicalRoster({
    facility: 'sacramento',
    rosterDate: args.entry.priorDate,
    records: priorParse.records,
    pageCount: priorParse.stats.pageCount,
    sourcePdf: priorPdf,
  });
  const currentRoster = buildCanonicalRoster({
    facility: 'sacramento',
    rosterDate: args.entry.currentDate,
    records: currentParse.records,
    pageCount: currentParse.stats.pageCount,
    sourcePdf: currentPdf,
  });

  const priorVal = validateCanonicalRoster(priorRoster, { emptyPages: priorParse.stats.emptyPages });
  const currentVal = validateCanonicalRoster(currentRoster, { emptyPages: currentParse.stats.emptyPages });

  const priorNames = new Set(priorRoster.inmates.map((m) => m.normalizedName));
  const niisByName = new Map<string, string>();
  const niisReportable: string[] = [];
  for (const m of currentRoster.inmates) {
    const onPrior = priorNames.has(m.normalizedName);
    const disposition = onPrior ? 'existing' : 'new';
    niisByName.set(m.normalizedName, disposition);
    if (!onPrior) niisReportable.push(m.normalizedName);
  }

  const diff = diffAgainstManual({
    manual,
    niisByName,
    niisReportableNames: niisReportable,
  });

  const pass =
    diff.newPerfect
    && priorVal.ok
    && currentVal.ok
    && (manual.partial || diff.fullPerfect);

  const pairStatus: PairResult['status'] = pass
    ? 'CERTIFIED'
    : (!priorVal.ok || !currentVal.ok)
      ? 'FAIL'
      : 'FAIL';

  // Persist replay artifacts into the corpus entry.
  const niisOutput = {
    priorDate: args.entry.priorDate,
    currentDate: args.entry.currentDate,
    priorCount: priorRoster.inmates.length,
    currentCount: currentRoster.inmates.length,
    niisNew: niisReportable.sort(),
    niisNewCount: niisReportable.length,
    manual: summaryCounts(manual),
    missedNew: diff.missedNew,
    falseNew: diff.falseNew,
    classMismatches: diff.classMismatches,
    priorValidationOk: priorVal.ok,
    currentValidationOk: currentVal.ok,
    pass,
    replayedAt: new Date().toISOString(),
  };
  writeFileSync(join(entryDir, 'niis-output.json'), JSON.stringify(niisOutput, null, 2));
  writeFileSync(
    join(entryDir, 'discrepancies.json'),
    JSON.stringify({
      missedNew: diff.missedNew,
      falseNew: diff.falseNew,
      missedReturning: diff.missedReturning,
      classMismatches: diff.classMismatches,
    }, null, 2),
  );

  const nextMeta = {
    ...meta,
    status: pass ? (status === 'regressed' ? 'certified' : status === 'verified' ? 'certified' : 'certified') : (status === 'certified' ? 'regressed' : status),
    manualSummary: {
      ...summaryCounts(manual),
      note: 'Counts are consequences of the classification — never the gold standard itself.',
    },
    niisSummary: {
      newCount: niisReportable.length,
      existingCount: currentRoster.inmates.length - niisReportable.length,
      returningCount: null,
      reviewCount: null,
      missedInmates: diff.missedNew.length,
      falseNew: diff.falseNew.length,
    },
    lastReplayAt: new Date().toISOString(),
    lastReplayPass: pass,
  };
  writeFileSync(metaPath, JSON.stringify(nextMeta, null, 2));

  return {
    id: args.entry.id,
    status: pairStatus,
    missedInmates: diff.missedNew.length,
    falseNew: diff.falseNew.length,
    regression: !pass && status === 'certified',
    manualNewCount: manual.new.length,
    niisNewCount: niisReportable.length,
    detail: pass
      ? `matched investigator classification (NEW=${manual.new.length}${manual.partial ? ', partial' : ''})`
      : `missed=${diff.missedNew.length} falseNew=${diff.falseNew.length} partial=${manual.partial}`,
  };
}

async function main() {
  const version = arg('version', 'dev')!;
  const corpusRoot = resolve(
    arg('corpus') ?? join(import.meta.dirname, '../../fixtures/sacramento/certification-corpus'),
  );
  const outDir = resolve(
    arg('out') ?? join(import.meta.dirname, '../../reports/niis-reliability'),
  );
  mkdirSync(outDir, { recursive: true });

  const indexPath = join(corpusRoot, 'index.json');
  if (!existsSync(indexPath)) {
    console.error(`BLOCKED: corpus index missing at ${indexPath}`);
    process.exit(2);
  }

  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as {
    entries: CorpusEntry[];
    philosophy?: string;
  };

  // Also discover any on-disk entry dirs not yet in index.
  const diskDirs = readdirSync(corpusRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}__\d{4}-\d{2}-\d{2}$/.test(d.name))
    .map((d) => d.name);
  for (const dir of diskDirs) {
    if (!index.entries.some((e) => e.dir === dir)) {
      const [priorDate, currentDate] = dir.split('__') as [string, string];
      index.entries.push({
        id: dir,
        priorDate,
        currentDate,
        status: 'pending_pdfs',
        dir,
      });
    }
  }

  const results: PairResult[] = [];
  for (const entry of index.entries) {
    results.push(await replayPair({ corpusRoot, entry }));
  }

  const runnable = results.filter((r) => r.status === 'CERTIFIED' || r.status === 'FAIL');
  const certified = results.filter((r) => r.status === 'CERTIFIED');
  const failed = results.filter((r) => r.status === 'FAIL');
  const blocked = results.filter((r) => r.status === 'BLOCKED');
  const skipped = results.filter((r) => r.status === 'SKIPPED');
  const regressions = results.filter((r) => r.regression);

  const missedTotal = runnable.reduce((s, r) => s + r.missedInmates, 0);
  const falseNewTotal = runnable.reduce((s, r) => s + r.falseNew, 0);

  let releaseStatus: 'CERTIFIED' | 'FAIL' | 'BLOCKED' | 'UNKNOWN';
  if (failed.length > 0 || regressions.length > 0) releaseStatus = 'FAIL';
  else if (runnable.length === 0) releaseStatus = 'BLOCKED';
  else releaseStatus = 'CERTIFIED';

  const evidence = formatCertificationEvidence({
    engine: 'Release Certification — Sacramento Certification Corpus replay',
    testDataset: `${index.entries.length} corpus entries (${runnable.length} runnable)`,
    rosterDate: version,
    manualGroundTruthNew: runnable.reduce((s, r) => s + (r.manualNewCount ?? 0), 0) || null,
    niisResultNew: runnable.reduce((s, r) => s + (r.niisNewCount ?? 0), 0) || null,
    falsePositives: runnable.length ? falseNewTotal : null,
    falseNegatives: runnable.length ? missedTotal : null,
    precision: runnable.length && (certified.length + failed.length) > 0
      ? (falseNewTotal + missedTotal === 0 ? 1 : null)
      : null,
    recall: runnable.length && missedTotal === 0 && certified.length > 0 ? 1 : (runnable.length ? 0 : null),
    status: releaseStatus === 'CERTIFIED' ? 'CERTIFIED' : releaseStatus === 'FAIL' ? 'FAIL' : 'UNKNOWN',
  });

  const md = [
    `# Release Certification — ${version}`,
    '',
    '> NIIS certifies evidence, not software. Gold standard = investigator classification per day — not a fixed number.',
    '',
    '```',
    evidence,
    '```',
    '',
    '## Replay summary',
    '',
    '| Metric | Value |',
    '|---|---:|',
    `| Corpus entries | ${index.entries.length} |`,
    `| Runnable (verified+) | ${runnable.length} |`,
    `| Certified | ${certified.length} |`,
    `| Failed | ${failed.length} |`,
    `| Blocked | ${blocked.length} |`,
    `| Skipped (pending) | ${skipped.length} |`,
    `| Missed inmates | ${runnable.length ? missedTotal : 'UNKNOWN'} |`,
    `| False new | ${runnable.length ? falseNewTotal : 'UNKNOWN'} |`,
    `| Regression | ${regressions.length} |`,
    `| **Status** | **${releaseStatus}** |`,
    '',
    '## Per-pair results',
    '',
    '| Pair | Status | Manual NEW | NIIS NEW | Missed | False new | Detail |',
    '|---|---|---:|---:|---:|---:|---|',
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.status} | ${r.manualNewCount ?? '—'} | ${r.niisNewCount ?? '—'} | ${r.missedInmates} | ${r.falseNew} | ${r.detail} |`,
    ),
    '',
    releaseStatus === 'BLOCKED'
      ? [
          '## Why BLOCKED',
          '',
          'No verified corpus pairs have durable PDFs + investigator classification available in this environment.',
          'Preserve Sacramento County roster PDFs and record full manual classifications before a release can be CERTIFIED.',
          '',
        ].join('\n')
      : '',
    `Generated: ${new Date().toISOString()}`,
    '',
  ].join('\n');

  const outMd = join(outDir, `RELEASE_CERTIFICATION_${version.replace(/[^a-zA-Z0-9._-]/g, '_')}.md`);
  const outJson = outMd.replace(/\.md$/, '.json');
  writeFileSync(outMd, md);
  writeFileSync(
    outJson,
    JSON.stringify({
      version,
      releaseStatus,
      corpusRoot,
      philosophy: index.philosophy,
      missedInmates: runnable.length ? missedTotal : null,
      falseNew: runnable.length ? falseNewTotal : null,
      regression: regressions.length,
      results,
      evidence,
      generatedAt: new Date().toISOString(),
    }, null, 2),
  );

  // Refresh index statuses from disk meta where available.
  for (const entry of index.entries) {
    const metaPath = join(corpusRoot, entry.dir, 'meta.json');
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { status?: string };
      if (meta.status) entry.status = meta.status;
    }
  }
  writeFileSync(indexPath, JSON.stringify(index, null, 2));

  console.log(md);
  console.log(`Wrote ${outMd}`);
  process.exit(releaseStatus === 'CERTIFIED' ? 0 : releaseStatus === 'FAIL' ? 1 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
