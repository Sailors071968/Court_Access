// ============================================================================
// Evidence-matching vocabulary for CALCRIM instructions.
//
// This file holds no law. Each entry names an official statute and the words
// to look for in discovery when testing whether the record touches an element
// of it. The authoritative statement of what the People must prove is compiled
// from the statute itself, retrieved from the Legislature — see src/law.
//
// The `searchHeading` on each element is a label for the operator, not a
// statement of the element. Where a heading and the statute disagree, the
// statute governs.
// ============================================================================

export const calcrimMapping: any = {
  "Penal Code 459": {
    statute: { code: "PEN", section: "459" },
    title: "Burglary",
    calcrim: 1700,
    elements: [
      {
        id: "entry",
        searchHeading: "Defendant entered a building or structure",
        keywords: ["enter", "entered", "inside", "went into"],
        actions: ["enter"],
        targets: ["building", "residence", "store", "structure"]
      },
      {
        id: "intent",
        searchHeading: "Defendant intended to commit theft or felony at time of entry",
        keywords: ["intent", "steal", "theft", "planned"],
        actions: ["steal", "take"],
        targets: ["property", "items"]
      }
    ]
  },

  "Penal Code 484": {
    statute: { code: "PEN", section: "484" },
    title: "Theft",
    calcrim: 1800,
    elements: [
      {
        id: "taking",
        searchHeading: "Defendant took possession of property",
        keywords: ["took", "stole", "removed"],
        actions: ["take", "steal"],
        targets: ["property", "item", "money"]
      },
      {
        id: "ownership",
        searchHeading: "Property belonged to another person",
        keywords: ["belonged", "owned"],
        actions: [],
        targets: []
      }
    ]
  }
};
