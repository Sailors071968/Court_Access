// ============================================================================
// CourtAccess — Argument Builder (FULL SYMBOLIC LOGIC)
// ============================================================================

type Statement = {
  id: string;
  statement: string;
  elementBindings?: any[];
};

type Proposition = {
  id: string;
  symbol: string; // P, Q, R...
  meaning: string;
  element?: string;
};

type Argument = {
  id: string;
  premises: string[];
  conclusion: string;
  propositions: Proposition[];
  supportingStatements: Statement[];
};

// --------------------------------------------------
// 🧠 STEP 1 — MAP STATEMENTS TO PROPOSITIONS
// --------------------------------------------------
function mapToPropositions(statements: Statement[]): Proposition[] {
  const propositions: Proposition[] = [];
  const letters = "PQRSTUVWXYZABCDEFGHIJKLMN";

  let index = 0;

  for (const stmt of statements) {
    propositions.push({
      id: stmt.id,
      symbol: letters[index % letters.length],
      meaning: stmt.statement,
      element: stmt.elementBindings?.[0]?.elementLabel
    });

    index++;
  }

  return propositions;
}

// --------------------------------------------------
// 🧠 STEP 2 — BUILD CONDITIONAL RELATIONSHIPS
// Example: entry → intent
// --------------------------------------------------
function buildConditionals(propositions: Proposition[]) {
  const relations: string[] = [];

  for (let i = 0; i < propositions.length - 1; i++) {
    const a = propositions[i];
    const b = propositions[i + 1];

    // Simple heuristic: chain related elements
    if (a.element && b.element && a.element !== b.element) {
      relations.push(`${a.symbol} → ${b.symbol}`);
    }
  }

  return relations;
}

// --------------------------------------------------
// 🧠 STEP 3 — BUILD ARGUMENTS
// --------------------------------------------------
export function buildArguments(statements: Statement[]) {

  const argumentsOut: Argument[] = [];

  if (!statements || statements.length < 2) return [];

  // STEP 1
  const propositions = mapToPropositions(statements);

  // STEP 2
  const conditionals = buildConditionals(propositions);

  // --------------------------------------------------
  // 🔥 BUILD MODUS PONENS STRUCTURE
  // P → Q, P ⟹ Q
  // --------------------------------------------------
  for (let i = 0; i < conditionals.length; i++) {
    const conditional = conditionals[i];

    const [left, right] = conditional.split("→").map(s => s.trim());

    const arg: Argument = {
      id: `A-${i}`,
      premises: [
        `${left} → ${right}`,
        `${left}`
      ],
      conclusion: `${right}`,
      propositions,
      supportingStatements: statements
    };

    argumentsOut.push(arg);
  }

  // --------------------------------------------------
  // 🔥 BUILD CONTRADICTION ARGUMENTS
  // P ∧ ¬P
  // --------------------------------------------------
  for (let i = 0; i < propositions.length; i++) {
    for (let j = i + 1; j < propositions.length; j++) {

      const a = propositions[i];
      const b = propositions[j];

      if (
        a.meaning.toLowerCase().includes("not") &&
        b.meaning.toLowerCase().includes(a.meaning.replace("not ", ""))
      ) {
        argumentsOut.push({
          id: `C-${i}-${j}`,
          premises: [`${a.symbol}`, `¬${a.symbol}`],
          conclusion: "Contradiction",
          propositions,
          supportingStatements: statements
        });
      }
    }
  }

  return argumentsOut;
}
