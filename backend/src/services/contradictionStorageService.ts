// ============================================================================
// CourtAccess — Canonical Contradiction Storage Service (FINAL)
// ============================================================================

import crypto from "crypto";
import prisma from "../lib/prisma.js";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface ContradictionInput {
  caseId: string;
  type: "TIMESTAMP" | "ACTION" | "ACTOR" | "SEQUENCE";
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  score: number;

  events: {
    eventId: string;
    role: "PRIMARY" | "CONTRADICTING";
  }[];
}

// ---------------------------------------------------------------------------
// HASH GENERATION (DETERMINISTIC)
// ---------------------------------------------------------------------------

function generateHash(input: ContradictionInput): string {
  const sortedEventIds = input.events
    .map((e) => e.eventId)
    .sort()
    .join("|");

  const base = `${input.caseId}|${input.type}|${sortedEventIds}`;

  return crypto.createHash("sha256").update(base).digest("hex");
}

// ---------------------------------------------------------------------------
// MAIN STORAGE FUNCTION
// ---------------------------------------------------------------------------

export async function storeContradiction(input: ContradictionInput) {
  const hash = generateHash(input);

  // -------------------------------------------------------------------------
  // UPSERT CONTRADICTION (IDEMPOTENT)
  // -------------------------------------------------------------------------

  const contradiction = await prisma.contradiction.upsert({
    where: { hash },
    update: {},

    create: {
      caseId: input.caseId,
      type: input.type,
      description: input.description,
      severity: input.severity,
      score: input.score,
      hash,
    },
  });

  // -------------------------------------------------------------------------
  // LINK EVENTS (SAFE UPSERT)
  // -------------------------------------------------------------------------

  for (const e of input.events) {
    await prisma.contradictionEvent.upsert({
      where: {
        contradictionId_eventId: {
          contradictionId: contradiction.id,
          eventId: e.eventId,
        },
      },
      update: {},
      create: {
        contradictionId: contradiction.id,
        eventId: e.eventId,
        role: e.role,
      },
    });
  }

  return contradiction;
}
