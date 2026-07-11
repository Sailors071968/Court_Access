// ============================================================================
// Criminal Liability Repository Intelligence + Coverage Dashboard (Program 68A)
// Phase 3 — Cross-reference expansion target discovery
// Phase 4 — Repository intelligence registry (known criminal / noncriminal /
//           pending / unknown, with confidence, hash, version, last reviewed)
// Phase 5 — Coverage dashboard
//
// Reads only what has actually been acquired + classified. Never asserts
// criminal liability that the classifier did not measure — unclassified or
// low-confidence sections are UNKNOWN, never criminal.
// ============================================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { CRIMINAL_SEEDS } from './criminalSeeds.ts';

const CRIMINAL_CODES = new Set(Object.keys(CRIMINAL_SEEDS));

export type RegistryStatus = 'known_criminal' | 'known_noncriminal' | 'pending_review' | 'unknown';

export interface RegistryEntry {
  code: string;
  section: string;
  status: RegistryStatus;
  criminalityScore: number;
  classification: string;
  classificationConfidence: string;
  criminalLiabilityLikely: boolean;
  discoveryPriority: string;
  offenseCount: number;
  repositorySource: string;
  hash: string | null;
  version: string;
  lastReviewed: string;
}

type Json = Record<string, unknown>;

/** Read a JSONL repository file, deduplicated by `id` (last write wins). */
async function readJsonl(path: string): Promise<Json[]> {
  try {
    const raw = await readFile(path, 'utf-8');
    const byId = new Map<string, Json>();
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const record = JSON.parse(trimmed) as Json;
      byId.set(String(record.id), record);
    }
    return [...byId.values()];
  } catch {
    return [];
  }
}

function sectionKey(code: string, section: string): string {
  return `${code.toUpperCase()} ${section}`;
}

const CRIMINAL_VALUES = new Set(['criminal_offense', 'criminal_penalty', 'criminal_enhancement']);
const NONCRIMINAL_VALUES = new Set([
  'administrative',
  'licensing',
  'procedure',
  'evidence',
  'civil',
  'definitions',
  'sentencing_provision',
  'cross_reference',
]);

function deriveStatus(classification: Json): RegistryStatus {
  // A positive criminal-liability finding is the only path to known_criminal.
  if (classification.criminalLiabilityLikely === true) return 'known_criminal';

  const clsField = (classification.classification ?? {}) as Json;
  const value = String(clsField.value ?? 'unknown');
  const confidence = String(clsField.confidence ?? 'LOW');

  if (value === 'unknown') return 'unknown';

  // Criminal-flavored classification without a positive liability finding is a
  // contradiction that must be reviewed — never silently skipped.
  if (CRIMINAL_VALUES.has(value)) return 'pending_review';

  if (NONCRIMINAL_VALUES.has(value)) {
    // Only a confident non-criminal classification justifies skipping re-crawl.
    // Low-confidence non-criminal signals stay in review (UNKNOWN over an
    // unsupported "no criminal liability" conclusion).
    return confidence === 'HIGH' || confidence === 'MEDIUM' ? 'known_noncriminal' : 'pending_review';
  }

  return 'unknown';
}

export interface RegistryBuild {
  entries: RegistryEntry[];
  registryPath: string;
  generatedAt: string;
}

/**
 * Phase 4 — Build the repository intelligence registry from acquired +
 * classified statutes. This is the source of truth for which sections to skip
 * (known_noncriminal) vs. re-examine.
 */
export async function buildLiabilityRegistry(repositoryDir: string): Promise<RegistryBuild> {
  const repoDir = resolve(repositoryDir);
  const classifications = await readJsonl(join(repoDir, 'statute_classifications', 'records.jsonl'));
  const statutes = await readJsonl(join(repoDir, 'statutes', 'records.jsonl'));
  const offenses = await readJsonl(join(repoDir, 'offenses', 'records.jsonl'));

  const statuteById = new Map(statutes.map((s) => [String(s.id), s]));
  const offenseCountByStatute = new Map<string, number>();
  for (const offense of offenses) {
    const sid = String(offense.sourceStatuteId ?? '');
    offenseCountByStatute.set(sid, (offenseCountByStatute.get(sid) ?? 0) + 1);
  }

  const entries: RegistryEntry[] = classifications.map((cls) => {
    const sid = String(cls.sourceStatuteId ?? '');
    const statute = statuteById.get(sid);
    const clsField = (cls.classification ?? {}) as Json;
    const audit = (statute?.audit ?? {}) as Json;
    return {
      code: String(cls.code ?? statute?.code ?? 'UNKNOWN'),
      section: String(cls.section ?? statute?.section ?? 'UNKNOWN'),
      status: deriveStatus(cls),
      criminalityScore: Number(cls.priorityScore ?? 0),
      classification: String(clsField.value ?? 'unknown'),
      classificationConfidence: String(clsField.confidence ?? 'LOW'),
      criminalLiabilityLikely: cls.criminalLiabilityLikely === true,
      discoveryPriority: String(cls.discoveryPriority ?? 'deferred'),
      offenseCount: offenseCountByStatute.get(sid) ?? 0,
      repositorySource: 'statute_classifications',
      hash: (audit.contentHash as string) ?? (statute?.contentHash as string) ?? null,
      version: '1.0.0',
      lastReviewed: String((audit.extractedAt as string) ?? cls.reviewedAt ?? new Date().toISOString()),
    };
  });

  entries.sort((a, b) => b.criminalityScore - a.criminalityScore);

  const generatedAt = new Date().toISOString();
  const registryPath = join(repoDir, 'criminal-liability-registry.json');
  await mkdir(dirname(registryPath), { recursive: true });
  await writeFile(
    registryPath,
    JSON.stringify({ version: '1.0.0', generatedAt, count: entries.length, entries }, null, 2),
    'utf-8',
  );

  return { entries, registryPath, generatedAt };
}

/** Set of section keys that are confirmed non-criminal and safe to skip. */
export async function knownNoncriminalSections(repositoryDir: string): Promise<Set<string>> {
  const { entries } = await buildLiabilityRegistry(repositoryDir);
  const skip = new Set<string>();
  for (const e of entries) {
    if (e.status === 'known_noncriminal') skip.add(sectionKey(e.code, e.section));
  }
  return skip;
}

export interface CrossRefTarget {
  code: string;
  section: string;
  fromStatuteId: string;
  referenceType: string;
  confidence: string;
}

/**
 * Phase 3 — Discover cross-reference expansion targets from confirmed criminal
 * statutes. Returns referenced sections (in criminal-priority codes) that have
 * NOT yet been acquired, so the engine can expand outward.
 */
export async function discoverCrossReferenceTargets(
  repositoryDir: string,
  options: { code?: string; onlyFromCriminal?: boolean } = {},
): Promise<{ targets: CrossRefTarget[]; alreadyAcquired: number; total: number }> {
  const repoDir = resolve(repositoryDir);
  const crossRefs = await readJsonl(join(repoDir, 'cross_references', 'records.jsonl'));
  const classifications = await readJsonl(join(repoDir, 'statute_classifications', 'records.jsonl'));
  const statutes = await readJsonl(join(repoDir, 'statutes', 'records.jsonl'));

  const acquiredKeys = new Set(statutes.map((s) => sectionKey(String(s.code), String(s.section))));
  const criminalStatuteIds = new Set(
    classifications.filter((c) => c.criminalLiabilityLikely === true).map((c) => String(c.sourceStatuteId)),
  );

  const seen = new Set<string>();
  const targets: CrossRefTarget[] = [];
  let alreadyAcquired = 0;

  for (const ref of crossRefs) {
    const targetCode = String(ref.targetCode ?? '').toUpperCase();
    const targetSection = String(ref.targetSection ?? '');
    if (!targetCode || !targetSection) continue;
    if (options.code && targetCode !== options.code.toUpperCase()) continue;
    if (!CRIMINAL_CODES.has(targetCode)) continue;
    if (options.onlyFromCriminal && !criminalStatuteIds.has(String(ref.sourceStatuteId))) continue;

    const key = sectionKey(targetCode, targetSection);
    if (acquiredKeys.has(key)) {
      alreadyAcquired += 1;
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);

    const context = (ref.context ?? {}) as Json;
    targets.push({
      code: targetCode,
      section: targetSection,
      fromStatuteId: String(ref.sourceStatuteId ?? ''),
      referenceType: String(ref.referenceType ?? 'section'),
      confidence: String(context.confidence ?? 'UNKNOWN'),
    });
  }

  return { targets, alreadyAcquired, total: crossRefs.length };
}

export interface CodeCoverage {
  code: string;
  total: number;
  criminalSections: number;
  administrativeSections: number;
  pending: number;
  unknown: number;
  offenses: number;
  discoveryRate: number;
  hashedSections: number;
}

export interface CoverageDashboard {
  version: string;
  generatedAt: string;
  totals: Omit<CodeCoverage, 'code'> & { crossReferenceCompleteness: number; hashVerification: number };
  byCode: CodeCoverage[];
  crossReference: { total: number; acquired: number; pending: number; completeness: number };
}

/**
 * Phase 5 — Coverage dashboard aggregated from the registry + cross-reference
 * repository. All numbers are measured, never estimated.
 */
export async function buildCoverageDashboard(repositoryDir: string): Promise<{ dashboard: CoverageDashboard; jsonPath: string; markdownPath: string }> {
  const repoDir = resolve(repositoryDir);
  const { entries } = await buildLiabilityRegistry(repoDir);
  const xref = await discoverCrossReferenceTargets(repoDir, {});

  const byCodeMap = new Map<string, CodeCoverage>();
  for (const e of entries) {
    let cov = byCodeMap.get(e.code);
    if (!cov) {
      cov = { code: e.code, total: 0, criminalSections: 0, administrativeSections: 0, pending: 0, unknown: 0, offenses: 0, discoveryRate: 0, hashedSections: 0 };
      byCodeMap.set(e.code, cov);
    }
    cov.total += 1;
    cov.offenses += e.offenseCount;
    if (e.hash) cov.hashedSections += 1;
    if (e.status === 'known_criminal') cov.criminalSections += 1;
    else if (e.status === 'known_noncriminal') cov.administrativeSections += 1;
    else if (e.status === 'pending_review') cov.pending += 1;
    else cov.unknown += 1;
  }
  for (const cov of byCodeMap.values()) {
    cov.discoveryRate = cov.total > 0 ? Number((cov.offenses / cov.total).toFixed(3)) : 0;
  }

  const byCode = [...byCodeMap.values()].sort((a, b) => b.criminalSections - a.criminalSections);
  const acc = byCode.reduce(
    (t, c) => ({
      total: t.total + c.total,
      criminalSections: t.criminalSections + c.criminalSections,
      administrativeSections: t.administrativeSections + c.administrativeSections,
      pending: t.pending + c.pending,
      unknown: t.unknown + c.unknown,
      offenses: t.offenses + c.offenses,
      hashedSections: t.hashedSections + c.hashedSections,
    }),
    { total: 0, criminalSections: 0, administrativeSections: 0, pending: 0, unknown: 0, offenses: 0, hashedSections: 0 },
  );

  const xrefAcquired = xref.alreadyAcquired;
  const xrefTotal = xref.alreadyAcquired + xref.targets.length;
  const completeness = xrefTotal > 0 ? Number((xrefAcquired / xrefTotal).toFixed(3)) : 1;

  const generatedAt = new Date().toISOString();
  const dashboard: CoverageDashboard = {
    version: '1.0.0',
    generatedAt,
    totals: {
      ...acc,
      discoveryRate: acc.total > 0 ? Number((acc.offenses / acc.total).toFixed(3)) : 0,
      crossReferenceCompleteness: completeness,
      hashVerification: acc.total > 0 ? Number((acc.hashedSections / acc.total).toFixed(3)) : 0,
    },
    byCode,
    crossReference: { total: xrefTotal, acquired: xrefAcquired, pending: xref.targets.length, completeness },
  };

  const jsonPath = join(repoDir, 'criminal-liability-dashboard.json');
  await writeFile(jsonPath, JSON.stringify(dashboard, null, 2), 'utf-8');

  const md = renderDashboardMarkdown(dashboard);
  const markdownPath = join(repoDir, 'criminal-liability-dashboard.md');
  await writeFile(markdownPath, md, 'utf-8');

  return { dashboard, jsonPath, markdownPath };
}

function renderDashboardMarkdown(d: CoverageDashboard): string {
  const rows = d.byCode
    .map(
      (c) =>
        `| ${c.code} | ${c.total} | ${c.criminalSections} | ${c.administrativeSections} | ${c.pending} | ${c.unknown} | ${c.offenses} | ${c.discoveryRate} | ${c.hashedSections}/${c.total} |`,
    )
    .join('\n');
  return `# Criminal Liability Coverage Dashboard

Generated: ${d.generatedAt}

## Totals

- Sections classified: **${d.totals.total}**
- Known criminal sections: **${d.totals.criminalSections}**
- Known administrative (noncriminal) sections: **${d.totals.administrativeSections}**
- Pending review: **${d.totals.pending}**
- Unknown: **${d.totals.unknown}**
- Offenses identified: **${d.totals.offenses}**
- Discovery rate (offenses/section): **${d.totals.discoveryRate}**
- Hash verification: **${(d.totals.hashVerification * 100).toFixed(1)}%** (${d.totals.hashedSections}/${d.totals.total})
- Cross-reference completeness: **${(d.totals.crossReferenceCompleteness * 100).toFixed(1)}%** (${d.crossReference.acquired}/${d.crossReference.total} referenced criminal-code sections acquired; ${d.crossReference.pending} pending)

## By Code

| Code | Classified | Criminal | Administrative | Pending | Unknown | Offenses | Discovery Rate | Hashed |
|------|-----------|----------|----------------|---------|---------|----------|----------------|--------|
${rows}

_All values measured from acquired + classified statutes. Unclassified or low-confidence sections are reported as UNKNOWN, never criminal._
`;
}
