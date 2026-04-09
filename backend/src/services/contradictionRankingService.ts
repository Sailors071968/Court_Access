// ============================================================================
// CourtAccess — Contradiction Ranking Service (v1)
// ============================================================================

import { Contradiction } from "./contradictionDetectionService";

export interface RankedContradiction extends Contradiction {
  severity: "HIGH" | "MEDIUM" | "LOW";
  score: number;
}

// ---------------------------------------------------------------------------
// GROUP SIMILAR CONTRADICTIONS (FINAL CLEANUP)
// ---------------------------------------------------------------------------

function groupContradictions(
  contradictions: RankedContradiction[]
): RankedContradiction[] {
  const groups = new Map<string, RankedContradiction>();

  for (const c of contradictions) {
    const actor = c.events[0]?.actor || "unknown";
    const action = c.events[0]?.action || "unknown";

    const key = `${c.category}|${actor}|${action}`;

    if (!groups.has(key)) {
      groups.set(key, c);
    } else {
      const existing = groups.get(key)!;

      // Keep the stronger contradiction
      if (c.score > existing.score) {
        groups.set(key, c);
      }
    }
  }

  return Array.from(groups.values());
}

// ---------------------------------------------------------------------------
// CATEGORY WEIGHTS
// ---------------------------------------------------------------------------

const CATEGORY_WEIGHTS: Record<string, number> = {
  timestamp_conflict: 0.9,
  action_conflict: 0.8,
  presence_conflict: 0.7,
  movement_conflict: 0.6,
  unknown: 0.4,
};

// ---------------------------------------------------------------------------
// SCORING FUNCTION
// ---------------------------------------------------------------------------

function calculateScore(c: Contradiction): number {
  const base = c.confidence || 0.5;
  const categoryWeight =
    CATEGORY_WEIGHTS[c.category] || CATEGORY_WEIGHTS.unknown;

  // Combine both signals
  return Math.min(1, base * 0.6 + categoryWeight * 0.4);
}

// ---------------------------------------------------------------------------
// SEVERITY MAPPING
// ---------------------------------------------------------------------------

function mapSeverity(score: number): "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 0.8) return "HIGH";
  if (score >= 0.6) return "MEDIUM";
  return "LOW";
}

// ---------------------------------------------------------------------------
// MAIN ENGINE
// ---------------------------------------------------------------------------

export function rankContradictions(
  contradictions: Contradiction[]
): RankedContradiction[] {
  const ranked: RankedContradiction[] = contradictions.map((c) => {
    const score = calculateScore(c);

    return {
      ...c,
      score,
      severity: mapSeverity(score),
    };
  });

  // Sort highest → lowest importance
  ranked.sort((a, b) => b.score - a.score);

  // Group + deduplicate
  const grouped = groupContradictions(ranked);

  // Final sort
  grouped.sort((a, b) => b.score - a.score);

  return grouped;
}
