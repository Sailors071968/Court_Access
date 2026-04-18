// ============================================================================
// 🧠 JURY NARRATIVE ENGINE (PERSUASION + SIMPLIFICATION)
// ============================================================================

// --------------------------------------------------
// 🎯 SIMPLIFY LANGUAGE
// --------------------------------------------------
function simplify(text: string): string {
  return text
    .replace(/beyond a reasonable doubt/gi, "without real proof")
    .replace(/prosecution/gi, "the case against the defendant")
    .replace(/failed to establish/gi, "did not prove")
    .replace(/evidence/gi, "proof");
}

// --------------------------------------------------
// 🧠 BUILD CORE STORY
// --------------------------------------------------
function buildCoreStory(keyFailure: string | null): string {

  if (!keyFailure) {
    return "There simply isn’t enough reliable proof to support the case.";
  }

  return `This case falls apart for one simple reason: ${simplify(keyFailure)}.`;
}

// --------------------------------------------------
// 🔗 SUPPORTING POINTS (SIMPLIFIED)
// --------------------------------------------------
function buildSupportingPoints(explanation: string[]): string[] {

  const points: string[] = [];

  for (let i = 0; i < explanation.length && i < 2; i++) {

    const e = explanation[i];
    if (!e) continue;

    points.push(simplify(e));
  }

  return points;
}

// --------------------------------------------------
// ⚖️ FINAL JURY MESSAGE
// --------------------------------------------------
function buildClosing(): string {
  return "When the evidence doesn’t clearly prove the case, the only fair conclusion is that it has not been proven.";
}

// --------------------------------------------------
// 🧠 MAIN GENERATOR
// --------------------------------------------------
export function generateJuryNarrative(
  keyFailure: string | null,
  explanation: string[],
  defenseArgument: string
): string {

  try {

    const core = buildCoreStory(keyFailure);
    const supporting = buildSupportingPoints(explanation);
    const closing = buildClosing();

    return [
      core,
      ...supporting,
      closing
    ].join(" ");

  } catch (err) {

    console.error("⚠️ Jury narrative failed:", err);

    return "There is not enough reliable proof to support this case.";
  }
}
