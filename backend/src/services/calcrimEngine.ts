// ============================================================================
// CourtAccess — CALCRIM Intelligence Engine (Courtroom Grade)
// Includes:
// - Element Matching
// - Credibility Weighting
// - Contradiction Detection
// - Intent Inference (Burglary)
// - Confidence Scoring Engine
// ============================================================================

import prisma from "../lib/prisma.js";
import { calcrimMapping } from "../data/calcrimMapping";

// --------------------------------------------------
// 🔥 CREDIBILITY WEIGHT ENGINE
// --------------------------------------------------
const SOURCE_WEIGHTS: Record<string, number> = {
  video: 1.0,
  forensic: 0.95,
  physical: 0.9,
  officer: 0.75,
  witness: 0.6,
  victim: 0.65,
  document: 0.7,
  defendant: 0.2,
  unknown: 0.5,
};

function getSourceWeight(event: any): number {
  const type = (event.sourceType || "unknown").toLowerCase();
  return SOURCE_WEIGHTS[type] ?? SOURCE_WEIGHTS.unknown;
}

// --------------------------------------------------
// HELPER: Match event to element
// --------------------------------------------------
function matchEventToElement(event: any, element: any) {
  const actionMatch =
    !element.actions?.length ||
    element.actions.includes((event.action || "").toLowerCase());

  const targetMatch =
    !element.targets?.length ||
    element.targets.some(t =>
      (event.target || "").toLowerCase().includes(t)
    );

  const keywordMatch =
    !element.keywords?.length ||
    element.keywords.some(k =>
      (event.description || "").toLowerCase().includes(k)
    );

  return actionMatch && targetMatch && keywordMatch;
}

// --------------------------------------------------
// 🔥 CONTRADICTION DETECTION ENGINE
// --------------------------------------------------
function detectContradictions(events: any[]) {
  const contradictions: any[] = [];

  const denialEvents = events.filter(e => e.action === "deny");
  const entryEvents = events.filter(e => e.action === "enter");

  if (denialEvents.length && entryEvents.length) {
    contradictions.push({
      id: "contradiction-entry-denial",
      description:
        "Defendant denies being present, but evidence shows entry into the structure",
    });
  }

  const hasNotPresent = events.some(e =>
    (e.description || "").toLowerCase().includes("not present")
  );

  const hasInside = events.some(e =>
    (e.description || "").toLowerCase().includes("inside")
  );

  if (hasNotPresent && hasInside) {
    contradictions.push({
      id: "contradiction-presence",
      description: "Conflicting statements about whether defendant was present",
    });
  }

  return contradictions;
}

// --------------------------------------------------
// 🔥 CONFIDENCE ENGINE (WITH CREDIBILITY)
// --------------------------------------------------
function calculateConfidence(matches: any[], contradictions: any[]) {
  if (!matches.length) return 0.1;

  let score = 0.3;

  // Weighted evidence
  for (const event of matches) {
    const weight = getSourceWeight(event);
    score += (event.confidence || 0.5) * weight * 0.4;
  }

  score = score / matches.length;

  // Weighted contradictions
  let penalty = 0;

  for (const c of contradictions) {
    if (c.id.includes("denial")) penalty += 0.05;
    else if (c.id.includes("presence")) penalty += 0.1;
    else penalty += 0.15;
  }

  penalty = Math.min(penalty, 0.3);

  score -= penalty;

  return Math.max(0, Math.min(1, score));
}

// --------------------------------------------------
// 🔥 INTENT INTELLIGENCE (BURGLARY)
// --------------------------------------------------
function inferIntent(events: any[]) {
  const entryEvents = events.filter(e =>
    e.action === "enter" &&
    (e.target || "").toLowerCase().includes("residence")
  );

  const theftEvents = events.filter(e =>
    (e.description || "").toLowerCase().includes("stolen") ||
    (e.description || "").toLowerCase().includes("missing")
  );

  const forcedEntryEvents = events.filter(e =>
    (e.target || "").toLowerCase().includes("forced entry")
  );

  if (entryEvents.length && theftEvents.length) {
    return {
      supported: true,
      evidence: [...entryEvents, ...theftEvents],
      confidence: 0.85,
    };
  }

  if (forcedEntryEvents.length) {
    return {
      supported: true,
      evidence: forcedEntryEvents,
      confidence: 0.6,
    };
  }

  if (entryEvents.length) {
    return {
      supported: false,
      evidence: entryEvents,
      confidence: 0.3,
    };
  }

  return {
    supported: false,
    evidence: [],
    confidence: 0.1,
  };
}

// --------------------------------------------------
// MAIN ENGINE
// --------------------------------------------------
export async function analyzeCase(caseId: string) {
  const charges = await prisma.charge.findMany({
    where: { caseId },
  });

  if (!charges.length) {
    throw new Error("No charges found for case");
  }

  const events = await prisma.timelineEvent.findMany({
    where: { caseId },
  });

  const contradictions = detectContradictions(events);

  const chargeResults = [];

  for (const charge of charges) {
    const key = `${charge.code} ${charge.section}`;
    const calcrim = calcrimMapping[key];

    if (!calcrim) continue;

    const elementResults = [];
    const intentInference = inferIntent(events);

    for (const element of calcrim.elements) {
      let matchingEvents = events.filter(e =>
        matchEventToElement(e, element)
      );

      let supported = matchingEvents.length > 0;

      let confidence = calculateConfidence(
        matchingEvents,
        contradictions
      );

      // 🔥 INTENT OVERRIDE
      if (
        element.id === "intent" ||
        element.text.toLowerCase().includes("intent")
      ) {
        supported = intentInference.supported;
        matchingEvents = intentInference.evidence;
        confidence = calculateConfidence(
          intentInference.evidence,
          contradictions
        );
      }

      // 🔥 SORT EVIDENCE BY CREDIBILITY
      const sortedEvents = matchingEvents
        .map(e => ({
          ...e,
          credibilityWeight: getSourceWeight(e),
        }))
        .sort(
          (a, b) =>
            b.confidence * b.credibilityWeight -
            a.confidence * a.credibilityWeight
        );

      elementResults.push({
        elementId: element.id,
        elementText: element.text,
        supported,
        supportingEvidence: sortedEvents.map(e => ({
          id: e.id,
          description: e.description,
          confidence: e.confidence,
          sourceType: e.sourceType,
          credibilityWeight: e.credibilityWeight,
        })),
        contradictions,
        confidence,
      });
    }

    const missingElements = elementResults.filter(e => !e.supported);
    const weakElements = elementResults.filter(e => e.confidence < 0.5);

    const overallScore =
      elementResults.reduce((sum, e) => sum + e.confidence, 0) /
      elementResults.length;

    let strength = "WEAK";
    if (overallScore > 0.75) strength = "STRONG";
    else if (overallScore > 0.5) strength = "MODERATE";

    chargeResults.push({
      charge: key,
      title: calcrim.title,
      calcrim: calcrim.calcrim,
      elements: elementResults,
      missingElements,
      weakElements,
      overallScore,
      strength,
    });
  }

  const caseScore =
    chargeResults.reduce((sum, c) => sum + c.overallScore, 0) /
    chargeResults.length;

  let caseStrength = "WEAK";
  if (caseScore > 0.75) caseStrength = "STRONG";
  else if (caseScore > 0.5) caseStrength = "MODERATE";

  return {
    caseId,
    charges: chargeResults,
    overallCaseStrength: caseStrength,
    caseScore,
  };
}
