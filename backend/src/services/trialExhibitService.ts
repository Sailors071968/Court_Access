// ============================================================================
// CourtAccess — Trial Exhibit Service
// Converts system intelligence into courtroom-ready output
// ============================================================================

type Event = {
  id: string;
  description: string;
  timestamp: string;
  actor?: string;
  action?: string;
};

type Cluster = {
  anchorEvent: string;
  contradictions: any[];
};

type LegalIssue = {
  issue: string;
  confidence: number;
};

export function buildTrialExhibit(params: {
  events: Event[];
  clusters: Cluster[];
  legal: LegalIssue[];
}) {
  const { events, clusters, legal } = params;

  return {
    timeline_exhibit: buildTimeline(events),
    key_events: extractKeyEvents(events, clusters),
    contradiction_pairs: extractContradictions(clusters),
    legal_highlights: extractLegalHighlights(legal),
    presentation_notes: buildNarrative(clusters, legal),
  };
}

// ============================================================================
// TIMELINE
// ============================================================================

function buildTimeline(events: Event[]) {
  return events.map((e) => ({
    time: e.timestamp,
    label: e.description,
    actor: e.actor || "unknown",
  }));
}

// ============================================================================
// KEY EVENTS
// ============================================================================

function extractKeyEvents(events: Event[], clusters: Cluster[]) {
  const anchors = new Set(clusters.map((c) => c.anchorEvent));

  return events.filter((e) => anchors.has(e.description));
}

// ============================================================================
// CONTRADICTIONS
// ============================================================================

function extractContradictions(clusters: Cluster[]) {
  const pairs: any[] = [];

  for (const cluster of clusters) {
    for (const c of cluster.contradictions || []) {
      pairs.push({
        description: c.description,
        eventA: c.eventA,
        eventB: c.eventB,
      });
    }
  }

  return pairs;
}

// ============================================================================
// LEGAL HIGHLIGHTS
// ============================================================================

function extractLegalHighlights(legal: LegalIssue[]) {
  return legal
    .filter((l) => l.confidence >= 0.5)
    .map((l) => ({
      issue: l.issue,
      confidence: l.confidence,
    }));
}

// ============================================================================
// NARRATIVE
// ============================================================================

function buildNarrative(clusters: Cluster[], legal: LegalIssue[]) {
  const high = legal.filter((l) => l.confidence >= 0.5);

  if (!high.length) {
    return "No significant inconsistencies identified.";
  }

  return `
Multiple areas of inconsistency were identified across sources.
These inconsistencies may affect interpretation of the sequence of events,
the actions described, and the reliability of accounts presented.
`;
}
