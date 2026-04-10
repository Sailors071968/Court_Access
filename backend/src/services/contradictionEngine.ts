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
  metadata?: Record<string, unknown> | null;
};

// Structured attributes stored in metadata.attributes
type EventAttributes = {
  height?: string | null;
  weapon?: string | null;
  vehicle?: string | null;
  direction?: string | null;
};

type ContradictionType =
  | "ACTION_CONFLICT"
  | "ACTOR_CONFLICT"
  | "HEIGHT_CONFLICT"
  | "WEAPON_CONFLICT"
  | "DIRECTION_CONFLICT"
  | "VEHICLE_CONFLICT";

type Contradiction = {
  type: ContradictionType;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  eventIds: string[];
};

/** Safely extract structured attributes from event metadata */
function getAttributes(event: TimelineEvent): EventAttributes {
  if (!event.metadata || typeof event.metadata !== 'object') return {};
  const meta = event.metadata as Record<string, unknown>;
  const attrs = meta.attributes;
  if (!attrs || typeof attrs !== 'object') return {};
  return attrs as EventAttributes;
}

export async function detectContradictions(caseId: string, tenantId?: string) {
  const events = await prisma.timelineEvent.findMany({
    where: { caseId, ...(tenantId ? { tenantId } : {}) },
    orderBy: { createdAt: "asc" },
  }) as unknown as TimelineEvent[];

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
  // 3. ATTRIBUTE CONFLICTS (Phase 3)
  // Different actors describing the same subject with conflicting attributes
  // --------------------------------------------------------------------------

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];

      if (!a.actor || !b.actor) continue;
      // Only flag cross-actor contradictions (same actor can't contradict themselves)
      if (a.actor === b.actor) continue;

      const attrsA = getAttributes(a);
      const attrsB = getAttributes(b);

      // HEIGHT_CONFLICT — e.g. 6'2 vs 5'8
      if (attrsA.height && attrsB.height && attrsA.height !== attrsB.height) {
        contradictions.push({
          type: "HEIGHT_CONFLICT",
          severity: "HIGH",
          description: `${a.actor} says height "${attrsA.height}" but ${b.actor} says "${attrsB.height}"`,
          eventIds: [a.id, b.id],
        });
      }

      // WEAPON_CONFLICT — e.g. handgun vs revolver
      if (attrsA.weapon && attrsB.weapon && attrsA.weapon !== attrsB.weapon) {
        contradictions.push({
          type: "WEAPON_CONFLICT",
          severity: "HIGH",
          description: `${a.actor} says weapon "${attrsA.weapon}" but ${b.actor} says "${attrsB.weapon}"`,
          eventIds: [a.id, b.id],
        });
      }

      // DIRECTION_CONFLICT — e.g. northbound vs southbound
      if (attrsA.direction && attrsB.direction && attrsA.direction !== attrsB.direction) {
        contradictions.push({
          type: "DIRECTION_CONFLICT",
          severity: "HIGH",
          description: `${a.actor} says direction "${attrsA.direction}" but ${b.actor} says "${attrsB.direction}"`,
          eventIds: [a.id, b.id],
        });
      }

      // VEHICLE_CONFLICT — e.g. red toyota camry vs blue honda civic
      if (attrsA.vehicle && attrsB.vehicle && attrsA.vehicle !== attrsB.vehicle) {
        contradictions.push({
          type: "VEHICLE_CONFLICT",
          severity: "HIGH",
          description: `${a.actor} says vehicle "${attrsA.vehicle}" but ${b.actor} says "${attrsB.vehicle}"`,
          eventIds: [a.id, b.id],
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. DEDUPLICATION
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
