// ============================================================================
// CourtAccess — Litigation Strategy Service
// ============================================================================

type Cluster = {
  anchorEvent: string;
  contradictions: any[];
  documents: string[];
};

type StrategyOutput = {
  defense_strategy: string;
  prosecution_dependency: string;
  reasonable_doubt: string;
  key_vulnerability: string;
};

export function generateLitigationStrategy(clusters: Cluster[]): StrategyOutput[] {
  const results: StrategyOutput[] = [];

  for (const cluster of clusters) {
    const contradictionCount = cluster.contradictions?.length || 0;

    const hasTimelineConflict = cluster.contradictions?.some(
      (c) =>
        (c.type || c.contradictionType || "").includes("timestamp")
    );

    const hasActionConflict = cluster.contradictions?.some(
      (c) =>
        (c.type || c.contradictionType || "").includes("action")
    );

    const hasActorConflict = cluster.contradictions?.some(
      (c) =>
        (c.type || c.contradictionType || "").includes("actor")
    );

    results.push({
      defense_strategy: buildDefense(cluster, {
        hasTimelineConflict,
        hasActionConflict,
        hasActorConflict,
      }),

      prosecution_dependency: buildProsecution(cluster),

      reasonable_doubt: buildDoubt(cluster, contradictionCount),

      key_vulnerability: buildVulnerability(cluster),
    });
  }

  return results;
}

// ============================================================================
// BUILDERS
// ============================================================================

function buildDefense(cluster: Cluster, flags: any): string {
  if (flags.hasTimelineConflict) {
    return `
The sequence of events may be challenged due to inconsistencies in timing across sources.
This may affect reconstruction of how events unfolded.
`;
  }

  if (flags.hasActionConflict) {
    return `
Differences in described actions may be emphasized to question the accuracy
of reported conduct and interpretation of events.
`;
  }

  if (flags.hasActorConflict) {
    return `
Inconsistencies in identifying individuals involved may affect attribution
of responsibility and reliability of accounts.
`;
  }

  return `
Multiple inconsistencies across sources may be used to question overall reliability
of the narrative presented.
`;
}

function buildProsecution(cluster: Cluster): string {
  return `
The prosecution narrative may depend on a consistent interpretation of events
within this cluster. Any inconsistencies may affect how strongly the sequence
and actions are established.
`;
}

function buildDoubt(cluster: Cluster, count: number): string {
  if (count >= 3) {
    return `
Multiple inconsistencies across independent sources may contribute to uncertainty
in key aspects of the event.
`;
  }

  if (count >= 1) {
    return `
At least one inconsistency exists that may affect interpretation of the evidence.
`;
  }

  return `
No significant inconsistencies detected within this cluster.
`;
}

function buildVulnerability(cluster: Cluster): string {
  return `
This cluster represents a point where differing accounts intersect.
Consistency across sources may be necessary to maintain narrative strength.
`;
}
