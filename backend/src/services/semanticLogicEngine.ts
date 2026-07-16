// ============================================================================
// CourtAccess — Semantic Logic Engine (MEANING-BASED)
// ============================================================================

type Statement = {
  id: string;
  statement: string;
  actor?: string;
  action?: string;
  target?: string;
  elementBindings?: any[];
};

type Proposition = {
  id: string;
  symbol: string;
  meaning: string;
  element?: string;
};

type Relation = {
  from: string;
  to: string;
  type: "implies" | "contradicts" | "supports";
};

type Argument = {
  premises: string[];
  conclusion: string;
  logicType?: string;
};

// --------------------------------------------------
// 🧠 STEP 1 — SEMANTIC PROPOSITION MAPPING
// --------------------------------------------------
function mapSemanticPropositions(statements: Statement[]): Proposition[] {
  const symbols = "PQRSTUVWXYZABCDEFGHIJKLMN";
  let index = 0;

  return statements.map(stmt => ({
    id: stmt.id,
    symbol: symbols[index++ % symbols.length],
    meaning: stmt.statement,
    element: stmt.elementBindings?.[0]?.elementLabel
  }));
}

// --------------------------------------------------
// 🧠 STEP 2 — DETECT SEMANTIC RELATIONSHIPS
// --------------------------------------------------
function buildSemanticRelations(props: Proposition[]): Relation[] {
  const relations: Relation[] = [];

  for (let i = 0; i < props.length; i++) {
    for (let j = 0; j < props.length; j++) {

      if (i === j) continue;

      const a = props[i];
      const b = props[j];

      const aText = a.meaning.toLowerCase();
      const bText = b.meaning.toLowerCase();

      // --------------------------------------------------
      // 🔥 INTENT INFERENCE
      // --------------------------------------------------
      if (
        a.element === "Entry into a structure" &&
        b.element?.includes("Intent")
      ) {
        relations.push({
          from: a.symbol,
          to: b.symbol,
          type: "implies"
        });
      }

      // --------------------------------------------------
      // 🔥 TOOL → INTENT
      // --------------------------------------------------
      if (
        aText.includes("crowbar") &&
        b.element?.includes("Intent")
      ) {
        relations.push({
          from: a.symbol,
          to: b.symbol,
          type: "implies"
        });
      }

      // --------------------------------------------------
      // 🔥 NEGATION DETECTION
      // --------------------------------------------------
      if (
        aText.includes("not") &&
        bText.replace("not ", "") === aText.replace("not ", "")
      ) {
        relations.push({
          from: a.symbol,
          to: b.symbol,
          type: "contradicts"
        });
      }
    }
  }

  return relations;
}

// --------------------------------------------------
// 🧠 STEP 3 — BUILD ARGUMENTS FROM GRAPH
// --------------------------------------------------
function buildSemanticArguments(
  _props: Proposition[],
  relations: Relation[]
): Argument[] {

  const args: Argument[] = [];

  for (const rel of relations) {

    // --------------------------------------------------
    // MODUS PONENS (SEMANTIC)
    // --------------------------------------------------
    if (rel.type === "implies") {
      args.push({
        premises: [`${rel.from} → ${rel.to}`, `${rel.from}`],
        conclusion: `${rel.to}`,
        logicType: "Modus Ponens"
      });
    }

    // --------------------------------------------------
    // CONTRADICTION
    // --------------------------------------------------
    if (rel.type === "contradicts") {
      args.push({
        premises: [`${rel.from}`, `¬${rel.from}`],
        conclusion: "Contradiction",
        logicType: "Proof by Contradiction"
      });
    }
  }

  return args;
}

// --------------------------------------------------
// 🔥 MAIN ENGINE
// --------------------------------------------------
export function runSemanticLogic(statements: Statement[]) {

  // STEP 1
  const propositions = mapSemanticPropositions(statements);

  // STEP 2
  const relations = buildSemanticRelations(propositions);

  // STEP 3
  const argumentsBuilt = buildSemanticArguments(propositions, relations);

  return {
    propositions,
    relations,
    arguments: argumentsBuilt
  };
}
