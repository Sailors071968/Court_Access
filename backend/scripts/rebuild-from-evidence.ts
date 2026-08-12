#!/usr/bin/env tsx
/**
 * Rebuild / Replay from Evidence Packages — Immutable Evidence Directive.
 *
 * Proof that the repository is rebuildable from preserved evidence alone:
 *
 *   Delete Database (or use empty DB)
 *       ↓
 *   Replay Every Evidence Package
 *       ↓
 *   Produce Identical Results (vs sealed NIIS classification / manual gold)
 *
 * Usage:
 *   cd backend
 *   npm run cert:rebuild -- --packages ../fixtures/sacramento/evidence-packages
 *   npm run cert:rebuild -- --date 2026-08-10 --forensic
 *
 * Exit:
 *   0 = all replayable packages matched sealed/gold results
 *   1 = mismatch / FAIL
 *   2 = BLOCKED (no packages or missing PDFs)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parsePdfRoster } from '../src/intelligence/inmates/parsers/pdfParser.js';
import { SACRAMENTO_PDF } from '../src/intelligence/inmates/parsers/sacramento.js';
import { buildCanonicalRoster } from '../src/intelligence/inmates/canonicalRoster.js';
import { validateCanonicalRoster } from '../src/intelligence/inmates/parseValidation.js';
import {
  listEvidencePackages,
  loadEvidencePackageManifest,
  packagePaths,
  evidencePackageDir,
  DEFAULT_EVIDENCE_PACKAGES_ROOT,
} from '../src/intelligence/inmates/evidencePackage.js';
import {
  loadManualClassification,
  diffAgainstManual,
} from '../src/intelligence/inmates/manualClassification.js';
import { isForensicModeEnabled, writeForensicArtifacts } from '../src/intelligence/inmates/forensicMode.js';
import { currentPipelineVersions } from '../src/intelligence/inmates/pipelineVersions.js';
import { formatCertificationEvidence } from '../src/intelligence/inmates/unknown.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith('--')) {
    return process.argv[i + 1];
  }
  return undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function setDiff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((x) => !b.has(x)).sort();
}

async function replayOne(packageDir: string, forensic: boolean) {
  const manifest = loadEvidencePackageManifest(packageDir);
  if (!manifest) {
    return { opsDate: packageDir, status: 'BLOCKED' as const, detail: 'MANIFEST missing', missed: 0, falseNew: 0 };
  }
  const paths = packagePaths(packageDir);
  if (!paths.yesterdayPdf || !paths.todayPdf) {
    return {
      opsDate: manifest.opsDate,
      status: 'BLOCKED' as const,
      detail: 'Original PDFs absent from evidence package',
      missed: 0,
      falseNew: 0,
    };
  }

  const priorParse = await parsePdfRoster(paths.yesterdayPdf, SACRAMENTO_PDF.columnMap, {
    rosterDate: manifest.priorDate,
  });
  const currentParse = await parsePdfRoster(paths.todayPdf, SACRAMENTO_PDF.columnMap, {
    rosterDate: manifest.opsDate,
  });

  const priorRoster = buildCanonicalRoster({
    facility: manifest.facility,
    rosterDate: manifest.priorDate,
    records: priorParse.records,
    pageCount: priorParse.stats.pageCount,
    sourcePdf: paths.yesterdayPdf,
  });
  const currentRoster = buildCanonicalRoster({
    facility: manifest.facility,
    rosterDate: manifest.opsDate,
    records: currentParse.records,
    pageCount: currentParse.stats.pageCount,
    sourcePdf: paths.todayPdf,
  });

  const priorVal = validateCanonicalRoster(priorRoster, { emptyPages: priorParse.stats.emptyPages });
  const currentVal = validateCanonicalRoster(currentRoster, { emptyPages: currentParse.stats.emptyPages });

  const priorNames = new Set(priorRoster.inmates.map((m) => m.normalizedName));
  const replayNew = currentRoster.inmates
    .map((m) => m.normalizedName)
    .filter((n) => !priorNames.has(n))
    .sort();

  let missed = 0;
  let falseNew = 0;
  let status: 'PASS' | 'FAIL' | 'BLOCKED' | 'UNKNOWN' = 'UNKNOWN';
  let detail = '';

  if (paths.manualClassification) {
    const manual = loadManualClassification(paths.manualClassification, {
      defaultRosterDate: manifest.opsDate,
    });
    const niisByName = new Map<string, string>();
    for (const m of currentRoster.inmates) {
      niisByName.set(m.normalizedName, priorNames.has(m.normalizedName) ? 'existing' : 'new');
    }
    const diff = diffAgainstManual({
      manual,
      niisByName,
      niisReportableNames: replayNew,
    });
    missed = diff.missedNew.length;
    falseNew = diff.falseNew.length;
    status = diff.newPerfect && priorVal.ok && currentVal.ok ? 'PASS' : 'FAIL';
    detail = `vs manual: missed=${missed} falseNew=${falseNew} partial=${manual.partial}`;
  } else {
    // Compare against sealed NIIS classification if present
    const sealedPath = join(packageDir, 'analysis', 'niis-classification.json');
    if (existsSync(sealedPath)) {
      const sealed = JSON.parse(readFileSync(sealedPath, 'utf8')) as {
        reportableNames?: string[];
        niisNew?: string[];
      };
      const sealedNames = new Set(
        (sealed.reportableNames ?? sealed.niisNew ?? []).map((n) => n.toUpperCase().replace(/\s+/g, ' ').trim()),
      );
      const replaySet = new Set(replayNew);
      const fn = setDiff(sealedNames, replaySet);
      const fp = setDiff(replaySet, sealedNames);
      missed = fn.length;
      falseNew = fp.length;
      status = fn.length === 0 && fp.length === 0 && priorVal.ok && currentVal.ok ? 'PASS' : 'FAIL';
      detail = `vs sealed NIIS classification: missed=${missed} falseNew=${falseNew}`;
    } else {
      status = 'UNKNOWN';
      detail = 'No manual classification or sealed NIIS classification to compare';
    }
  }

  if (forensic) {
    writeForensicArtifacts(packageDir, {
      rawParserPrior: {
        pageCount: priorParse.stats.pageCount,
        emptyPages: priorParse.stats.emptyPages,
        recordCount: priorParse.records.length,
        records: priorParse.records,
      },
      rawParserCurrent: {
        pageCount: currentParse.stats.pageCount,
        emptyPages: currentParse.stats.emptyPages,
        recordCount: currentParse.records.length,
        records: currentParse.records,
      },
      reconciliation: {
        priorValidation: priorVal,
        currentValidation: currentVal,
        replayNewCount: replayNew.length,
      },
      comparisonCandidates: { replayNew },
      extra: {
        rebuildVersions: currentPipelineVersions({ forensicMode: true }),
      },
    });
  }

  return {
    opsDate: manifest.opsDate,
    status,
    detail,
    missed,
    falseNew,
    replayNewCount: replayNew.length,
    versions: manifest.versions,
  };
}

async function main() {
  const packagesRoot = resolve(arg('packages') ?? DEFAULT_EVIDENCE_PACKAGES_ROOT);
  const onlyDate = arg('date');
  const forensic = hasFlag('forensic') || isForensicModeEnabled();
  const outDir = resolve(arg('out') ?? join(import.meta.dirname, '../../reports/niis-reliability'));
  mkdirSync(outDir, { recursive: true });

  let dates = onlyDate ? [onlyDate] : listEvidencePackages(packagesRoot);
  if (onlyDate) {
    const dir = evidencePackageDir(onlyDate, packagesRoot);
    if (!existsSync(join(dir, 'MANIFEST.json'))) {
      console.error(`BLOCKED: no sealed evidence package at ${dir}`);
      process.exit(2);
    }
    dates = [onlyDate];
  }

  if (dates.length === 0) {
    console.error(`BLOCKED: no sealed evidence packages under ${packagesRoot}`);
    console.error('Seal packages via cert:daily-truth or sealEvidencePackage() first.');
    process.exit(2);
  }

  const results = [];
  for (const d of dates) {
    const dir = evidencePackageDir(d, packagesRoot);
    results.push(await replayOne(dir, forensic));
  }

  const runnable = results.filter((r) => r.status === 'PASS' || r.status === 'FAIL');
  const failed = results.filter((r) => r.status === 'FAIL');
  const blocked = results.filter((r) => r.status === 'BLOCKED');
  const missed = runnable.reduce((s, r) => s + r.missed, 0);
  const falseNew = runnable.reduce((s, r) => s + r.falseNew, 0);

  let releaseStatus: 'CERTIFIED' | 'FAIL' | 'BLOCKED' | 'UNKNOWN';
  if (failed.length) releaseStatus = 'FAIL';
  else if (runnable.length === 0) releaseStatus = 'BLOCKED';
  else releaseStatus = 'CERTIFIED';

  const evidence = formatCertificationEvidence({
    engine: 'Rebuild-from-Evidence — replay sealed Daily Evidence Packages',
    testDataset: `${dates.length} evidence package(s) under ${packagesRoot}`,
    rosterDate: onlyDate ?? 'multi',
    manualGroundTruthNew: null,
    niisResultNew: runnable.reduce((s, r) => s + (r.replayNewCount ?? 0), 0) || null,
    falsePositives: runnable.length ? falseNew : null,
    falseNegatives: runnable.length ? missed : null,
    precision: runnable.length && missed + falseNew === 0 ? 1 : runnable.length ? 0 : null,
    recall: runnable.length && missed === 0 ? 1 : runnable.length ? 0 : null,
    status: releaseStatus === 'CERTIFIED' ? 'CERTIFIED' : releaseStatus === 'FAIL' ? 'FAIL' : 'UNKNOWN',
  });

  const md = [
    '# Rebuild from Evidence Packages',
    '',
    '> Delete Database → Replay Every Evidence Package → Produce Identical Results',
    '',
    '```',
    evidence,
    '```',
    '',
    `| Package | Status | Missed | False new | Detail |`,
    `|---|---|---:|---:|---|`,
    ...results.map((r) => `| ${r.opsDate} | ${r.status} | ${r.missed} | ${r.falseNew} | ${r.detail} |`),
    '',
    `| Blocked | ${blocked.length} |`,
    `| Failed | ${failed.length} |`,
    `| Forensic mode | ${forensic ? 'ON' : 'OFF'} |`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
  ].join('\n');

  const outMd = join(outDir, 'REBUILD_FROM_EVIDENCE.md');
  writeFileSync(outMd, md);
  writeFileSync(outMd.replace(/\.md$/, '.json'), JSON.stringify({
    releaseStatus,
    packagesRoot,
    forensic,
    results,
    evidence,
    generatedAt: new Date().toISOString(),
  }, null, 2));

  console.log(md);
  process.exit(releaseStatus === 'CERTIFIED' ? 0 : releaseStatus === 'FAIL' ? 1 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
