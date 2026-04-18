// ============================================================================
// 🧠 IMPEACHMENT ENGINE (CREDIBILITY DESTRUCTION SYSTEM)
// ============================================================================

type Contradiction = {
  type?: string;
  description?: string;
  severity?: string;
};

type RankedFailure = {
  element: string;
  reason: string;
  damageScore: number;
};

// --------------------------------------------------
// 🔥 BUILD DIRECT IMPEACHMENT (PRIOR STATEMENT STYLE)
// --------------------------------------------------
function buildDirectImpeachment(c: Contradiction): string[] {

  if (!c?.description) return [];

  return [
    `Earlier, you stated: "${c.description}". That was your statement, correct?`,
    `Now your testimony differs from that statement, doesn’t it?`,
    `Both of those statements cannot be true at the same time, correct?`
  ];
}

// --------------------------------------------------
// ⚔️ BUILD FORCED ADMISSION QUESTIONS
// --------------------------------------------------
function buildForcedAdmissions(c: Contradiction): string[] {

  return [
    "So one of those statements must be inaccurate, correct?",
    "And you cannot identify which version is actually true, can you?",
    "That creates uncertainty about your testimony, doesn’t it?"
  ];
}

// --------------------------------------------------
// 🎯 BUILD FAILURE-BASED IMPEACHMENT
// --------------------------------------------------
function buildFailureImpeachment(f: RankedFailure): string[] {

  if (!f?.reason) return [];

  return [
    `Isn't it true that ${f.reason.toLowerCase()}?`,
    "You cannot provide reliable evidence to contradict that, can you?",
    "So your testimony on that point cannot be confirmed, correct?"
  ];
}

// --------------------------------------------------
// 🧠 MAIN IMPEACHMENT GENERATOR
// --------------------------------------------------
export function generateImpeachment(
  contradictions: Contradiction[],
  failureRankings: RankedFailure[]
): string[] {

  try {

    const questions: string[] = [];

    // --------------------------------------------------
    // 🔥 PRIORITY 1: CONTRADICTIONS (STRONGEST ATTACK)
    // --------------------------------------------------
    for (let i = 0; i < contradictions.length && i < 2; i++) {

      const c = contradictions[i];

      questions.push(...buildDirectImpeachment(c));
      questions.push(...buildForcedAdmissions(c));
    }

    // --------------------------------------------------
    // 🔥 PRIORITY 2: FAILURE-BASED ATTACKS
    // --------------------------------------------------
    for (let i = 0; i < failureRankings.length && i < 2; i++) {

      const f = failureRankings[i];

      questions.push(...buildFailureImpeachment(f));
    }

    // --------------------------------------------------
    // 🔥 FINAL CUT (KEEP IT SHARP)
    // --------------------------------------------------
    return questions.slice(0, 12);

  } catch (err) {

    console.error("⚠️ Impeachment engine failed:", err);

    return [
      "Your testimony is inconsistent with prior statements, correct?",
      "Those statements cannot both be true, can they?"
    ];
  }
}
