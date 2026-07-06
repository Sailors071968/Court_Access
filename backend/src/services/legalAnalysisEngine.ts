// ============================================================================
// CALCRIM-Grade Legal Analysis Engine (CLEAN + STABLE)
// ============================================================================

import { calcrimElements } from "../data/calcrimElements";

// --------------------------------------------------
// 🔍 Match Event → Element
// --------------------------------------------------

function matchEvent(e: any, el: any) {
  const text = (e.description || "").toLowerCase();
  const action = (e.action || "").toLowerCase();
  const target = (e.target || "").toLowerCase();

  // STRONG MATCH (action)
  if (el.actions && el.actions.some(a => action.includes(a))) {
    return true;
  }

  // STRONG MATCH (target)
  if (el.targets && el.targets.some(t => target.includes(t))) {
    return true;
  }

  // 🔥 IMPROVED SEMANTIC MATCH
  if (el.keywords && el.keywords.some(k => text.includes(k))) {
    return true;
  }

  // 🔥 CRITICAL: fallback semantic detection (ENTRY)
  if (
    text.includes("enter") ||
    text.includes("entered") ||
    text.includes("entry")
  ) {
    if (el.id === "entry") return true;
  }

  // ==================================================
  // 🔥 NEW: INTENT INFERENCE (VERY IMPORTANT)
  // ==================================================
  if (el.id === "intent") {

    // Theft indicators
    if (
      text.includes("stolen") ||
      text.includes("missing") ||
      text.includes("taken") ||
      text.includes("removed") ||
      text.includes("property gone")
    ) {
      return true;
    }

    // Tool-based inference (burglary tools imply intent)
    if (
      text.includes("crowbar") ||
      text.includes("tool") ||
      text.includes("forced entry") ||
      text.includes("pried open")
    ) {
      return true;
    }

    // Behavior-based inference
    if (
      text.includes("searched") ||
      text.includes("rummaging") ||
      text.includes("went through belongings")
    ) {
      return true;
    }
  }

  return false;
}

// --------------------------------------------------
// 🧠 Detect Crimes (multi-charge)
// --------------------------------------------------
function detectCrimes(events: any[]) {
  const scores: Record<string, number> = {};

  for (const [crime, def] of Object.entries(calcrimElements)) {
    scores[crime] = 0;

    for (const e of events) {
      const text = (e.description || "").toLowerCase();
      if (def.keywords.some(k => text.includes(k))) {
        scores[crime]++;
      }
    }
  }

  return Object.entries(scores)
    .filter(([_, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([crime]) => crime);
}

// --------------------------------------------------
// ⚖️ Score Elements (with victim binding)
// --------------------------------------------------
function scoreElements(events: any[], def: any) {
  return def.elements.map((el: any) => {
    const matches = events.filter(e => matchEvent(e, el));

    const victimBound = el.requiresVictim
      ? matches.filter(e => e.target || e.actor)
      : matches;

    return {
      id: el.id,
      label: el.label,
      satisfied: victimBound.length > 0,
      confidence: Math.min(victimBound.length / 2, 1),
      supportingEvents: victimBound
    };
  });
}

// --------------------------------------------------
// ⚠️ Contradiction Weighting
// --------------------------------------------------
function weightContradictions(contradictions: any[]) {
  let penalty = 0;

  for (const c of contradictions) {
    if (c.type === "presence_conflict") penalty += 0.25;
    else if (c.type === "time_conflict") penalty += 0.15;
    else penalty += 0.1;
  }

  return Math.min(penalty, 0.7);
}

// --------------------------------------------------
// 🎯 Burden of Proof (BRD scoring)
// --------------------------------------------------
function computeBRD(elements: any[], penalty: number) {
  const base =
    elements.filter(e => e.satisfied).length / elements.length;

  const adjusted = Math.max(base - penalty, 0);

  return {
    score: Number(adjusted.toFixed(2)),
    meetsThreshold: adjusted >= 0.9
  };
}

// --------------------------------------------------
// 🧠 MAIN ENGINE (FIXED + HARDENED)
// --------------------------------------------------
export function runLegalAnalysis({
  events = [],
  contradictions = []
}: {
  events: any[];
  contradictions: any;
}) {

  // 🔥 CRITICAL FIX — ALWAYS FORCE ARRAY
  const safeContradictions = Array.isArray(contradictions)
    ? contradictions
    : Array.isArray(contradictions?.conflicts)
      ? contradictions.conflicts
      : [];

  const crimes = detectCrimes(events);

  if (!Array.isArray(crimes) || crimes.length === 0) {
    return { error: "No detectable crime" };
  }

  const results = [];

  for (const crimeKey of crimes) {
    const def = calcrimElements[crimeKey];

    if (!def) continue; // 🔥 safety guard

    const elements = scoreElements(events, def);
    const missing = elements.filter(e => !e.satisfied);

    // 🔥 USE SAFE VERSION HERE
    const penalty = weightContradictions(safeContradictions);

    const brd = computeBRD(elements, penalty);

    const defense = [
      ...missing.map(e => `Failure to prove: ${e.label}`),
      ...(penalty > 0 ? ["Contradictions undermine credibility"] : [])
    ];

    results.push({
      crime: `${crimeKey.toUpperCase()} (${def.code})`,
      intentType: def.intentType,
      elements,
      missingElements: missing.map(m => m.label),
      juryInstructions: def.jury,
      defenseStrategies: defense,

      // 🔥 IMPROVED OUTPUT
      contradictionImpact: penalty,
      contradictions: safeContradictions,

      burdenOfProof: brd,

      overallCaseStrength:
        brd.score > 0.9
          ? "STRONG"
          : brd.score > 0.6
          ? "MODERATE"
          : "WEAK"
    });
  }

  return {
    charges: results
  };
}
