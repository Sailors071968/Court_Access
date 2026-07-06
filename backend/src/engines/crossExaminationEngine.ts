// ============================================================================
// 🧠 CROSS-EXAMINATION ENGINE (WITNESS ATTACK GENERATOR)
// ============================================================================

type RankedFailure = {
  element: string;
  reason: string;
  damageScore: number;
};

type Contradiction = {
  type?: string;
  description?: string;
  severity?: string;
};

// --------------------------------------------------
// 🎯 CORE QUESTION BUILDER
// --------------------------------------------------
function buildCoreQuestions(keyFailure: string | null): string[] {

  if (!keyFailure) return [];

  return [
    `Isn't it true that ${keyFailure.toLowerCase()}?`,
    `You previously stated that ${keyFailure.toLowerCase()}, correct?`,
    `There is no independent evidence supporting that claim, is there?`
  ];
}

// --------------------------------------------------
// 🔥 CONTRADICTION QUESTIONS
// --------------------------------------------------
function buildContradictionQuestions(contradictions: Contradiction[]): string[] {

  const questions: string[] = [];

  for (const c of contradictions || []) {

    if (!c?.description) continue;

    questions.push(
      `Your statement conflicts with other evidence, specifically: ${c.description}. Can you explain that inconsistency?`
    );

    questions.push(
      `Would you agree that your version of events is inconsistent with the documented evidence?`
    );
  }

  return questions;
}

// --------------------------------------------------
// ⚔️ FAILURE-BASED QUESTIONS
// --------------------------------------------------
function buildFailureQuestions(failures: RankedFailure[]): string[] {

  const questions: string[] = [];

  for (let i = 0; i < failures.length && i < 3; i++) {

    const f = failures[i];
    if (!f?.reason) continue;

    questions.push(
      `Isn't it true that ${f.reason.toLowerCase()}?`
    );

    questions.push(
      `You cannot provide any reliable evidence to dispute that, can you?`
    );
  }

  return questions;
}

// --------------------------------------------------
// 🧠 MAIN GENERATOR
// --------------------------------------------------
export function generateCrossExamination(
  keyFailure: string | null,
  failureRankings: RankedFailure[],
  contradictions: Contradiction[]
): string[] {

  try {

    const core = buildCoreQuestions(keyFailure);

    const contradictionQs = buildContradictionQuestions(contradictions);

    const failureQs = buildFailureQuestions(failureRankings);

    // --------------------------------------------------
    // 🔥 COMBINE + LIMIT (PREVENT OVERLOAD)
    // --------------------------------------------------
    const allQuestions = [
      ...core,
      ...contradictionQs,
      ...failureQs
    ];

    // limit to strongest 10 questions
    return allQuestions.slice(0, 10);

  } catch (err) {

    console.error("⚠️ Cross-examination generation failed:", err);

    return ["Isn't it true that your testimony is inconsistent with the evidence?"];
  }
}
