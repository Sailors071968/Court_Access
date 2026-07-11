// ============================================================================
// LEGAL CASCADE ENGINE (FULL — STABLE + DEPENDENCIES + STRATEGIC RANKING)
// ============================================================================

import { generateJuryNarrative } from "../engines/juryNarrativeEngine";
import { generateImpeachment } from "../engines/impeachmentEngine";
import { generateCrossExamination } from "../engines/crossExaminationEngine";
import { generateDefenseArgument } from "../engines/argumentGenerator";
import { rankStrongestFailure } from "../engines/rankStrongestFailure";

// --------------------------------------------------
// ⚖️ INTERACTION FORCE MAP
// --------------------------------------------------
export const INTERACTION_FORCE: Record<string, number> = {
  SUPPORTS: 0.25,
  WEAKENS: -0.5,
  DESTROYS: -1.0
};

// --------------------------------------------------
// 🔗 ELEMENT DEPENDENCY GRAPH
// --------------------------------------------------
const ELEMENT_DEPENDENCIES: Record<string, string[]> = {
  intent: ["entry"]
};

// --------------------------------------------------
// 🧠 APPLY INTERACTION STRENGTH
// --------------------------------------------------
export function applyInteractionStrength(argumentsList: any[], interactions: any[]) {
  const state = new Map<string, any>();

  for (const arg of argumentsList || []) {
    state.set(arg.conclusion, {
      ...arg,
      strength: 1.0,
      valid: true,
      attacks: []
    });
  }

  for (const interaction of interactions || []) {
    const target = state.get(interaction.target);
    if (!target) continue;

    const force = INTERACTION_FORCE[interaction.impact] || 0;

    target.strength += force;
    target.attacks.push(interaction);

    target.strength = Math.max(0, Math.min(1, target.strength));

    if (target.strength === 0) {
      target.valid = false;
    }
  }

  return state;
}

// --------------------------------------------------
// 🔥 PROPAGATE ARGUMENTS → ELEMENTS
// --------------------------------------------------
export function propagateToElements(argumentState: Map<string, any>, elements: any[]) {

  const safeElements = elements || [];
  const safeArgs = argumentState ? Array.from(argumentState.values()) : [];

  for (const element of safeElements) {

    const supporting = safeArgs.filter(arg => {

      if (arg.mapping?.element === element.id || arg.mapping?.element === element.label) {
        return true;
      }

      const conclusion = (arg.conclusion || "").toLowerCase();
      const label = (element.label || "").toLowerCase();

      if (
        (label.includes("entry") && (conclusion.includes("enter") || conclusion.includes("present"))) ||
        (label.includes("intent") && conclusion.includes("intent"))
      ) {
        return true;
      }

      return false;
    });

    if (supporting.length === 0) {
      element.confidence = 0;
      element.failed = true;
      element.attackedBy = [];
      continue;
    }

    const prosecutionArgs = supporting.filter(a => a.argumentType === "Prosecution Claim");

    let effectiveStrength;

    if (prosecutionArgs.length > 0) {
      effectiveStrength = Math.min(...prosecutionArgs.map(a => a.strength));
    } else {
      effectiveStrength = Math.min(...supporting.map(a => a.strength));
    }

    element.confidence = effectiveStrength;
    element.failed = effectiveStrength < 0.9;

    element.attackedBy = supporting
      .filter(a => a.strength < 1)
      .map(a => ({
        conclusion: a.conclusion,
        strength: a.strength,
        attacks: a.attacks
      }));
  }

  return safeElements;
}

// --------------------------------------------------
// 🔗 APPLY DEPENDENCY CASCADE
// --------------------------------------------------
export function applyElementDependencies(elements: any[]) {

  const safeElements = elements || [];
  const elementMap = new Map<string, any>();

  for (const el of safeElements) {
    elementMap.set(el.id, el);
  }

  for (const element of safeElements) {

    const deps = ELEMENT_DEPENDENCIES[element.id];
    if (!deps) continue;

    for (const depId of deps) {
      const dependency = elementMap.get(depId);

      if (dependency && dependency.failed) {
        element.confidence = 0;
        element.failed = true;

        element.dependencyFailure = {
          causedBy: depId,
          reason: `Dependency "${depId}" failed`
        };
      }
    }
  }

  return safeElements;
}

// --------------------------------------------------
// ⚖️ BURDEN OF PROOF
// --------------------------------------------------
export function evaluateBurden(elements: any[]) {

  const safeElements = elements || [];

  if (safeElements.length === 0) {
    return {
      burdenMet: false,
      verdict: "NOT PROVEN",
      failedElements: []
    };
  }

  const failedElements = safeElements.filter(e => e?.failed);

  if (failedElements.length > 0) {
    return {
      burdenMet: false,
      verdict: "NOT PROVEN",
      failedElements
    };
  }

  return {
    burdenMet: true,
    verdict: "PROVEN",
    failedElements: []
  };
}

// --------------------------------------------------
// 🧠 BUILD FAILURE EXPLANATION
// --------------------------------------------------
export function buildFailureExplanation(argumentState: Map<string, any>, elements: any[]) {

  const explanations: string[] = [];
  const seen = new Set<string>();

  const safeArgs = argumentState ? Array.from(argumentState.values()) : [];
  const safeElements = elements || [];

  // 🔥 Prosecution failures
  const destroyed = safeArgs.filter(a =>
    a?.argumentType === "Prosecution Claim" &&
    a?.strength === 0 &&
    a?.attacks?.length
  );

  for (const arg of destroyed) {
    if (!arg?.conclusion) continue;

    const msg = `Prosecution failed to establish: "${arg.conclusion}"`;

    if (!seen.has(msg)) {
      seen.add(msg);
      explanations.push(msg);
    }
  }

  // 🔥 Element failures
  for (const element of safeElements) {

    if (!element?.failed) continue;

    const name = element.label || element.name || element.id || "Unknown Element";

    if (element?.dependencyFailure?.causedBy) {
      const msg = `Element "${name}" failed because dependency "${element.dependencyFailure.causedBy}" failed`;

      if (!seen.has(msg)) {
        seen.add(msg);
        explanations.push(msg);
      }

    } else {
      const msg = `Element "${name}" failed to meet beyond a reasonable doubt`;

      if (!seen.has(msg)) {
        seen.add(msg);
        explanations.push(msg);
      }
    }
  }

  return explanations;
}

// --------------------------------------------------
// 🚀 FULL LEGAL CASCADE PIPELINE (FINAL ENGINE)
// --------------------------------------------------
export function runLegalCascade({
  argumentsList = [],
  interactions = [],
  elements = [],
  contradictions = []
}) {

  try {

    // 🛡️ SAFETY NORMALIZATION
    const safeArgs = Array.isArray(argumentsList) ? argumentsList : [];
    const safeInteractions = Array.isArray(interactions) ? interactions : [];
    const safeElements = Array.isArray(elements) ? elements : [];
    const safeContradictions = Array.isArray(contradictions) ? contradictions : [];

    // 1️⃣ Apply interactions
    const argumentState = applyInteractionStrength(safeArgs, safeInteractions);

    // 2️⃣ Map to elements
    const updatedElements = propagateToElements(argumentState, safeElements);

    // 3️⃣ Apply dependencies
    const cascadedElements = applyElementDependencies(updatedElements);

    // 4️⃣ Evaluate burden
    const burden = evaluateBurden(cascadedElements);

    // 5️⃣ Build explanation
    const explanation = buildFailureExplanation(argumentState, cascadedElements);

    // 6️⃣ Rank failures (SAFE)
    let rankedFailures: any[] = [];
    let topFailure: any = null;

    try {
      const argValues =
        argumentState && typeof argumentState.values === "function"
          ? Array.from(argumentState.values())
          : [];

      rankedFailures = rankStrongestFailure(
        Array.isArray(cascadedElements) ? cascadedElements : [],
        safeContradictions,
        argValues
      );

      topFailure = rankedFailures && rankedFailures.length > 0
        ? rankedFailures[0]
        : null;

    } catch (err) {
      console.error("⚠️ Ranking failed:", err);
      rankedFailures = [];
      topFailure = null;
    }

    // 7️⃣ Generate courtroom argument (SAFE)
    let defenseArgument = "";

    try {
      defenseArgument = generateDefenseArgument(
        topFailure?.reason || null,
        Array.isArray(rankedFailures) ? rankedFailures : [],
        Array.isArray(explanation) ? explanation : []
      );
    } catch (err) {
      console.error("⚠️ Argument generator failed:", err);
      defenseArgument = "The prosecution has failed to meet its burden of proof beyond a reasonable doubt.";
    }

    // 🧠 GENERATE JURY NARRATIVE (SAFE)
    let juryNarrative = "";

    try {
      juryNarrative = generateJuryNarrative(
        topFailure?.reason || null,
        Array.isArray(explanation) ? explanation : [],
        defenseArgument || ""
      );
    } catch (err) {
      console.error("⚠️ Jury narrative engine failed:", err);
      juryNarrative = "There is not enough reliable proof to support this case.";
    }

    // 8️⃣ Generate cross-examination questions (SAFE)
    let crossExamination: string[] = [];

    try {
      crossExamination = generateCrossExamination(
        topFailure?.reason || null,
        Array.isArray(rankedFailures) ? rankedFailures : [],
        Array.isArray(safeContradictions) ? safeContradictions : []
      );
    } catch (err) {
      console.error("⚠️ Cross-examination engine failed:", err);
      crossExamination = [];
    }

    // 9️⃣ Generate impeachment questions (SAFE)
    let impeachment: string[] = [];

    try {
      impeachment = generateImpeachment(
        Array.isArray(safeContradictions) ? safeContradictions : [],
        Array.isArray(rankedFailures) ? rankedFailures : []
      );
    } catch (err) {
      console.error("⚠️ Impeachment engine failed:", err);
      impeachment = [];
    }

    // --------------------------------------------------
    // ✅ FINAL OUTPUT (CONSISTENT + SAFE)
    // --------------------------------------------------
    return {
      verdict: burden?.verdict || "NOT PROVEN",
      burdenMet: Boolean(burden?.burdenMet),
      failedElements: Array.isArray(burden?.failedElements) ? burden.failedElements : [],
      keyFailure: topFailure?.reason || null,
      explanation: Array.isArray(explanation) ? explanation : [],
      failureRankings: Array.isArray(rankedFailures) ? rankedFailures : [],
      defenseArgument,
      juryNarrative,
      crossExamination,
      impeachment
    };

  } catch (err) {

    console.error("🔥 CASCADE ENGINE FAILURE:", err);

    return {
      verdict: "NOT PROVEN",
      burdenMet: false,
      failedElements: [],
      keyFailure: null,
      explanation: ["System error during legal analysis"],
      failureRankings: [],
      defenseArgument: "The prosecution has failed to meet its burden of proof beyond a reasonable doubt.",
      juryNarrative: "There is not enough reliable proof to support this case.",
      crossExamination: [
        "Isn't it true that your testimony is inconsistent with the evidence?"
      ],
      impeachment: [
        "Earlier, your statement differed from the evidence, correct?",
        "Those statements cannot both be true, can they?"
      ]
    };
  }
}
