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
/**
 * Charges are stored with whatever abbreviation the user typed — "PC",
 * "P.C.", "Penal Code" — while the mapping table is keyed on the long form.
 * Build the candidate keys for a charge so an abbreviation still finds its
 * instruction, and fall back to the base section when a subdivision such as
 * 459(a) has no entry of its own.
 */
export function calcrimLookupKeys(code: string, section: string): string[] {
  const cleanedCode = (code ?? '').trim().replace(/\./g, '');
  const cleanedSection = (section ?? '').trim();
  const baseSection = cleanedSection.replace(/\s*\(.*$/, '');

  const codeForms = new Set([cleanedCode, code?.trim()].filter(Boolean) as string[]);
  if (/^pc$/i.test(cleanedCode)) codeForms.add('Penal Code');
  if (/^penal code$/i.test(cleanedCode)) codeForms.add('PC');
  if (/^vc$/i.test(cleanedCode)) codeForms.add('Vehicle Code');
  if (/^hs$/i.test(cleanedCode)) codeForms.add('Health and Safety Code');

  const keys: string[] = [];
  for (const c of codeForms) {
    keys.push(`${c} ${cleanedSection}`);
    if (baseSection !== cleanedSection) keys.push(`${c} ${baseSection}`);
  }
  return keys;
}

export async function analyzeCase(caseId: string) {
  const charges = await prisma.charge.findMany({
    where: { caseId },
  });

  if (!charges.length) {
    // Not an error: a case may simply not have charges entered yet. Say so
    // rather than throwing, and assert nothing about its strength.
    return {
      caseId,
      charges: [],
      unmappedCharges: [],
      overallCaseStrength: 'UNKNOWN',
      caseScore: null,
      message:
        'No charges have been entered for this case, so no CALCRIM instruction can be organised. ' +
        'Add the charged offences to see their elements.',
    };
  }

  const events = await prisma.timelineEvent.findMany({
    where: { caseId },
  });

  const contradictions = detectContradictions(events);

  const chargeResults = [];
  // Charges with no instruction in the mapping table used to be skipped
  // silently, so a charged offence simply vanished from the analysis. They are
  // reported instead, as UNKNOWN rather than as absent.
  const unmappedCharges: Array<{ charge: string; title: string | null; reason: string }> = [];

  for (const charge of charges) {
    const keys = calcrimLookupKeys(charge.code, charge.section);
    const matchedKey = keys.find((k) => calcrimMapping[k]);
    const calcrim = matchedKey ? calcrimMapping[matchedKey] : undefined;
    const key = `${charge.code} ${charge.section}`;

    if (!calcrim) {
      unmappedCharges.push({
        charge: key,
        title: charge.title ?? null,
        reason:
          `No CALCRIM instruction is held for ${key}. Its elements cannot be organised, and nothing ` +
          'about this count is asserted. The instruction library currently covers a limited set of ' +
          'offences; this count needs to be reviewed against CALCRIM directly.',
      });
      continue;
    }

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
        element.searchHeading.toLowerCase().includes("intent")
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
        elementText: element.searchHeading,
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

  // Characterising the case requires having analysed at least one count. With
  // nothing analysed the score is undefined, and calling the case "WEAK"
  // asserts a conclusion no evidence supports.
  if (chargeResults.length === 0) {
    return {
      caseId,
      charges: [],
      unmappedCharges,
      overallCaseStrength: 'UNKNOWN',
      caseScore: null,
      message:
        `None of the ${charges.length} charged count(s) on this case has a CALCRIM instruction in the ` +
        'library, so no elements could be organised and no assessment of the case is offered.',
    };
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
    unmappedCharges,
    overallCaseStrength: caseStrength,
    caseScore,
    ...(unmappedCharges.length > 0
      ? {
          message:
            `${unmappedCharges.length} charged count(s) have no CALCRIM instruction in the library and are ` +
            'excluded from the assessment above. They are listed under unmappedCharges.',
        }
      : {}),
  };
}
