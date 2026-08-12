// ============================================================================
// Daily Evidence Package — the irreplaceable unit of NIIS truth.
//
// Original Sacramento County PDFs + investigator classifications cannot be
// rebuilt. Everything else can. Each morning seals one immutable package.
//
// If software improves later: new certification revision — never overwrite.
// ============================================================================

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { currentPipelineVersions, type PipelineVersions } from './pipelineVersions.js';
import { isForensicModeEnabled, writeForensicArtifacts, type ForensicArtifacts } from './forensicMode.js';
import {
  renderManualClassification,
  type ManualClassification,
  summaryCounts,
} from './manualClassification.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_EVIDENCE_PACKAGES_ROOT = resolve(
  MODULE_DIR,
  '../../../../fixtures/sacramento/evidence-packages',
);

export type EvidencePackageDisposition =
  | 'PASS'
  | 'FAIL'
  | 'BLOCKED'
  | 'PROVISIONAL'
  | 'PENDING_MANUAL'
  | 'UNKNOWN';

export interface EvidencePackageInput {
  facility: string;
  opsDate: string;
  priorDate: string;
  packagesRoot?: string;
  /** When true, refuse to mutate an already-sealed package (default true). */
  immutable?: boolean;
  forensic?: boolean;

  yesterdayPdfPath?: string | null;
  todayPdfPath?: string | null;

  canonicalYesterday?: unknown;
  canonicalToday?: unknown;
  niisClassification?: unknown;
  manualClassification?: ManualClassification | string | null;

  engineeringCertification?: unknown;
  engineeringCertificationMarkdown?: string | null;
  evidenceLedger?: unknown;
  learningQueueEntries?: unknown;
  generatedReport?: unknown;
  repositorySnapshot?: unknown;

  disposition?: EvidencePackageDisposition;
  certificationId?: string | null;
  certificationRevision?: number | null;
  supersedesCertificationId?: string | null;
  correctionReason?: string | null;
  reviewerName?: string | null;

  parserVersion?: string | null;
  forensicArtifacts?: ForensicArtifacts | null;

  /** Extra free-form notes for CASE.md */
  notes?: string | null;
}

export interface EvidencePackageManifest {
  format: string;
  facility: string;
  opsDate: string;
  priorDate: string;
  sealedAt: string;
  disposition: EvidencePackageDisposition;
  immutable: true;
  certificationId: string | null;
  certificationRevision: number | null;
  supersedesCertificationId: string | null;
  correctionReason: string | null;
  reviewerName: string | null;
  versions: PipelineVersions;
  artifacts: Record<string, { path: string; sha256: string | null; bytes: number | null }>;
  contentHash: string;
  note: string;
}

function sha256File(path: string): { sha256: string; bytes: number } {
  const buf = readFileSync(path);
  return {
    sha256: createHash('sha256').update(buf).digest('hex'),
    bytes: buf.length,
  };
}

function sha256Json(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return createHash('sha256').update(text).digest('hex');
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function copyIfPresent(src: string | null | undefined, dest: string): boolean {
  if (!src || !existsSync(src)) return false;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  return true;
}

export function evidencePackageDir(opsDate: string, packagesRoot?: string): string {
  return join(packagesRoot ?? DEFAULT_EVIDENCE_PACKAGES_ROOT, opsDate.slice(0, 10));
}

export function isPackageSealed(packageDir: string): boolean {
  return existsSync(join(packageDir, 'MANIFEST.json'));
}

function renderCaseMarkdown(args: {
  facility: string;
  opsDate: string;
  priorDate: string;
  disposition: EvidencePackageDisposition;
  versions: PipelineVersions;
  certificationId: string | null;
  revision: number | null;
  notes?: string | null;
}): string {
  return [
    `# Case — ${args.facility} Jail — ${args.opsDate}`,
    '',
    '> Treat every day like a criminal case file. Nothing gets replaced. Nothing disappears.',
    '',
    `**Disposition:** ${args.disposition}`,
    `**Compared Against:** ${args.priorDate}`,
    `**Certification:** ${args.certificationId ?? 'NONE'} (revision ${args.revision ?? 'n/a'})`,
    `**Sealed:** ${args.versions.sealedAt}`,
    '',
    '## Evidence',
    '',
    '- Original Yesterday PDF',
    '- Original Today PDF',
    '',
    '## Analysis',
    '',
    '- Canonical Yesterday Roster',
    '- Canonical Today Roster',
    '- NIIS Classification',
    '- Manual Classification (investigator gold standard)',
    '',
    '## Certification',
    '',
    '- Engineering Certification',
    '- Evidence Ledger',
    '- Learning Queue Entries',
    '',
    '## Versions',
    '',
    `| Component | Version |`,
    `|---|---|`,
    `| Software | ${args.versions.softwareVersion} |`,
    `| Parser | ${args.versions.parserVersion ?? 'UNKNOWN'} |`,
    `| Identity | ${args.versions.identityVersion} |`,
    `| Normalization | ${args.versions.normalizationVersion} |`,
    `| Comparison | ${args.versions.comparisonVersion} |`,
    `| Processing | ${args.versions.processingVersion} |`,
    '',
    args.notes ? `## Notes\n\n${args.notes}\n` : '',
  ].join('\n');
}

/**
 * Seal (or append a certification revision into) a Daily Evidence Package.
 *
 * Default behavior: if MANIFEST.json already exists, do **not** overwrite
 * evidence/analysis. Only append under certification/revisions/<N>/ and update
 * a pointer file `certification/CURRENT.json` (pointer may move; history stays).
 */
export function sealEvidencePackage(input: EvidencePackageInput): {
  packageDir: string;
  manifest: EvidencePackageManifest;
  created: boolean;
  revisionDir: string | null;
} {
  const opsDate = input.opsDate.slice(0, 10);
  const priorDate = input.priorDate.slice(0, 10);
  const root = input.packagesRoot ?? DEFAULT_EVIDENCE_PACKAGES_ROOT;
  const packageDir = evidencePackageDir(opsDate, root);
  const forensic = isForensicModeEnabled(input.forensic);
  const versions = currentPipelineVersions({
    parserVersion: input.parserVersion,
    forensicMode: forensic,
  });
  const disposition = input.disposition
    ?? (input.engineeringCertification
      ? ((input.engineeringCertification as { status?: string }).status?.toUpperCase() as EvidencePackageDisposition)
        || 'UNKNOWN'
      : 'UNKNOWN');

  const alreadySealed = isPackageSealed(packageDir);
  const immutable = input.immutable !== false;

  mkdirSync(packageDir, { recursive: true });
  mkdirSync(join(packageDir, 'evidence'), { recursive: true });
  mkdirSync(join(packageDir, 'analysis'), { recursive: true });
  mkdirSync(join(packageDir, 'certification'), { recursive: true });
  mkdirSync(join(packageDir, 'disposition'), { recursive: true });
  mkdirSync(join(packageDir, 'versions'), { recursive: true });

  // ---- Evidence (PDFs) — write once ----
  if (!alreadySealed || !immutable) {
    copyIfPresent(input.yesterdayPdfPath, join(packageDir, 'evidence', 'yesterday.pdf'));
    copyIfPresent(input.todayPdfPath, join(packageDir, 'evidence', 'today.pdf'));
  } else {
    // Allow filling missing PDFs only if slot empty (preservation, not overwrite).
    if (input.yesterdayPdfPath && !existsSync(join(packageDir, 'evidence', 'yesterday.pdf'))) {
      copyIfPresent(input.yesterdayPdfPath, join(packageDir, 'evidence', 'yesterday.pdf'));
    }
    if (input.todayPdfPath && !existsSync(join(packageDir, 'evidence', 'today.pdf'))) {
      copyIfPresent(input.todayPdfPath, join(packageDir, 'evidence', 'today.pdf'));
    }
  }

  // ---- Analysis — write once (first seal); later seals go to analysis/revisions ----
  const writeAnalysis = (dir: string) => {
    if (input.canonicalYesterday !== undefined) {
      writeJson(join(dir, 'canonical-yesterday.json'), input.canonicalYesterday);
    }
    if (input.canonicalToday !== undefined) {
      writeJson(join(dir, 'canonical-today.json'), input.canonicalToday);
    }
    if (input.niisClassification !== undefined) {
      writeJson(join(dir, 'niis-classification.json'), input.niisClassification);
    }
    if (input.manualClassification != null) {
      const text = typeof input.manualClassification === 'string'
        ? input.manualClassification
        : renderManualClassification(input.manualClassification);
      writeText(join(dir, 'manual-classification.md'), text);
      if (typeof input.manualClassification !== 'string') {
        writeJson(join(dir, 'manual-classification.json'), {
          ...summaryCounts(input.manualClassification),
          rosterDate: input.manualClassification.rosterDate,
          priorDate: input.manualClassification.priorDate,
        });
      }
    }
  };

  if (!alreadySealed) {
    writeAnalysis(join(packageDir, 'analysis'));
  } else if (
    input.canonicalYesterday !== undefined
    || input.canonicalToday !== undefined
    || input.niisClassification !== undefined
    || input.manualClassification != null
  ) {
    // Superseding analysis — append, do not overwrite original analysis/
    const rev = input.certificationRevision ?? Date.now();
    const analysisRev = join(packageDir, 'analysis', 'revisions', String(rev));
    mkdirSync(analysisRev, { recursive: true });
    writeAnalysis(analysisRev);
  }

  // ---- Certification — always append revisions; CURRENT pointer may move ----
  const revision = input.certificationRevision ?? 1;
  const revisionDir = join(packageDir, 'certification', 'revisions', String(revision));
  mkdirSync(revisionDir, { recursive: true });

  if (input.engineeringCertification !== undefined) {
    writeJson(join(revisionDir, 'engineering-certification.json'), input.engineeringCertification);
  }
  if (input.engineeringCertificationMarkdown) {
    writeText(join(revisionDir, 'engineering-certification.md'), input.engineeringCertificationMarkdown);
  }
  if (input.evidenceLedger !== undefined) {
    writeJson(join(revisionDir, 'evidence-ledger.json'), input.evidenceLedger);
  }
  if (input.learningQueueEntries !== undefined) {
    writeJson(join(revisionDir, 'learning-queue.json'), input.learningQueueEntries);
  }
  writeJson(join(revisionDir, 'meta.json'), {
    certificationId: input.certificationId ?? null,
    revision,
    supersedesCertificationId: input.supersedesCertificationId ?? null,
    correctionReason: input.correctionReason ?? null,
    reviewerName: input.reviewerName ?? null,
    disposition,
    sealedAt: versions.sealedAt,
  });

  // CURRENT pointer (allowed to move — history stays in revisions/)
  writeJson(join(packageDir, 'certification', 'CURRENT.json'), {
    certificationId: input.certificationId ?? null,
    revision,
    path: `revisions/${revision}`,
    disposition,
    updatedAt: versions.sealedAt,
  });

  // Convenience copies of latest at certification/ root (clearly marked as current view)
  if (input.engineeringCertification !== undefined) {
    writeJson(join(packageDir, 'certification', 'engineering-certification.CURRENT.json'), input.engineeringCertification);
  }
  if (input.engineeringCertificationMarkdown) {
    writeText(join(packageDir, 'certification', 'engineering-certification.CURRENT.md'), input.engineeringCertificationMarkdown);
  }

  // ---- Disposition / versions ----
  if (input.generatedReport !== undefined) {
    const dest = alreadySealed
      ? join(packageDir, 'disposition', 'revisions', String(revision), 'report.json')
      : join(packageDir, 'disposition', 'report.json');
    writeJson(dest, input.generatedReport);
  }
  if (input.repositorySnapshot !== undefined) {
    const dest = alreadySealed
      ? join(packageDir, 'disposition', 'revisions', String(revision), 'repository-snapshot.json')
      : join(packageDir, 'disposition', 'repository-snapshot.json');
    writeJson(dest, input.repositorySnapshot);
  }

  writeJson(join(packageDir, 'versions', `software-r${revision}.json`), versions);
  writeJson(join(packageDir, 'versions', 'software.CURRENT.json'), versions);

  if (forensic && input.forensicArtifacts) {
    writeForensicArtifacts(packageDir, input.forensicArtifacts);
  }

  writeText(
    join(packageDir, 'CASE.md'),
    renderCaseMarkdown({
      facility: input.facility,
      opsDate,
      priorDate,
      disposition,
      versions,
      certificationId: input.certificationId ?? null,
      revision,
      notes: input.notes,
    }),
  );

  // ---- Manifest ----
  const artifactPaths = [
    'evidence/yesterday.pdf',
    'evidence/today.pdf',
    'analysis/canonical-yesterday.json',
    'analysis/canonical-today.json',
    'analysis/niis-classification.json',
    'analysis/manual-classification.md',
    'certification/CURRENT.json',
    'CASE.md',
  ];
  const artifacts: EvidencePackageManifest['artifacts'] = {};
  for (const rel of artifactPaths) {
    const abs = join(packageDir, rel);
    if (!existsSync(abs)) {
      artifacts[rel] = { path: rel, sha256: null, bytes: null };
      continue;
    }
    const { sha256, bytes } = sha256File(abs);
    artifacts[rel] = { path: rel, sha256, bytes };
  }

  const contentHash = sha256Json({
    opsDate,
    priorDate,
    artifacts,
    revision,
    certificationId: input.certificationId ?? null,
  });

  const manifest: EvidencePackageManifest = {
    format: versions.evidencePackageFormat,
    facility: input.facility,
    opsDate,
    priorDate,
    sealedAt: alreadySealed && immutable
      ? (JSON.parse(readFileSync(join(packageDir, 'MANIFEST.json'), 'utf8')) as EvidencePackageManifest).sealedAt
      : versions.sealedAt,
    disposition,
    immutable: true,
    certificationId: input.certificationId ?? null,
    certificationRevision: revision,
    supersedesCertificationId: input.supersedesCertificationId ?? null,
    correctionReason: input.correctionReason ?? null,
    reviewerName: input.reviewerName ?? null,
    versions,
    artifacts,
    contentHash,
    note:
      'Immutable evidence package. Original PDFs + investigator classifications are irreplaceable. '
      + 'Software improvements create new certification revisions — they never overwrite sealed evidence.',
  };

  // Manifest: first seal writes MANIFEST.json; later seals append MANIFEST.revisions.jsonl
  if (!alreadySealed) {
    writeJson(join(packageDir, 'MANIFEST.json'), manifest);
  } else {
    const line = JSON.stringify({ ...manifest, appendedAt: versions.sealedAt });
    writeFileSync(join(packageDir, 'MANIFEST.revisions.jsonl'), `${line}\n`, { flag: 'a' });
    // Update only mutable pointer fields on a SIDECAR — never rewrite original MANIFEST.json body for evidence hashes
    writeJson(join(packageDir, 'MANIFEST.CURRENT.json'), manifest);
  }

  return {
    packageDir,
    manifest,
    created: !alreadySealed,
    revisionDir,
  };
}

export function listEvidencePackages(packagesRoot?: string): string[] {
  const root = packagesRoot ?? DEFAULT_EVIDENCE_PACKAGES_ROOT;
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name) && statSync(join(root, name)).isDirectory())
    .filter((name) => isPackageSealed(join(root, name)))
    .sort();
}

export function loadEvidencePackageManifest(packageDir: string): EvidencePackageManifest | null {
  const current = join(packageDir, 'MANIFEST.CURRENT.json');
  const original = join(packageDir, 'MANIFEST.json');
  const path = existsSync(current) ? current : original;
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as EvidencePackageManifest;
}

export function packagePaths(packageDir: string): {
  yesterdayPdf: string | null;
  todayPdf: string | null;
  manualClassification: string | null;
  canonicalYesterday: string | null;
  canonicalToday: string | null;
} {
  const y = join(packageDir, 'evidence', 'yesterday.pdf');
  const t = join(packageDir, 'evidence', 'today.pdf');
  const m = join(packageDir, 'analysis', 'manual-classification.md');
  const cy = join(packageDir, 'analysis', 'canonical-yesterday.json');
  const ct = join(packageDir, 'analysis', 'canonical-today.json');
  return {
    yesterdayPdf: existsSync(y) ? y : null,
    todayPdf: existsSync(t) ? t : null,
    manualClassification: existsSync(m) ? m : null,
    canonicalYesterday: existsSync(cy) ? cy : null,
    canonicalToday: existsSync(ct) ? ct : null,
  };
}

export function readPackageFileBasename(path: string): string {
  return basename(path);
}
