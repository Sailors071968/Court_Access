export const calcrimMapping: any = {
  "Penal Code 459": {
    title: "Burglary",
    calcrim: 1700,
    elements: [
      {
        id: "entry",
        text: "Defendant entered a building or structure",
        keywords: ["enter", "entered", "inside", "went into"],
        actions: ["enter"],
        targets: ["building", "residence", "store", "structure"]
      },
      {
        id: "intent",
        text: "Defendant intended to commit theft or felony at time of entry",
        keywords: ["intent", "steal", "theft", "planned"],
        actions: ["steal", "take"],
        targets: ["property", "items"]
      }
    ]
  },

  "Penal Code 484": {
    title: "Theft",
    calcrim: 1800,
    elements: [
      {
        id: "taking",
        text: "Defendant took possession of property",
        keywords: ["took", "stole", "removed"],
        actions: ["take", "steal"],
        targets: ["property", "item", "money"]
      },
      {
        id: "ownership",
        text: "Property belonged to another person",
        keywords: ["belonged", "owned"],
        actions: [],
        targets: []
      }
    ]
  }
};
