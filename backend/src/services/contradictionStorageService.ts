// ============================================================================
// CourtAccess — Canonical Contradiction Storage Service
// Persists contradiction flags on timeline events until dedicated Prisma models exist.
// ============================================================================

import crypto from 'crypto';
import prisma from '../lib/prisma.js';

export interface ContradictionInput {
  caseId: string;
  type: 'TIMESTAMP' | 'ACTION' | 'ACTOR' | 'SEQUENCE';
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  events: {
    eventId: string;
    role: 'PRIMARY' | 'CONTRADICTING';
  }[];
}

function generateHash(input: ContradictionInput): string {
  const sortedEventIds = input.events
    .map((e) => e.eventId)
    .sort()
    .join('|');

  const base = `${input.caseId}|${input.type}|${sortedEventIds}`;
  return crypto.createHash('sha256').update(base).digest('hex');
}

export async function storeContradiction(input: ContradictionInput) {
  const hash = generateHash(input);
  const eventIds = input.events.map((e) => e.eventId);

  for (let i = 0; i < eventIds.length; i++) {
    const eventId = eventIds[i];
    const conflictsWith = eventIds.find((id) => id !== eventId) ?? null;
    await prisma.timelineEvent.updateMany({
      where: { id: eventId, caseId: input.caseId },
      data: { conflictFlag: true, conflictsWith },
    });
  }

  return {
    id: hash,
    caseId: input.caseId,
    type: input.type,
    description: input.description,
    severity: input.severity,
    score: input.score,
    hash,
    eventIds,
  };
}
