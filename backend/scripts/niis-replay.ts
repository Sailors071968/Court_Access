#!/usr/bin/env tsx
/**
 * NIIS Replay Mode — Zero Assumption Engineering Directive.
 *
 * Re-run the pipeline on two historical PDFs with current algorithms and
 * compare against investigator ground truth (and optional prior NIIS result).
 *
 * Evidence required — this script never claims CERTIFIED without gold truth.
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/niis-replay.ts \
 *     --prior /path/to/prior.pdf --prior-date 2026-08-09 \
 *     --current /path/to/current.pdf --current-date 2026-08-10 \
 *     --gold fixtures/sacramento/validation/ground-truth-67-names.md
 *
 * Optional:
 *   --prior-niis /path/to/prior-niis-names.txt   (one name per line)
 *   --out reports/niis-reliability/REPLAY_RESULT.md
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

import { formatCertificationEvidence } from '../src/intelligence/inmates/unknown.js';
import { parsePdfRoster } from '../src/intelligence/inmates/parsers/pdfParser.js';
import { SACRAMENTO_PDF } from '../src/intelligence/inmates/parsers/sacramento.js';
import { buildCanonicalRoster } from '../src/intelligence/inmates/canonicalRoster.js';
import { validateCanonicalRoster } from '../src/intelligence/inmates/parseValidation.js';
import { normalizeRosterName } from '../src/intelligence/inmates/rosterComparison.js';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function loadNames(path: string): string[] {
  const text = readFileSync(path, 'utf8');
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line && !line.startsWith('#') && (line.includes(',') || /^[A-Z]/.test(line)))
    .map((n) => normalizeRosterName(n));
}

function setDiff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((x) => !b.has(x)).sort();
}

async function main() {
  const priorPath = arg('--prior');
  const currentPath = arg('--current');
  const priorDate = arg('--prior-date');
  const currentDate = arg('--current-date');
  const goldPath = arg('--gold');
  const priorNiisPath = arg('--prior-niis');
  const outPath = resolve(
    arg('--out') ?? 'reports/niis-reliability/REPLAY_RESULT.md',
  );

  if (!priorPath || !currentPath || !priorDate || !currentDate) {
    console.error(
      'Required: --prior --prior-date --current --current-date [--gold] [--prior-niis] [--out]',
    );
    process.exit(2);
  }
  if (!existsSync(priorPath) || !existsSync(currentPath)) {
    console.error('BLOCKED: prior or current PDF missing on disk.');
    console.error(`  prior:   ${priorPath} exists=${existsSync(priorPath)}`);
    console.error(`  current: ${currentPath} exists=${existsSync(currentPath)}`);
    process.exit(2);
  }

  const priorParse = await parsePdfRoster(priorPath, SACRAMENTO_PDF.columnMap, {
    rosterDate: priorDate,
  });
  const currentParse = await parsePdfRoster(currentPath, SACRAMENTO_PDF.columnMap, {
    rosterDate: currentDate,
  });

  const priorRoster = buildCanonicalRoster({
    facility: 'sacramento',
    rosterDate: priorDate,
    records: priorParse.records,
    pageCount: priorParse.stats.pageCount,
    sourcePdf: basename(priorPath),
  });
  const currentRoster = buildCanonicalRoster({
    facility: 'sacramento',
    rosterDate: currentDate,
    records: currentParse.records,
    pageCount: currentParse.stats.pageCount,
    sourcePdf: basename(currentPath),
  });

  const priorVal = validateCanonicalRoster(priorRoster, {
    emptyPages: priorParse.stats.emptyPages,
  });
  const currentVal = validateCanonicalRoster(currentRoster, {
    emptyPages: currentParse.stats.emptyPages,
  });

  const priorNames = new Set(priorRoster.inmates.map((m) => m.normalizedName));
  const currentNames = new Set(currentRoster.inmates.map((m) => m.normalizedName));
  const replayNew = setDiff(currentNames, priorNames);

  let gold: string[] | null = null;
  let status: 'CERTIFIED' | 'FAIL' | 'BLOCKED' | 'PROVISIONAL' | 'UNKNOWN' = 'UNKNOWN';
  let fp: string[] = [];
  let fn: string[] = [];
  let precision: number | null = null;
  let recall: number | null = null;

  if (goldPath && existsSync(goldPath)) {
    gold = loadNames(goldPath);
    const goldSet = new Set(gold);
    const replaySet = new Set(replayNew);
    fp = setDiff(replaySet, goldSet);
    fn = setDiff(goldSet, replaySet);
    const tp = gold.filter((n) => replaySet.has(n)).length;
    precision = tp + fp.length === 0 ? 0 : tp / (tp + fp.length);
    recall = tp + fn.length === 0 ? 0 : tp / (tp + fn.length);
    status = !priorVal.ok || !currentVal.ok
      ? 'PROVISIONAL'
      : precision === 1 && recall === 1
        ? 'CERTIFIED'
        : 'FAIL';
  } else {
    status = 'UNKNOWN';
  }

  let vsPriorNiis: { improved: string[]; regressed: string[]; note: string } | null = null;
  if (priorNiisPath && existsSync(priorNiisPath)) {
    const oldSet = new Set(loadNames(priorNiisPath));
    const newSet = new Set(replayNew);
    const goldSet = gold ? new Set(gold) : null;
    if (goldSet) {
      const oldFp = setDiff(oldSet, goldSet);
      const newFp = setDiff(newSet, goldSet);
      const oldFn = setDiff(goldSet, oldSet);
      const newFn = setDiff(goldSet, newSet);
      vsPriorNiis = {
        improved: [
          ...oldFn.filter((n) => !newFn.includes(n)).map((n) => `FN fixed: ${n}`),
          ...oldFp.filter((n) => !newFp.includes(n)).map((n) => `FP removed: ${n}`),
        ],
        regressed: [
          ...newFn.filter((n) => !oldFn.includes(n)).map((n) => `FN introduced: ${n}`),
          ...newFp.filter((n) => !oldFp.includes(n)).map((n) => `FP introduced: ${n}`),
        ],
        note: 'Delta vs prior NIIS output measured against investigator gold.',
      };
    } else {
      vsPriorNiis = {
        improved: setDiff(newSet, oldSet).map((n) => `now reported: ${n}`),
        regressed: setDiff(oldSet, newSet).map((n) => `no longer reported: ${n}`),
        note: 'No gold file — delta is output-only (UNKNOWN correctness).',
      };
    }
  }

  const evidence = formatCertificationEvidence({
    engine: 'Replay Mode — Roster Set-Diff (parse → canonical → compare)',
    testDataset: `Sacramento PDF ${basename(priorPath)} → ${basename(currentPath)}`,
    rosterDate: currentDate,
    manualGroundTruthNew: gold?.length ?? null,
    niisResultNew: replayNew.length,
    falsePositives: gold ? fp.length : null,
    falseNegatives: gold ? fn.length : null,
    precision,
    recall,
    status,
  });

  const md = [
    '# NIIS Replay Result',
    '',
    '> Evidence-governed. Unit tests / compilation are not proof of correctness.',
    '',
    '```',
    evidence,
    '```',
    '',
    '## Parse validation',
    '',
    `| Roster | Pages | Extracted | Validation |`,
    `|---|---:|---:|---|`,
    `| Prior ${priorDate} | ${priorParse.stats.pageCount ?? 'UNKNOWN'} | ${priorRoster.inmates.length} | ${priorVal.ok ? 'OK' : 'FAIL'} |`,
    `| Current ${currentDate} | ${currentParse.stats.pageCount ?? 'UNKNOWN'} | ${currentRoster.inmates.length} | ${currentVal.ok ? 'OK' : 'FAIL'} |`,
    '',
    '## Replay new inmates (current ∖ prior)',
    '',
    `Count: **${replayNew.length}**`,
    '',
    ...(gold
      ? [
          '## Against investigator ground truth',
          '',
          `| Metric | Value |`,
          `|---|---:|`,
          `| Gold | ${gold.length} |`,
          `| True positives | ${gold.length - fn.length} |`,
          `| False positives | ${fp.length} |`,
          `| False negatives | ${fn.length} |`,
          '',
          ...(fn.length ? ['### Misses (FN)', ...fn.map((n) => `- ${n}`), ''] : []),
          ...(fp.length ? ['### Extras (FP)', ...fp.map((n) => `- ${n}`), ''] : []),
        ]
      : ['## Against investigator ground truth', '', '**UNKNOWN** — no `--gold` file provided.', '']),
    ...(vsPriorNiis
      ? [
          '## Delta vs prior NIIS output',
          '',
          vsPriorNiis.note,
          '',
          '### Improved',
          ...(vsPriorNiis.improved.length ? vsPriorNiis.improved.map((x) => `- ${x}`) : ['- (none)']),
          '',
          '### Regressed',
          ...(vsPriorNiis.regressed.length ? vsPriorNiis.regressed.map((x) => `- ${x}`) : ['- (none)']),
          '',
        ]
      : []),
    `Generated: ${new Date().toISOString()}`,
  ].join('\n');

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, md);
  writeFileSync(outPath.replace(/\.md$/, '.json'), JSON.stringify({
    status,
    priorDate,
    currentDate,
    priorPath,
    currentPath,
    goldPath: goldPath ?? null,
    priorCount: priorRoster.inmates.length,
    currentCount: currentRoster.inmates.length,
    replayNewCount: replayNew.length,
    replayNew,
    falsePositives: fp,
    falseNegatives: fn,
    precision,
    recall,
    priorValidation: priorVal,
    currentValidation: currentVal,
    vsPriorNiis,
    evidence,
  }, null, 2));

  console.log(evidence);
  console.log(`\nWrote ${outPath}`);
  process.exit(status === 'CERTIFIED' ? 0 : status === 'FAIL' ? 1 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
