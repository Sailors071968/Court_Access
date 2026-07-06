// ============================================================================
// Element Impact Engine (ARGUMENT → ELEMENT FAILURE)
// ============================================================================

type Element = {
  id: string;
  label: string;
  satisfied: boolean;
  confidence: number;
  supportingEvents: any[];
};

type Argument = {
  argumentType: string;
  conclusion: string;
  premises: string[];
};

type Interaction = {
  attacker: string;
  target: string;
  impact: "WEAKENS" | "DESTROYS" | "SUPPORTS";
  description: string;
};

// --------------------------------------------------
// 🔍 MAP ARGUMENT → ELEMENT
// --------------------------------------------------
function mapArgumentToElement(arg: Argument, element: Element): boolean {
  const text = (arg.conclusion || "").toLowerCase();

  return (
    text.includes(element.label.toLowerCase()) ||
    text.includes(element.id.toLowerCase())
  );
}

// --------------------------------------------------
// 🔥 MAIN ENGINE
// --------------------------------------------------
export function applyArgumentImpactToElements({
  elements,
  argumentsList,
  interactions
}: {
  elements: Element[];
  argumentsList: Argument[];
  interactions: Interaction[];
}) {

  const updatedElements = [...elements];

  for (const interaction of interactions) {

    if (interaction.impact !== "DESTROYS") continue;

    const targetArg = argumentsList.find(
      a => a.argumentType === interaction.target
    );

    if (!targetArg) continue;

    for (const el of updatedElements) {

      if (mapArgumentToElement(targetArg, el)) {

        console.log(`🔥 ELEMENT HIT: ${el.label}`);

        // Apply penalty
        el.confidence = Math.max(el.confidence - 0.5, 0);

        if (el.confidence < 0.3) {
          el.satisfied = false;
        }

        // Attach reasoning
        (el as any).attackedBy = (el as any).attackedBy || [];
        (el as any).attackedBy.push({
          argument: interaction.attacker,
          reason: interaction.description
        });
      }
    }
  }

  return updatedElements;
}
