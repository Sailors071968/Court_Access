// ============================================================================
// CourtAccess — Contradiction Engine (Phase 2.4)
// SAFE: Read-only, no DB writes, deterministic
// ============================================================================

import prisma from "../lib/prisma";

type TimelineEvent = {
  id: string;
  caseId: string;
  actor: string | null;
  action: string | null;
  target: string | null;
  timestamp: Date;
  metadata?: any;
};

type Contradiction = {
  type: "ACTION_CONFLICT" | "ACTOR_CONFLICT";
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  eventIds: string[];
};

export async function detectContradictions(caseId: string, tenantId?: string) {
  const events: TimelineEvent[] = await prisma.timelineEvent.findMany({
    where: { caseId, ...(tenantId ? { tenantId } : {}) },
    orderBy: { createdAt: "asc" },
  });

  const contradictions: Contradiction[] = [];

  // --------------------------------------------------------------------------
  // 1. ACTION CONFLICTS
  // Same actor + same target + different actions
  // --------------------------------------------------------------------------

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];

      if (!a.actor || !b.actor) continue;
      if (!a.action || !b.action) continue;
      if (!a.target || !b.target) continue;

      if (
        a.actor === b.actor &&
        a.target === b.target &&
        a.action !== b.action
      ) {
        contradictions.push({
          type: "ACTION_CONFLICT",
          severity: "HIGH",
          description: `${a.actor} has conflicting actions: "${a.action}" vs "${b.action}"`,
          eventIds: [a.id, b.id],
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. ACTOR CONFLICTS
  // Same action + same target + different actors
  // --------------------------------------------------------------------------

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];

      if (!a.action || !b.action) continue;
      if (!a.actor || !b.actor) continue;
      if (!a.target || !b.target) continue;

      if (
        a.action === b.action &&
        a.target === b.target &&
        a.actor !== b.actor
      ) {
        contradictions.push({
          type: "ACTOR_CONFLICT",
          severity: "MEDIUM",
          description: `Different actors for same action "${a.action}" on "${a.target}"`,
          eventIds: [a.id, b.id],
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. DEDUPLICATION
  // --------------------------------------------------------------------------

  const unique = new Map<string, Contradiction>();

  for (const c of contradictions) {
    const key = `${c.type}-${[...c.eventIds].sort().join("-")}`;
    if (!unique.has(key)) {
      unique.set(key, c);
    }
  }

  return Array.from(unique.values());
}
