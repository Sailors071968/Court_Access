// ============================================================================
// 🧠 COURTROOM ARGUMENT GENERATOR (DEFENSE STRATEGY ENGINE)
// ============================================================================

type RankedFailure = {
  element: string;
  reason: string;
  damageScore: number;
};

// --------------------------------------------------
// 🎯 BUILD CORE ARGUMENT
// --------------------------------------------------
function buildCoreArgument(keyFailure: string | null): string {

  if (!keyFailure) {
    return "The prosecution has failed to meet its burden of proof beyond a reasonable doubt.";
  }

  return `The prosecution’s case collapses at its foundation. ${keyFailure}. Without this essential element, the entire case cannot stand.`;
}

// --------------------------------------------------
// 🔗 BUILD SUPPORTING ATTACKS
// --------------------------------------------------
function buildSupportingAttacks(failures: RankedFailure[]): string[] {

  const lines: string[] = [];

  for (let i = 1; i < failures.length && i < 3; i++) {

    const f = failures[i];

    if (!f?.reason) continue;

    lines.push(
      `Additionally, ${f.reason.toLowerCase()}, further undermining the reliability of the prosecution’s case.`
    );
  }

  return lines;
}

// --------------------------------------------------
// ⚖️ BUILD LEGAL CONCLUSION
// --------------------------------------------------
function buildConclusion(): string {
  return "Because the prosecution has failed to establish each required element beyond a reasonable doubt, the only just verdict is not proven.";
}

// --------------------------------------------------
// 🧠 MAIN GENERATOR
// --------------------------------------------------
export function generateDefenseArgument(
  keyFailure: string | null,
  failureRankings: RankedFailure[],
  _explanation: string[]
): string {

  try {

    const core = buildCoreArgument(keyFailure);

    const supporting = buildSupportingAttacks(failureRankings || []);

    const conclusion = buildConclusion();

    return [
      core,
      ...supporting,
      conclusion
    ].join(" ");

  } catch (err) {

    console.error("⚠️ Argument generation failed:", err);

    return "The prosecution has failed to meet its burden of proof beyond a reasonable doubt.";
  }
}
