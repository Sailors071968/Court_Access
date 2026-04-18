// ============================================================================
// CourtAccess — CALCRIM Mapping Service
// ============================================================================

type CalcrimElement = {
  id: string;
  description: string;
};

type CalcrimChargeDefinition = {
  code: string;
  section: string;
  title: string;
  elements: CalcrimElement[];
};

// 🔥 INITIAL CALCRIM DATABASE (expand over time)
const CALCRIM_DB: CalcrimChargeDefinition[] = [
  {
    code: "Penal Code",
    section: "459",
    title: "Burglary",
    elements: [
      {
        id: "intent",
        description: "Defendant entered a structure with intent to commit theft or felony"
      },
      {
        id: "entry",
        description: "Defendant entered a building or structure"
      },
      {
        id: "structure",
        description: "The structure qualifies as a building or dwelling"
      }
    ]
  }
];

// ============================================================================
// GET ELEMENTS FOR A CHARGE
// ============================================================================

export function getCalcrimElements(code: string, section: string): CalcrimElement[] {
  const charge = CALCRIM_DB.find(
    c => c.code === code && c.section === section
  );

  return charge?.elements || [];
}

// ============================================================================
// MATCH EVIDENCE TO ELEMENTS
// ============================================================================

export function analyzeElementsAgainstEvents(
  elements: CalcrimElement[],
  events: any[]
) {
  return elements.map(element => {
    const matchedEvents = events.filter(event =>
      event.description?.toLowerCase().includes(
        element.description.toLowerCase().split(" ")[0]
      )
    );

    return {
      elementId: element.id,
      description: element.description,
      status: matchedEvents.length > 0 ? "supported" : "missing",
      supportingEvents: matchedEvents.map(e => e.id),
    };
  });
}
