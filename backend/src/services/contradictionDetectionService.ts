// ============================================================================
// CourtAccess — Contradiction Detection Service (PRODUCTION v4)
// ============================================================================

export interface TimelineEvent {
  id?: string;
  description: string;
  actor: string;
  action: string;
  timestamp?: string;
  sourceType?: string;
  conflictFlag?: boolean;
  conflictsWith?: string;
}

export interface Contradiction {
  type: "potential_inconsistency";
  category: string;
  description: string;
  confidence: number;
  events: TimelineEvent[];
  explanation: string;
}

// ---------------------------------------------------------------------------
// SOURCE WEIGHTS (EVIDENCE RELIABILITY)
// ---------------------------------------------------------------------------

const SOURCE_WEIGHTS: Record<string, number> = {
  bodycam: 1.0,
  video: 1.0,
  dashcam: 0.95,
  report: 0.7,
  document: 0.65,
  witness: 0.5,
  unknown: 0.4,
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function normalizeAction(action?: string): string {
  if (!action) return "unknown";

  const map: Record<string, string> = {
    enter: "entry",
    entering: "entry",
    exit: "exit",
    leaving: "exit",
    approach: "approach",
    approached: "approach",
  };

  return map[action.toLowerCase()] || action.toLowerCase();
}

function sameActor(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

function getTimeDiffSeconds(a?: string, b?: string): number | null {
  if (!a || !b) return null;

  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();

  if (isNaN(t1) || isNaN(t2)) return null;

  return Math.abs((t1 - t2) / 1000);
}

function getSourceWeight(source?: string): number {
  if (!source) return SOURCE_WEIGHTS.unknown;
  return SOURCE_WEIGHTS[source] || SOURCE_WEIGHTS.unknown;
}

function calculateConfidence(a: TimelineEvent, b: TimelineEvent): number {
  const wA = getSourceWeight(a.sourceType);
  const wB = getSourceWeight(b.sourceType);

  return Math.min(1, (wA + wB) / 2);
}

// ---------------------------------------------------------------------------
// ENGINE
// ---------------------------------------------------------------------------

export function detectContradictions(
  events: TimelineEvent[]
): Contradiction[] {
  const contradictions: Contradiction[] = [];
  const seenPairs = new Set<string>();

// ---------------------------------------------------------------------------
// 🔥 USE ALL EVENTS (DO NOT FILTER OUT CONFLICTED ONES)
// ---------------------------------------------------------------------------

const cleanEvents = events.filter((e) => !!e);

  // -------------------------------------------------------------------------
  // 🔁 MAIN LOOP
  // -------------------------------------------------------------------------

  for (let i = 0; i < cleanEvents.length; i++) {
    for (let j = i + 1; j < cleanEvents.length; j++) {
      const a = cleanEvents[i];
      const b = cleanEvents[j];

      if (!a || !b) continue;

      // Skip same source
      if (a.sourceType && b.sourceType && a.sourceType === b.sourceType) {
        continue;
      }

      // Prevent re-linking already linked pairs
      if (a.conflictsWith === b.id) continue;
      if (b.conflictsWith === a.id) continue;

      // Must be same actor
      if (!sameActor(a.actor, b.actor)) continue;

      // Normalize actions
      const actionA = normalizeAction(a.action);
      const actionB = normalizeAction(b.action);

      // Must be same event type OR closely related
      if (actionA !== actionB) {
        // ---------------------------------------------------------------
        // ⚡ ACTION CONFLICT
        // ---------------------------------------------------------------

        const pairKey = [
          a.id || a.description,
          b.id || b.description,
          "action",
        ]
          .sort()
          .join("|");

        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        contradictions.push({
          type: "potential_inconsistency",
          category: "action_conflict",
          description:
            "Different actions reported for the same actor",
          confidence: calculateConfidence(a, b),
          events: [a, b],
          explanation: `Action mismatch: "${actionA}" vs "${actionB}"`,
        });

        continue;
      }

      // ---------------------------------------------------------------
      // ⏱️ TIMESTAMP CONFLICT
      // ---------------------------------------------------------------

      const diff = getTimeDiffSeconds(a.timestamp, b.timestamp);

      if (!diff || diff < 300) continue;

      const pairKey = [
        a.id || a.description,
        b.id || b.description,
        "time",
      ]
        .sort()
        .join("|");

      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      contradictions.push({
        type: "potential_inconsistency",
        category: "timestamp_conflict",
        description:
          "Same event occurs at significantly different times across sources",
        confidence: calculateConfidence(a, b),
        events: [a, b],
        explanation: `Time difference of ${Math.round(
          diff
        )} seconds between sources`,
      });
    }
  }

  return contradictions;
}
