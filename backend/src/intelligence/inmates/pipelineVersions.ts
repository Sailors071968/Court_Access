// ============================================================================
// Pipeline version stamps — every evidence package records which software
// produced its analysis. Determinism requires these to be explicit.
// ============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { PROCESSING_VERSION } from './canonicalRoster.js';
import { NORMALIZATION_VERSION } from './normalization.js';
import { RESOLVER_VERSION } from './identityResolution.js';

/** Identity resolver version (from identityResolution). */
export const IDENTITY_VERSION = RESOLVER_VERSION;

/** Roster set-diff / comparison engine version. */
export const COMPARISON_VERSION = 'roster-set-diff-1.0';

/** Evidence package format version (manifest schema). */
export const EVIDENCE_PACKAGE_FORMAT = 'evidence-package-1.0';

function readPackageVersion(): string {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string; name?: string };
      return pkg.version ?? 'UNKNOWN';
    }
  } catch {
    /* ignore */
  }
  return 'UNKNOWN';
}

export interface PipelineVersions {
  evidencePackageFormat: string;
  softwareVersion: string;
  processingVersion: string;
  parserVersion: string | null;
  identityVersion: string;
  normalizationVersion: string;
  comparisonVersion: string;
  sealedAt: string;
  forensicMode: boolean;
  nodeVersion: string;
  gitSha: string | null;
}

export function currentPipelineVersions(opts?: {
  parserVersion?: string | null;
  forensicMode?: boolean;
  gitSha?: string | null;
}): PipelineVersions {
  return {
    evidencePackageFormat: EVIDENCE_PACKAGE_FORMAT,
    softwareVersion: readPackageVersion(),
    processingVersion: PROCESSING_VERSION,
    parserVersion: opts?.parserVersion ?? null,
    identityVersion: IDENTITY_VERSION,
    normalizationVersion: NORMALIZATION_VERSION,
    comparisonVersion: COMPARISON_VERSION,
    sealedAt: new Date().toISOString(),
    forensicMode: Boolean(opts?.forensicMode),
    nodeVersion: process.version,
    gitSha: opts?.gitSha ?? process.env.GIT_SHA ?? process.env.COMMIT_SHA ?? null,
  };
}
