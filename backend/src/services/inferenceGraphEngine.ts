// ============================================================================
// CourtAccess — Inference Graph Engine (MULTI-STEP LOGIC)
// ============================================================================

type Proposition = {
  symbol: string;
  meaning: string;
};

type Relation = {
  from: string;
  to: string;
  type: "implies" | "contradicts" | "supports";
};

type Inference = {
  type: string;
  premises: string[];
  conclusion: string;
  formula: string;
};

// --------------------------------------------------
// 🧠 BUILD GRAPH
// --------------------------------------------------
function buildGraph(relations: Relation[]) {
  const graph: Record<string, Relation[]> = {};

  for (const rel of relations) {
    if (!graph[rel.from]) graph[rel.from] = [];
    graph[rel.from].push(rel);
  }

  return graph;
}

// --------------------------------------------------
// 🔥 FIND CHAINS (P → Q → R)
// --------------------------------------------------
function findChains(graph: Record<string, Relation[]>) {
  const chains: string[][] = [];

  for (const start in graph) {
    for (const rel1 of graph[start]) {
      if (rel1.type !== "implies") continue;

      const next = graph[rel1.to];
      if (!next) continue;

      for (const rel2 of next) {
        if (rel2.type !== "implies") continue;

        chains.push([rel1.from, rel1.to, rel2.to]);
      }
    }
  }

  return chains;
}

// --------------------------------------------------
// 🧠 GENERATE INFERENCES
// --------------------------------------------------
function generateInferences(
  relations: Relation[]
): Inference[] {

  const inferences: Inference[] = [];
  const graph = buildGraph(relations);

  // --------------------------------------------------
  // 🔥 HYPOTHETICAL SYLLOGISM
  // P → Q, Q → R ⟹ P → R
  // --------------------------------------------------
  const chains = findChains(graph);

  for (const chain of chains) {
    const [p, q, r] = chain;

    inferences.push({
      type: "Hypothetical Syllogism",
      premises: [`${p} → ${q}`, `${q} → ${r}`],
      conclusion: `${p} → ${r}`,
      formula: "P → Q, Q → R ⟹ P → R"
    });
  }

  // --------------------------------------------------
  // 🔥 CONTRADICTION PROPAGATION
  // P → Q and ¬Q ⟹ ¬P (Modus Tollens)
  // --------------------------------------------------
  for (const rel of relations) {
    if (rel.type !== "implies") continue;

    for (const other of relations) {
      if (other.type !== "contradicts") continue;

      if (rel.to === other.from) {
        inferences.push({
          type: "Modus Tollens",
          premises: [`${rel.from} → ${rel.to}`, `¬${rel.to}`],
          conclusion: `¬${rel.from}`,
          formula: "P → Q, ¬Q ⟹ ¬P"
        });
      }
    }
  }

  // --------------------------------------------------
  // 🔥 DIRECT MODUS PONENS
  // --------------------------------------------------
  for (const rel of relations) {
    if (rel.type === "implies") {
      inferences.push({
        type: "Modus Ponens",
        premises: [`${rel.from} → ${rel.to}`, `${rel.from}`],
        conclusion: `${rel.to}`,
        formula: "P → Q, P ⟹ Q"
      });
    }
  }

  return inferences;
}

// --------------------------------------------------
// 🔥 MAIN ENGINE
// --------------------------------------------------
export function runInferenceGraphEngine(
  _propositions: Proposition[],
  relations: Relation[]
) {

  const inferences = generateInferences(relations);

  return {
    graph: relations,
    inferences
  };
}
