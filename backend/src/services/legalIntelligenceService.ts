// ============================================================================
// CourtAccess — Legal + POST Doctrine Intelligence Service (FINAL)
// ============================================================================

import { classifyForceFromText } from "./forceClassificationService.js";
import { classifyResistanceFromText } from "./resistanceClassificationService.js";

// ============================================================================
// TYPES
// ============================================================================

type Cluster = {
  anchorEvent: string;
  documents: string[];
  timelineSegment: string;
  chain: any[];
  contradictions: any[];
};

type LegalIssue = {
  issue: string;
  legal_relevance: string[];
  doctrine_mapping: string[];
  analysis: string;
  impact: string;
  confidence: number;
};

// ============================================================================
// MAIN ENTRY
// ============================================================================

export function generateLegalIntelligence(clusters: Cluster[]): LegalIssue[] {
  const results: LegalIssue[] = [];

  for (const cluster of clusters) {
    const types = extractContradictionTypes(cluster);

    if (types.includes("timestamp_conflict")) {
      results.push(buildTimelineIssue(cluster));
    }

    if (types.includes("action_conflict")) {
      results.push(buildActionIssue(cluster));
    }

    if (types.includes("actor_conflict")) {
      results.push(buildActorIssue(cluster));
    }
  }

  return results;
}

// ============================================================================
// HELPERS
// ============================================================================

function extractContradictionTypes(cluster: Cluster): string[] {
  const types = new Set<string>();

  for (const c of cluster.contradictions || []) {
    const t = c?.type || c?.contradictionType;
    if (t) types.add(t);
  }

  return Array.from(types);
}

// ============================================================================
// ISSUE BUILDERS
// ============================================================================

function buildTimelineIssue(cluster: Cluster): LegalIssue {
  return {
    issue: "Potential inconsistency in event timing across sources",

    legal_relevance: [
      "CALCRIM 226 (Witness Credibility)",
      "Timeline Reliability",
    ],

    doctrine_mapping: [
      "POST LD 20 (Report Writing — accuracy and completeness)",
    ],

    analysis: `
Sources present differing timestamps for the same or closely related events.
This may indicate inconsistency in recorded or perceived timing.
`,

    impact: `
Inconsistent timing may affect reconstruction of sequence,
including escalation, decision-making, and causality.
`,

    confidence: scoreClusterConfidence(cluster),
  };
}

// 🔥 FINAL — FORCE + RESISTANCE MODEL
function buildActionIssue(cluster: Cluster): LegalIssue {
  const forceLevels = extractForceLevels(cluster);
  const resistanceLevels = extractResistanceLevels(cluster);

  const forceSet = unique(forceLevels);
  const resistanceSet = unique(resistanceLevels);

  const mismatch = detectMismatch(forceSet, resistanceSet);

  return {
    issue: mismatch
      ? "Potential inconsistency between reported resistance and level of force"
      : "Potential inconsistency in described actions across sources",

    legal_relevance: [
      "CALCRIM 226 (Witness Credibility)",
      "Use of Force Evaluation",
    ],

    doctrine_mapping: [
      "POST LD 15 (Use of Force — objective reasonableness)",
    ],

    analysis: `
Detected resistance levels: ${formatList(resistanceSet)}.
Detected force levels: ${formatList(forceSet)}.
`,

    impact: mismatch
      ? `
Differences between resistance and force levels may affect evaluation of proportionality
and objective reasonableness under POST doctrine expectations.
`
      : `
Conflicting descriptions may affect factual interpretation and credibility.
`,

    confidence: scoreClusterConfidence(cluster),
  };
}

function buildActorIssue(cluster: Cluster): LegalIssue {
  return {
    issue: "Potential inconsistency in actor identification",

    legal_relevance: [
      "Identity Reliability",
      "Witness Accuracy",
    ],

    doctrine_mapping: [
      "POST LD 20 (Report Writing — accurate identification)",
    ],

    analysis: `
Sources attribute actions to different individuals or fail to consistently identify actors.
`,

    impact: `
Inconsistent identification may affect attribution of responsibility and reliability.
`,

    confidence: scoreClusterConfidence(cluster),
  };
}

// ============================================================================
// EXTRACTION
// ============================================================================

function extractForceLevels(cluster: Cluster): string[] {
  const levels: string[] = [];

  for (const c of cluster.contradictions || []) {
    const text = buildTextBlob(c);
    const level = classifyForceFromText(text);

    if (level && level !== "UNKNOWN") {
      levels.push(level);
    }
  }

  return levels;
}

function extractResistanceLevels(cluster: Cluster): string[] {
  const levels: string[] = [];

  for (const c of cluster.contradictions || []) {
    const text = buildTextBlob(c);
    const level = classifyResistanceFromText(text);

    if (level && level !== "UNKNOWN") {
      levels.push(level);
    }
  }

  return levels;
}

function buildTextBlob(c: any): string {
  return `
    ${c?.description || ""}
    ${c?.eventAData?.description || ""}
    ${c?.eventBData?.description || ""}
  `;
}

// ============================================================================
// 🔥 CORE LOGIC — PROPORTIONALITY
// ============================================================================

function detectMismatch(force: string[], resistance: string[]): boolean {
  if (!force.length || !resistance.length) return false;

  const hasHighForce =
    force.includes("LETHAL") || force.includes("LESS_LETHAL");

  const hasLowResistance =
    resistance.includes("NONE") || resistance.includes("PASSIVE");

  const hasDeadlyResistance = resistance.includes("DEADLY");

  // 🚨 Over-force scenario
  if (hasHighForce && hasLowResistance) return true;

  // 🚨 Under-force (rare but important)
  if (force.includes("NONE") && hasDeadlyResistance) return true;

  return false;
}

// ============================================================================
// UTILITIES
// ============================================================================

function unique(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

function formatList(arr: string[]): string {
  return arr.length ? arr.join(", ") : "UNKNOWN";
}

// ============================================================================
// CONFIDENCE
// ============================================================================

function scoreClusterConfidence(cluster: Cluster): number {
  const contradictionCount = cluster.contradictions?.length || 0;
  const documentCount = cluster.documents?.length || 1;

  let score = 0;

  if (contradictionCount >= 3) score += 0.4;
  else if (contradictionCount >= 1) score += 0.2;

  if (documentCount >= 3) score += 0.4;
  else if (documentCount >= 2) score += 0.2;

  return Math.min(1, parseFloat(score.toFixed(2)));
}
