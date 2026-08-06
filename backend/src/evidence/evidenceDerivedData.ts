// ============================================================================
// Removal of evidence-derived findings.
//
// Everything the platform infers from a document — indexed chunks, extracted
// events, verified facts, narrative claims — exists only because that document
// is in the case. When the document is removed, those findings have nothing
// behind them: they would quote a source the case no longer holds, which is
// precisely the untraceable finding the constitution forbids.
//
// Work the user authored themselves is treated differently. An investigator's
// field note is their own product; it is detached from the removed document
// rather than destroyed.
// ============================================================================

import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export interface PurgeResult {
  chunks: number;
  events: number;
  verifiedFacts: number;
  narrativeClaims: number;
  fieldNotesDetached: number;
}

/**
 * Remove everything derived from the given evidence, and detach user-authored
 * records that merely referenced it. Safe to call inside a transaction.
 */
export async function purgeEvidenceDerivedFindings(
  db: Db,
  evidenceIds: string[],
): Promise<PurgeResult> {
  if (evidenceIds.length === 0) {
    return { chunks: 0, events: 0, verifiedFacts: 0, narrativeClaims: 0, fieldNotesDetached: 0 };
  }

  const chunks = await db.evidenceChunk.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
  const events = await db.evidenceEvent.deleteMany({ where: { sourceEvidence: { in: evidenceIds } } });
  const verifiedFacts = await db.verifiedFact.deleteMany({
    where: { sourceEvidenceId: { in: evidenceIds } },
  });
  const narrativeClaims = await db.narrativeClaim.deleteMany({
    where: { evidenceId: { in: evidenceIds } },
  });
  const fieldNotes = await db.fieldNote.updateMany({
    where: { evidenceId: { in: evidenceIds } },
    data: { evidenceId: null },
  });

  return {
    chunks: chunks.count,
    events: events.count,
    verifiedFacts: verifiedFacts.count,
    narrativeClaims: narrativeClaims.count,
    fieldNotesDetached: fieldNotes.count,
  };
}
