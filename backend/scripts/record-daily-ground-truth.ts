#!/usr/bin/env tsx
/**
 * Continuous Operational Validation — record today's investigator ground truth.
 *
 * Gold standard = full manual classification (NEW / EXISTING / RETURNING / REVIEW).
 * A NEW count (historically 67 for one day) is only a consequence of that evidence.
 *
 * Preferred:
 *   npm run cert:daily-truth -- \
 *     --date 2026-08-11 \
 *     --classification /path/to/manual-classification.md \
 *     [--prior-date 2026-08-10] \
 *     [--prior /path/to/yesterday.pdf] \
 *     [--current /path/to/today.pdf]
 *
 * Legacy (NEW names only — marked partial):
 *   npm run cert:daily-truth -- --date 2026-08-11 --gold /path/to/manual-new-list.md
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

import prisma from '../src/lib/prisma.js';
import { getNewInmates } from '../src/intelligence/inmates/repository.js';
import { recordEngineeringCertification } from '../src/intelligence/inmates/engineeringCertification.js';
import { consecutivePassStreak } from '../src/intelligence/inmates/learningQueue.js';
import {
  loadManualClassification,
  parseManualClassification,
  writeManualClassification,
  diffAgainstManual,
  summaryCounts,
  ensureCorpusEntry,
} from '../src/intelligence/inmates/manualClassification.js';
import { appendEvidenceLedger } from '../src/intelligence/inmates/evidenceLedger.js';
import { normalizeRosterName } from '../src/intelligence/inmates/rosterComparison.js';
import { inferDefectCategory } from '../src/intelligence/inmates/defectCategories.js';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function priorDateOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nextDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const started = Date.now();
  const facility = arg('facility', 'sacramento')!;
  const opsDate = arg('date');
  const classificationPath = arg('classification');
  const goldPath = arg('gold');
  const prior = arg('prior-date') ?? (opsDate ? priorDateOf(opsDate) : undefined);
  const priorPdf = arg('prior');
  const currentPdf = arg('current');

  if (!opsDate || (!classificationPath && !goldPath)) {
    console.error(
      'Usage: record-daily-ground-truth.ts --date YYYY-MM-DD '
        + '(--classification <manual-classification.md> | --gold <new-only.md>) '
        + '[--prior-date YYYY-MM-DD] [--prior pdf] [--current pdf]',
    );
    process.exit(2);
  }
  if (!prior) {
    console.error('Could not determine prior date');
    process.exit(2);
  }

  const sourcePath = classificationPath ?? goldPath!;
  if (!existsSync(sourcePath)) {
    console.error(`Classification / gold file not found: ${sourcePath}`);
    process.exit(2);
  }

  const manual = classificationPath
    ? loadManualClassification(classificationPath, { defaultRosterDate: opsDate })
    : parseManualClassification(readFileSync(goldPath!, 'utf8'), {
        sourcePath: goldPath,
        defaultRosterDate: opsDate,
      });

  if (!manual.rosterDate) manual.rosterDate = opsDate;
  if (!manual.priorDate) manual.priorDate = prior;

  const counts = summaryCounts(manual);
  console.log(
    `Manual classification: NEW=${counts.newCount} EXISTING=${counts.existingCount} `
      + `RETURNING=${counts.returningCount} REVIEW=${counts.reviewCount}`
      + (counts.partial ? ' (PARTIAL — NEW only)' : ''),
  );
  console.log(
    'Note: these counts are consequences of investigator evidence for this day — not a permanent target.',
  );

  const to = nextDate(opsDate);
  const reported = await getNewInmates({
    facility,
    from: opsDate,
    to,
    limit: 5000,
    offset: 0,
  });
  const niisReportableNames = reported.results.map((r) => normalizeRosterName(r.name));
  const niisByName = new Map<string, string>();
  for (const n of niisReportableNames) niisByName.set(n, 'new');

  const diff = diffAgainstManual({
    manual,
    niisByName,
    niisReportableNames,
  });

  const pass = diff.newPerfect && manual.new.length > 0;
  const precision = (() => {
    const tp = manual.new.filter((r) => niisReportableNames.includes(r.name)).length
      + manual.returning.filter((r) => niisReportableNames.includes(r.name)).length;
    const fp = diff.falseNew.length;
    return tp + fp === 0 ? 0 : tp / (tp + fp);
  })();
  const recall = (() => {
    const goldSize = manual.new.length + (manual.partial ? 0 : manual.returning.length);
    const fn = diff.missedNew.length + diff.missedReturning.length;
    return goldSize === 0 ? 0 : (goldSize - fn) / goldSize;
  })();

  // Preserve into continuous days/ tree (legacy + classification).
  const dayDir = resolve(import.meta.dirname, `../../fixtures/sacramento/validation/days/${opsDate}`);
  mkdirSync(dayDir, { recursive: true });
  writeManualClassification(join(dayDir, 'manual-classification.md'), manual);
  if (goldPath && existsSync(goldPath)) {
    writeFileSync(join(dayDir, 'ground-truth-new.md'), readFileSync(goldPath));
  } else {
    writeFileSync(
      join(dayDir, 'ground-truth-new.md'),
      [
        `# NEW inmates — ${opsDate} (derived from manual classification)`,
        `# Count = ${manual.new.length} — consequence of evidence, not a target.`,
        '',
        ...manual.new.map((r, i) => `${i + 1}. ${r.raw || r.name}`),
        '',
      ].join('\n'),
    );
  }

  // Preserve into Sacramento Certification Corpus.
  const corpusRoot = resolve(
    import.meta.dirname,
    '../../fixtures/sacramento/certification-corpus',
  );
  const entryDir = ensureCorpusEntry({ corpusRoot, priorDate: prior, currentDate: opsDate });
  const corpusId = `${prior}__${opsDate}`;
  writeManualClassification(join(entryDir, 'manual-classification.md'), manual);

  if (priorPdf && existsSync(priorPdf)) {
    copyFileSync(priorPdf, join(entryDir, 'yesterday.pdf'));
  }
  if (currentPdf && existsSync(currentPdf)) {
    copyFileSync(currentPdf, join(entryDir, 'today.pdf'));
  }

  const hasPdfs =
    existsSync(join(entryDir, 'yesterday.pdf')) && existsSync(join(entryDir, 'today.pdf'));
  const corpusStatus = pass && hasPdfs
    ? 'certified'
    : manual.new.length > 0
      ? (hasPdfs ? 'verified' : 'pending_pdfs')
      : 'pending_manual';

  const meta = {
    id: corpusId,
    jurisdiction: 'Sacramento County',
    priorDate: prior,
    currentDate: opsDate,
    status: corpusStatus,
    artifacts: {
      yesterdayPdf: 'yesterday.pdf',
      todayPdf: 'today.pdf',
      canonicalRoster: 'canonical-roster.json',
      manualClassification: 'manual-classification.md',
      niisOutput: 'niis-output.json',
      discrepancies: 'discrepancies.json',
      rootCause: 'root-cause.md',
      resolution: 'resolution.json',
    },
    manualSummary: {
      ...counts,
      note: 'Counts are consequences of the classification — never the gold standard itself.',
    },
    niisSummary: {
      newCount: niisReportableNames.length,
      existingCount: null,
      returningCount: null,
      reviewCount: null,
      missedInmates: diff.missedNew.length,
      falseNew: diff.falseNew.length,
    },
    certifiedAt: pass ? new Date().toISOString() : null,
    certifiedBy: 'record-daily-ground-truth',
    sourceClassification: basename(sourcePath),
  };
  writeFileSync(join(entryDir, 'meta.json'), JSON.stringify(meta, null, 2));
  writeFileSync(
    join(entryDir, 'discrepancies.json'),
    JSON.stringify({
      missedNew: diff.missedNew,
      falseNew: diff.falseNew,
      missedReturning: diff.missedReturning,
      classMismatches: diff.classMismatches,
      defectHint: inferDefectCategory({
        stage: 'Report generation',
        rule: 'manual classification vs getNewInmates',
        errorType: diff.missedNew.length ? 'missed_new' : 'false_new',
      }),
    }, null, 2),
  );
  writeFileSync(
    join(entryDir, 'niis-output.json'),
    JSON.stringify({
      reportableNames: niisReportableNames,
      count: niisReportableNames.length,
      recordedAt: new Date().toISOString(),
    }, null, 2),
  );
  writeFileSync(
    join(entryDir, 'root-cause.md'),
    [
      `# Root-cause analysis — ${corpusId}`,
      '',
      pass
        ? 'No discrepancies. NIIS matched investigator classification for reportable NEW(+RETURNING).'
        : [
            'Discrepancies require defect categorization:',
            '',
            '| Category | When to use |',
            '|---|---|',
            '| parser_defect | Page/row failed to parse |',
            '| ocr_defect | Name extracted incorrectly |',
            '| identity_defect | Alias / identity miss |',
            '| comparison_defect | Wrong NEW/EXISTING/RETURNING |',
            '| source_defect | PDF inconsistent |',
            '| manual_review | Ambiguous investigator correction |',
            '',
            `Missed NEW: ${diff.missedNew.length}`,
            ...diff.missedNew.map((n) => `- ${n}`),
            '',
            `False NEW: ${diff.falseNew.length}`,
            ...diff.falseNew.map((n) => `- ${n}`),
          ].join('\n'),
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(entryDir, 'resolution.json'),
    JSON.stringify({
      status: pass ? 'accepted' : 'open',
      resolvedAt: pass ? new Date().toISOString() : null,
      note: pass
        ? 'Matched investigator classification'
        : 'Open — diagnose via defect category before closing',
    }, null, 2),
  );

  // Update corpus index
  const indexPath = join(corpusRoot, 'index.json');
  if (existsSync(indexPath)) {
    const index = JSON.parse(readFileSync(indexPath, 'utf8')) as {
      entries: Array<Record<string, unknown>>;
    };
    const existing = index.entries.find((e) => e.id === corpusId || e.dir === corpusId);
    if (existing) {
      existing.status = corpusStatus;
      existing.priorDate = prior;
      existing.currentDate = opsDate;
    } else {
      index.entries.push({
        id: corpusId,
        priorDate: prior,
        currentDate: opsDate,
        status: corpusStatus,
        dir: corpusId,
        notes: counts.partial
          ? 'Partial classification (NEW only). Full NEW/EXISTING/RETURNING/REVIEW preferred.'
          : 'Investigator classification recorded.',
      });
    }
    writeFileSync(indexPath, JSON.stringify(index, null, 2));
  }

  const reportDir = resolve(import.meta.dirname, '../../reports/niis-reliability');
  mkdirSync(reportDir, { recursive: true });

  const cert = await recordEngineeringCertification({
    facility,
    priorDate: prior,
    currentDate: opsDate,
    priorInmateCount: null,
    currentInmateCount: null,
    newInmates: niisReportableNames.length,
    existingInmates: counts.existingCount || null,
    returningInmates: counts.returningCount || null,
    reviewRequired: counts.reviewCount || null,
    reconcileOk: null,
    precision,
    recall,
    potentialClientsFound: manual.new.length - diff.missedNew.length,
    potentialClientsMissed: diff.missedNew.length,
    processingTimeMs: Date.now() - started,
    status: pass ? 'pass' : 'fail',
    misses: diff.missedNew.map((name) => ({
      name,
      stage: 'Report generation',
      rule: 'manual classification vs getNewInmates',
      evidence: 'Absent from NIIS new-inmate report for ops date',
      why: 'Engineering defect — entered Learning Queue (comparison_defect until diagnosed)',
    })),
    extras: diff.falseNew.map((name) => ({
      name,
      stage: 'Report generation',
      rule: 'manual classification vs getNewInmates',
      evidence: 'Present in NIIS report but not in manual NEW/RETURNING',
      why: 'Engineering defect — entered Learning Queue (comparison_defect until diagnosed)',
    })),
    reportDir,
  });

  try {
    await appendEvidenceLedger({
      facility,
      opsDate,
      stage: 'manual_verification',
      summary:
        `Investigator classification recorded (NEW=${counts.newCount}`
        + `${counts.partial ? ', partial' : ''}; status=${pass ? 'match' : 'mismatch'})`,
      detail: { counts, diff, corpusEntryId: corpusId, sourcePath },
      certificationId: cert.certificationId,
      corpusEntryId: corpusId,
      actorName: manual.investigator ?? 'investigator',
    });
    await appendEvidenceLedger({
      facility,
      opsDate,
      stage: 'final_certification',
      summary: pass
        ? `PASS — NIIS matched investigator classification for ${opsDate}`
        : `FAIL — missed=${diff.missedNew.length} falseNew=${diff.falseNew.length}`,
      detail: {
        pass,
        precision,
        recall,
        certificationId: cert.certificationId,
        corpusStatus,
      },
      certificationId: cert.certificationId,
      corpusEntryId: corpusId,
    });
  } catch (err) {
    console.warn(
      'Evidence ledger write skipped (migrate InmateEvidenceLedger if needed):',
      err instanceof Error ? err.message : err,
    );
  }

  writeFileSync(
    join(dayDir, 'niis-certification.json'),
    JSON.stringify({
      opsDate,
      prior,
      pass,
      partial: counts.partial,
      goldNewCount: counts.newCount,
      niisCount: niisReportableNames.length,
      missedNew: diff.missedNew.length,
      falseNew: diff.falseNew.length,
      precision,
      recall,
      certificationId: cert.certificationId,
      corpusEntryId: corpusId,
      corpusStatus,
      note: 'Gold standard is the classification, not the NEW count.',
    }, null, 2),
  );

  const streak = await consecutivePassStreak(facility);

  console.log(`Ops date: ${opsDate} (prior ${prior})`);
  console.log(`Corpus entry: ${entryDir} status=${corpusStatus}`);
  console.log(`Missed NEW=${diff.missedNew.length}  False NEW=${diff.falseNew.length}`);
  console.log(`Precision=${(precision * 100).toFixed(1)}% Recall=${(recall * 100).toFixed(1)}%`);
  console.log(`Status: ${pass ? 'PASS' : 'FAIL'}  certificationId=${cert.certificationId}`);
  console.log(`Consecutive PASS streak: ${streak.streak}/${streak.required}  productionReady=${streak.productionReady}`);

  await prisma.$disconnect();
  process.exit(pass ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
