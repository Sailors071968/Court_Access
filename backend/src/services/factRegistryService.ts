// ============================================================================
// PR 4 — Verified Fact Registry
// Canonical, immutable source of verified facts for each case.
// Every fact is:
//   - SHA-256 hashed for tamper detection
//   - Tenant-isolated (tenantId on every record)
//   - Immutable once locked (lockedAt timestamp prevents mutation)
//   - Source-attributed (which evidence produced this fact)
//
// Design:
//   - Facts are extracted from pipeline outputs (timeline events, claims, etc.)
//   - Each fact has a confidence score and source chain
//   - Once verified by the pipeline, a fact is "locked" — no further edits
//   - Locked facts serve as the single source of truth for reports/exports
// ============================================================================

import { createHash } from 'crypto';
import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FactInput {
  caseId: string;
  tenantId: string;
  factType: string;       // event | claim | observation | measurement | identity | location | timestamp_anchor
  content: string;        // The fact statement
  sourceEvidenceId: string;
  sourceType: string;     // timeline_event | narrative_claim | evidence_event | manual
  confidence: number;     // 0.0 - 1.0
  metadata?: Record<string, unknown>;
}

export interface VerifiedFactRecord {
  factId: string;
  caseId: string;
  tenantId: string;
  factType: string;
  content: string;
  contentHash: string;
  sourceEvidenceId: string;
  sourceType: string;
  confidence: number;
  lockedAt: Date | null;
  createdAt: Date;
}

export interface FactRegistryStats {
  totalFacts: number;
  lockedFacts: number;
  unlockedFacts: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  averageConfidence: number;
}

// ---------------------------------------------------------------------------
// Fact Types Taxonomy
// ---------------------------------------------------------------------------

export const FACT_TYPES = [
  'event',              // Something that happened (from timeline)
  'claim',              // Statement made by a party (from narrative)
  'observation',        // Physical observation (from evidence)
  'measurement',        // Quantitative measurement (distance, time, speed)
  'identity',           // Person/entity identification
  'location',           // Geographic/spatial fact
  'timestamp_anchor',   // Verified point in time
  'contradiction',      // Identified conflict between sources
] as const;

export type FactType = (typeof FACT_TYPES)[number];

// ---------------------------------------------------------------------------
// Core Operations
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hash of fact content for tamper detection.
 * Includes tenantId + caseId in hash to prevent cross-tenant collision.
 */
function computeFactHash(tenantId: string, caseId: string, content: string): string {
  return createHash('sha256')
    .update(`${tenantId}:${caseId}:${content}`)
    .digest('hex');
}

/**
 * Register a new fact in the registry.
 * If a fact with the same content hash already exists for the case,
 * it will NOT be duplicated — returns the existing fact.
 * Uses upsert to atomically handle concurrent registrations (no TOCTOU race).
 */
export async function registerFact(input: FactInput): Promise<VerifiedFactRecord> {
  const contentHash = computeFactHash(input.tenantId, input.caseId, input.content);

  // Atomic upsert: if the compound unique key (caseId, tenantId, contentHash)
  // already exists, return the existing row unchanged. No race condition.
  const fact = await prisma.verifiedFact.upsert({
    where: {
      caseId_tenantId_contentHash: {
        caseId: input.caseId,
        tenantId: input.tenantId,
        contentHash,
      },
    },
    update: {}, // No-op — existing facts are never mutated via registration
    create: {
      caseId: input.caseId,
      tenantId: input.tenantId,
      factType: input.factType,
      content: input.content,
      contentHash,
      sourceEvidenceId: input.sourceEvidenceId,
      sourceType: input.sourceType,
      confidence: input.confidence,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });

  console.log(
    `[FactRegistry] Fact registered/found: ${fact.factId} type=${input.factType} confidence=${input.confidence} hash=${contentHash.slice(0, 12)}`,
  );

  return fact as VerifiedFactRecord;
}

/**
 * Register multiple facts in a single transaction.
 * Skips duplicates (same contentHash within the case).
 */
export async function registerFactsBatch(
  inputs: FactInput[],
): Promise<{ registered: number; skipped: number; facts: VerifiedFactRecord[] }> {
  let registered = 0;
  let skipped = 0;
  const facts: VerifiedFactRecord[] = [];

  // Process in transaction for atomicity, using upsert to avoid TOCTOU races
  await prisma.$transaction(async (tx) => {
    for (const input of inputs) {
      const contentHash = computeFactHash(input.tenantId, input.caseId, input.content);

      // Check existence first to track registered vs skipped counts
      const existing = await tx.verifiedFact.findUnique({
        where: {
          caseId_tenantId_contentHash: {
            caseId: input.caseId,
            tenantId: input.tenantId,
            contentHash,
          },
        },
      });

      // Use upsert for atomic create-or-return (safe under concurrency)
      const fact = await tx.verifiedFact.upsert({
        where: {
          caseId_tenantId_contentHash: {
            caseId: input.caseId,
            tenantId: input.tenantId,
            contentHash,
          },
        },
        update: {}, // No-op — existing facts are never mutated
        create: {
          caseId: input.caseId,
          tenantId: input.tenantId,
          factType: input.factType,
          content: input.content,
          contentHash,
          sourceEvidenceId: input.sourceEvidenceId,
          sourceType: input.sourceType,
          confidence: input.confidence,
          metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
        },
      });

      if (existing) {
        skipped++;
      } else {
        registered++;
      }
      facts.push(fact as VerifiedFactRecord);
    }
  });

  console.log(
    `[FactRegistry] Batch complete: ${registered} registered, ${skipped} skipped (duplicates)`,
  );

  return { registered, skipped, facts };
}

/**
 * Lock a fact — makes it immutable. Locked facts cannot be edited or deleted.
 * This is called after the fact has been verified by the pipeline.
 */
export async function lockFact(factId: string, tenantId: string): Promise<VerifiedFactRecord> {
  // Atomic conditional update — only sets lockedAt when it is currently null.
  // This eliminates the TOCTOU race between read and write: only one concurrent
  // caller can ever succeed in setting the lock timestamp.
  const result = await prisma.verifiedFact.updateMany({
    where: { factId, tenantId, lockedAt: null },
    data: { lockedAt: new Date() },
  });

  if (result.count === 0) {
    // Either the fact doesn't exist, or it's already locked.
    const fact = await prisma.verifiedFact.findFirst({
      where: { factId, tenantId },
    });

    if (!fact) {
      throw new Error(`Fact ${factId} not found for tenant ${tenantId}`);
    }

    // Already locked — return as-is (original lockedAt timestamp preserved)
    console.warn(`[FactRegistry] Fact ${factId} is already locked (at ${fact.lockedAt!.toISOString()})`);
    return fact as VerifiedFactRecord;
  }

  // Fetch the freshly-locked fact to return
  const locked = await prisma.verifiedFact.findFirst({
    where: { factId, tenantId },
  });

  if (!locked) {
    throw new Error(`Fact ${factId} not found after locking`);
  }

  console.log(`[FactRegistry] Fact ${factId} locked`);
  return locked as VerifiedFactRecord;
}

/**
 * Lock all unlocked facts for a case in a single transaction.
 */
export async function lockAllFactsForCase(
  caseId: string,
  tenantId: string,
): Promise<{ locked: number }> {
  const result = await prisma.verifiedFact.updateMany({
    where: {
      caseId,
      tenantId,
      lockedAt: null,
    },
    data: { lockedAt: new Date() },
  });

  console.log(`[FactRegistry] Locked ${result.count} facts for case ${caseId}`);
  return { locked: result.count };
}

// ---------------------------------------------------------------------------
// Integrity Verification
// ---------------------------------------------------------------------------

/**
 * Verify fact integrity by recomputing content hashes.
 * Returns any facts whose stored hash doesn't match the recomputed one.
 */
export async function verifyFactIntegrity(
  caseId: string,
  tenantId: string,
): Promise<{ valid: boolean; tampered: string[]; total: number }> {
  const facts = await prisma.verifiedFact.findMany({
    where: { caseId, tenantId },
    select: { factId: true, tenantId: true, caseId: true, content: true, contentHash: true },
  });

  const tampered: string[] = [];
  for (const fact of facts) {
    const expected = computeFactHash(fact.tenantId, fact.caseId, fact.content);
    if (fact.contentHash !== expected) {
      tampered.push(fact.factId);
    }
  }

  if (tampered.length > 0) {
    console.error(
      `[FactRegistry] INTEGRITY VIOLATION: ${tampered.length} tampered facts in case ${caseId}`,
    );
  }

  return {
    valid: tampered.length === 0,
    tampered,
    total: facts.length,
  };
}

// ---------------------------------------------------------------------------
// Query Operations
// ---------------------------------------------------------------------------

/**
 * Get all facts for a case, ordered by creation time.
 * Enforces tenant isolation.
 */
export async function getFactsForCase(
  caseId: string,
  tenantId: string,
  options?: { factType?: string; lockedOnly?: boolean },
): Promise<VerifiedFactRecord[]> {
  const where: Record<string, unknown> = { caseId, tenantId };
  if (options?.factType) where.factType = options.factType;
  if (options?.lockedOnly) where.lockedAt = { not: null };

  const facts = await prisma.verifiedFact.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  return facts as VerifiedFactRecord[];
}

/**
 * Get fact registry statistics for a case.
 */
export async function getFactRegistryStats(
  caseId: string,
  tenantId: string,
): Promise<FactRegistryStats> {
  const facts = await prisma.verifiedFact.findMany({
    where: { caseId, tenantId },
    select: { factType: true, sourceType: true, confidence: true, lockedAt: true },
  });

  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalConfidence = 0;
  let lockedCount = 0;

  for (const fact of facts) {
    byType[fact.factType] = (byType[fact.factType] || 0) + 1;
    bySource[fact.sourceType] = (bySource[fact.sourceType] || 0) + 1;
    totalConfidence += fact.confidence;
    if (fact.lockedAt) lockedCount++;
  }

  return {
    totalFacts: facts.length,
    lockedFacts: lockedCount,
    unlockedFacts: facts.length - lockedCount,
    byType,
    bySource,
    averageConfidence: facts.length > 0 ? totalConfidence / facts.length : 0,
  };
}
