// ============================================================================
// Forensic Mode — preserve everything from a daily run when validating parsers,
// investigating discrepancies, or introducing major algorithm changes.
//
// Enable via NIIS_FORENSIC_MODE=1 or explicit opts.forensic = true.
// Not required every day — optional deep evidence capture.
// ============================================================================

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function isForensicModeEnabled(explicit?: boolean): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  const v = (process.env.NIIS_FORENSIC_MODE ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export interface ForensicArtifacts {
  rawParserPrior?: unknown;
  rawParserCurrent?: unknown;
  normalizedRecords?: unknown;
  comparisonCandidates?: unknown;
  identityDecisions?: unknown;
  ruleEvaluations?: unknown;
  discardedCandidates?: unknown;
  confidenceCalculations?: unknown;
  reconciliation?: unknown;
  extra?: Record<string, unknown>;
}

const FILE_MAP: { key: keyof ForensicArtifacts; file: string }[] = [
  { key: 'rawParserPrior', file: 'raw-parser-prior.json' },
  { key: 'rawParserCurrent', file: 'raw-parser-current.json' },
  { key: 'normalizedRecords', file: 'normalized-records.json' },
  { key: 'comparisonCandidates', file: 'comparison-candidates.json' },
  { key: 'identityDecisions', file: 'identity-decisions.json' },
  { key: 'ruleEvaluations', file: 'rule-evaluations.json' },
  { key: 'discardedCandidates', file: 'discarded-candidates.json' },
  { key: 'confidenceCalculations', file: 'confidence-calculations.json' },
  { key: 'reconciliation', file: 'reconciliation.json' },
];

/**
 * Write forensic artifacts under <packageDir>/forensic/.
 * Never overwrites an already-sealed forensic directory — writes to
 * forensic/revisions/<timestamp>/ instead if forensic/ already exists.
 */
export function writeForensicArtifacts(
  packageDir: string,
  artifacts: ForensicArtifacts,
): { dir: string; files: string[] } {
  const base = join(packageDir, 'forensic');
  let dir = base;
  if (existsSync(join(base, 'MANIFEST.json')) || existsSync(join(base, 'reconciliation.json'))) {
    dir = join(base, 'revisions', new Date().toISOString().replace(/[:.]/g, '-'));
  }
  mkdirSync(dir, { recursive: true });

  const files: string[] = [];
  for (const { key, file } of FILE_MAP) {
    const value = artifacts[key];
    if (value === undefined) continue;
    const path = join(dir, file);
    writeFileSync(path, JSON.stringify(value, null, 2));
    files.push(file);
  }
  if (artifacts.extra) {
    for (const [name, value] of Object.entries(artifacts.extra)) {
      const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const file = `${safe}.json`;
      writeFileSync(join(dir, file), JSON.stringify(value, null, 2));
      files.push(file);
    }
  }

  writeFileSync(
    join(dir, 'MANIFEST.json'),
    JSON.stringify({
      mode: 'forensic',
      writtenAt: new Date().toISOString(),
      files,
      note: 'Forensic capture — raw pipeline intermediates. Do not treat as gold standard.',
    }, null, 2),
  );
  files.push('MANIFEST.json');

  return { dir, files };
}
