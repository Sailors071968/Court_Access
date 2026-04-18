// ============================================================================
// Argument Interaction Engine (COURTROOM LOGIC CORE — FIXED + CASCADE-READY)
// ============================================================================

type Argument = {
  argumentType: string;
  validity: string;
  formula: string;
  mapping?: Record<string, string>;
  premises: string[];
  conclusion: string;
  supportingEvidence?: any[];
};

type Interaction = {
  attacker: string;
  target: string;
  attackType: string;
  description: string;
  impact: "WEAKENS" | "DESTROYS" | "SUPPORTS";
};

// --------------------------------------------------
// 🧠 SEMANTIC GROUPS
// --------------------------------------------------
const semanticMap: Record<string, string[]> = {
  presence: ["present", "at location", "inside", "there"],
  entry: ["enter", "entered", "entry", "gained access", "inside"],
  visibility: ["seen", "observed", "visible", "on camera"],
  intent: ["intent", "plan", "planned", "steal"],
};

// --------------------------------------------------
// 🔍 SEMANTIC MATCH
// --------------------------------------------------
function semanticMatch(a: string, b: string) {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    return true;
  }

  for (const group of Object.values(semanticMap)) {
    const aMatch = group.some(term => aLower.includes(term));
    const bMatch = group.some(term => bLower.includes(term));

    if (aMatch && bMatch) return true;
  }

  return false;
}

// --------------------------------------------------
// 🔍 NEGATION DETECTOR
// --------------------------------------------------
function isNegation(text: string) {
  return /\bnot\b/i.test(text);
}

// --------------------------------------------------
// ⚔️ PREMISE ATTACK (FIXED TARGETING)
// --------------------------------------------------
function detectPremiseAttack(a: Argument, b: Argument): Interaction | null {
  for (const premiseA of a.premises) {
    for (const premiseB of b.premises) {

      const aNeg = isNegation(premiseA);
      const bNeg = isNegation(premiseB);

      const cleanA = premiseA.replace(/\bnot\b/gi, "").trim();
      const cleanB = premiseB.replace(/\bnot\b/gi, "").trim();

      if (aNeg !== bNeg && semanticMatch(cleanA, cleanB)) {

        const attacker = aNeg ? a.conclusion : b.conclusion;
        const target = aNeg ? b.conclusion : a.conclusion;

        return {
          attacker,
          target,
          attackType: "premise_negation",
          description: `"${premiseA}" contradicts "${premiseB}"`,
          impact: "DESTROYS"
        };
      }
    }
  }

  return null;
}

// --------------------------------------------------
// ⚔️ CONCLUSION CONFLICT (FIXED TARGETING)
// --------------------------------------------------
function detectConclusionConflict(a: Argument, b: Argument): Interaction | null {

  const aNeg = isNegation(a.conclusion);
  const bNeg = isNegation(b.conclusion);

  const cleanA = a.conclusion.replace(/\bnot\b/gi, "").trim();
  const cleanB = b.conclusion.replace(/\bnot\b/gi, "").trim();

  if (aNeg !== bNeg && semanticMatch(cleanA, cleanB)) {

    const attacker = aNeg ? a.conclusion : b.conclusion;
    const target = aNeg ? b.conclusion : a.conclusion;

    return {
      attacker,
      target,
      attackType: "conclusion_conflict",
      description: `Conclusion "${a.conclusion}" contradicts "${b.conclusion}"`,
      impact: "DESTROYS"
    };
  }

  return null;
}

// --------------------------------------------------
// ⚖️ VALIDITY ATTACK (FIXED TARGETING)
// --------------------------------------------------
function detectValidityAttack(a: Argument, b: Argument): Interaction | null {

  if (a.validity === "INVALID" && b.validity === "VALID") {
    return {
      attacker: b.conclusion,
      target: a.conclusion,
      attackType: "logical_superiority",
      description: `${b.argumentType} overrides invalid ${a.argumentType}`,
      impact: "WEAKENS"
    };
  }

  if (b.validity === "INVALID" && a.validity === "VALID") {
    return {
      attacker: a.conclusion,
      target: b.conclusion,
      attackType: "logical_superiority",
      description: `${a.argumentType} overrides invalid ${b.argumentType}`,
      impact: "WEAKENS"
    };
  }

  return null;
}

// --------------------------------------------------
// 🧠 MAIN ENGINE (DEDUPED + CASCADE SAFE)
// --------------------------------------------------
export function analyzeArgumentInteractions(argumentsList: Argument[]) {

  const interactions: Interaction[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < argumentsList.length; i++) {
    for (let j = i + 1; j < argumentsList.length; j++) {

      const a = argumentsList[i];
      const b = argumentsList[j];

      const checks = [
        detectPremiseAttack(a, b),
        detectConclusionConflict(a, b),
        detectValidityAttack(a, b)
      ];

      for (const interaction of checks) {
        if (!interaction) continue;

        const key = `${interaction.attacker}-${interaction.target}-${interaction.attackType}`;

        if (!seen.has(key)) {
          seen.add(key);
          interactions.push(interaction);
        }
      }
    }
  }

  return interactions;
}

// --------------------------------------------------
// 🔥 CONTRADICTION → INTERACTION BRIDGE (CRITICAL)
// --------------------------------------------------
export function injectContradictionAttacks(argumentsList: Argument[], contradictions: any[]) {
  const interactions: Interaction[] = [];

  for (const contradiction of contradictions) {

    for (const arg of argumentsList) {

      const conclusion = (arg.conclusion || "").toLowerCase();

      if (contradiction.type === "presence_conflict") {
        if (conclusion.includes("enter") || conclusion.includes("present")) {
          interactions.push({
            attacker: "Contradiction",
            target: arg.conclusion,
            attackType: "presence_conflict",
            impact: "DESTROYS",
            description: "Contradiction: presence vs absence"
          });
        }
      }

      if (contradiction.type === "time_conflict") {
        interactions.push({
          attacker: "Contradiction",
          target: arg.conclusion,
          attackType: "time_conflict",
          impact: "WEAKENS",
          description: "Conflicting timelines"
        });
      }
    }
  }

  return interactions;
}
