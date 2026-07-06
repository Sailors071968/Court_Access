// ============================================================================
// Program 118 — AI Safety Envelope
// Canonical wrapper for EVERY analytical / assistant output in CourtAccess.
// Enforces the Engineering Constitution: no citation → no evidence; no evidence
// → no finding; no finding → UNKNOWN; every conclusion auditable and hash
// verified; human review required when confidence is insufficient.
//
// This module is deterministic and dependency-free (node:crypto only) so any
// engine can adopt it without pulling in repositories or Prisma.
// ============================================================================

import { createHash } from 'node:crypto';

export const AI_SAFETY_ENVELOPE_VERSION = '1.0.0';

export type EnvelopeStatus = 'SUPPORTED' | 'UNKNOWN' | 'INSUFFICIENT_CONFIDENCE';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

/** A single evidence citation — no answer may assert a fact without one. */
export interface EnvelopeEvidence {
  evidenceId: string;
  role: 'supports' | 'contradicts' | 'mentions' | 'source';
  label?: string;
  excerpt?: string;
}

/** A single legal-authority citation. */
export interface EnvelopeAuthority {
  code?: string;
  section?: string;
  calcrimId?: string;
  authorityId?: string;
  label?: string;
}

export interface EnvelopeAudit {
  generatedAt: string;
  envelopeVersion: string;
  pipelineVersion: string;
  reasoning: string;
  repositorySources: string[];
}

/**
 * The safety envelope wrapping a structured answer of type `T`.
 * `contentHash` is a deterministic SHA-256 over the answer + citations so the
 * same inputs always produce the same, verifiable hash.
 */
export interface AiSafetyEnvelope<T> {
  answer: T;
  status: EnvelopeStatus;
  confidence: ConfidenceLevel;
  evidence: EnvelopeEvidence[];
  authorities: EnvelopeAuthority[];
  humanReviewRequired: boolean;
  audit: EnvelopeAudit;
  contentHash: string;
}

export interface BuildEnvelopeInput<T> {
  answer: T;
  evidence?: EnvelopeEvidence[];
  authorities?: EnvelopeAuthority[];
  confidence?: ConfidenceLevel;
  reasoning: string;
  repositorySources: string[];
  pipelineVersion?: string;
  /** Force human review regardless of computed status (e.g. contradiction present). */
  requireHumanReview?: boolean;
  /** Deterministic timestamp override (for reproducible tests / snapshots). */
  generatedAt?: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function envelopeHash(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

/**
 * Build a safety envelope, applying Constitution rules:
 *  - No evidence AND no authorities → status UNKNOWN, confidence UNKNOWN.
 *  - LOW or UNKNOWN confidence → human review required.
 *  - Contradiction / explicit flag → human review required.
 */
export function buildEnvelope<T>(input: BuildEnvelopeInput<T>): AiSafetyEnvelope<T> {
  const evidence = input.evidence ?? [];
  const authorities = input.authorities ?? [];
  const hasSupport = evidence.length > 0 || authorities.length > 0;

  let confidence: ConfidenceLevel = input.confidence ?? (hasSupport ? 'MEDIUM' : 'UNKNOWN');
  let status: EnvelopeStatus;

  if (!hasSupport) {
    // No citation → no finding → UNKNOWN.
    status = 'UNKNOWN';
    confidence = 'UNKNOWN';
  } else if (confidence === 'LOW' || confidence === 'UNKNOWN') {
    status = 'INSUFFICIENT_CONFIDENCE';
  } else {
    status = 'SUPPORTED';
  }

  const humanReviewRequired =
    Boolean(input.requireHumanReview) ||
    status !== 'SUPPORTED' ||
    confidence === 'LOW' ||
    confidence === 'UNKNOWN' ||
    evidence.some((e) => e.role === 'contradicts');

  const audit: EnvelopeAudit = {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    envelopeVersion: AI_SAFETY_ENVELOPE_VERSION,
    pipelineVersion: input.pipelineVersion ?? AI_SAFETY_ENVELOPE_VERSION,
    reasoning: input.reasoning,
    repositorySources: [...new Set(input.repositorySources)].sort(),
  };

  const contentHash = envelopeHash({
    answer: input.answer,
    status,
    confidence,
    evidence,
    authorities,
    repositorySources: audit.repositorySources,
  });

  return { answer: input.answer, status, confidence, evidence, authorities, humanReviewRequired, audit, contentHash };
}

/** An UNKNOWN envelope — the correct response when nothing supports an answer. */
export function unknownEnvelope<T>(answer: T, reasoning: string, repositorySources: string[], generatedAt?: string): AiSafetyEnvelope<T> {
  return buildEnvelope({ answer, reasoning, repositorySources, confidence: 'UNKNOWN', generatedAt });
}

export interface EnvelopeValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Continuous validation (Constitution #11): assert an envelope is well formed
 * and internally consistent. Used to gate outputs before they leave the API.
 */
export function validateEnvelope<T>(env: AiSafetyEnvelope<T>): EnvelopeValidation {
  const errors: string[] = [];
  if (env.answer === undefined || env.answer === null) errors.push('answer missing');
  if (!env.audit) errors.push('audit missing');
  else {
    if (!env.audit.generatedAt) errors.push('audit.generatedAt missing');
    if (!env.audit.envelopeVersion) errors.push('audit.envelopeVersion missing');
    if (!env.audit.reasoning) errors.push('audit.reasoning missing');
    if (!env.audit.repositorySources?.length) errors.push('audit.repositorySources missing');
  }
  if (!env.contentHash || env.contentHash.length !== 64) errors.push('contentHash invalid');

  const hasSupport = env.evidence.length > 0 || env.authorities.length > 0;
  if (env.status === 'SUPPORTED' && !hasSupport) errors.push('SUPPORTED without any evidence or authority');
  if (!hasSupport && env.status !== 'UNKNOWN') errors.push('no citations but status is not UNKNOWN');
  if ((env.confidence === 'LOW' || env.confidence === 'UNKNOWN') && !env.humanReviewRequired) {
    errors.push('low/unknown confidence must require human review');
  }

  // Recompute the hash to guarantee it was not tampered with.
  const recomputed = envelopeHash({
    answer: env.answer,
    status: env.status,
    confidence: env.confidence,
    evidence: env.evidence,
    authorities: env.authorities,
    repositorySources: env.audit?.repositorySources ?? [],
  });
  if (recomputed !== env.contentHash) errors.push('contentHash does not match content');

  return { valid: errors.length === 0, errors };
}
