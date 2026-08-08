// ============================================================================
// Evidence-matching vocabulary.
//
// This file holds no law. What it holds is the language to look for in
// discovery when deciding which statutes a case might involve: the words a
// police report uses for entering a building, taking property, striking a
// person.
//
// The elements of an offence are not here. They are compiled from the statute
// itself, retrieved from the Legislature — see src/law. Each entry names the
// section it searches for so the authoritative text can be fetched, and the
// labels below are search headings, not statements of what the People must
// prove.
// ============================================================================

export type ElementDef = {
  id: string;
  label: string;
  actions?: string[];
  targets?: string[];
  keywords?: string[];
  requiresVictim?: boolean;
  weight?: number; // 🔥 NEW: importance of element
};

export type CrimeDef = {
  code: string;
  /** The official section this vocabulary searches for, for retrieval. */
  statute: { code: string; section: string };
  intentType: "specific" | "general";
  keywords: string[];
  elements: ElementDef[];
  jury: string[];
};

export const calcrimElements: Record<string, CrimeDef> = {

  // ---------------- Penal Code ----------------
  burglary: {
    code: "PC 459",
    statute: { code: "PEN", section: "459" },
    intentType: "specific",
    keywords: [
      "enter", "entered", "break in", "broke into",
      "residence", "home", "building", "structure"
    ],
    elements: [
      {
        id: "entry",
        label: "Entry into a structure",
        actions: ["enter", "break", "open"],
        targets: ["house","building","room","residence"],
        weight: 0.4
      },
      {
        id: "intent",
        label: "Intent to commit theft or felony at entry",
        keywords: ["steal","theft","plan","intended","decided"],
        weight: 0.6
      }
    ],
    jury: [
      "The defendant entered a building or structure.",
      "When entering, the defendant intended to commit theft or a felony."
    ]
  },

  robbery: {
    code: "PC 211",
    statute: { code: "PEN", section: "211" },
    intentType: "specific",
    keywords: [
      "rob", "robbed", "robbery",
      "force", "fear", "threat",
      "demanded money", "took by force"
    ],
    elements: [
      {
        id: "taking",
        label: "Taking property from a person",
        actions: ["take","grab","snatch"],
        requiresVictim: true,
        weight: 0.3
      },
      {
        id: "force",
        label: "Use of force or fear",
        keywords: ["threat","fear","weapon","force","intimidate"],
        weight: 0.4
      },
      {
        id: "intent",
        label: "Intent to permanently deprive",
        keywords: ["keep","not return","steal","permanently"],
        weight: 0.3
      }
    ],
    jury: [
      "The defendant took property from another person.",
      "The property was taken against that person’s will.",
      "The defendant used force or fear.",
      "The defendant intended to permanently deprive the owner."
    ]
  },

  assault: {
    code: "PC 240",
    statute: { code: "PEN", section: "240" },
    intentType: "general",
    keywords: [
      "hit","strike","attack","swing","punch","attempted to hit"
    ],
    elements: [
      {
        id: "act",
        label: "Willful act likely to result in force",
        actions: ["hit","strike","swing","punch"],
        requiresVictim: true,
        weight: 1.0
      }
    ],
    jury: [
      "The defendant committed an act likely to result in the application of force.",
      "The act was done willfully."
    ]
  },

  theft: {
    code: "PC 484",
    statute: { code: "PEN", section: "484" },
    intentType: "specific",
    keywords: [
      "steal","stole","shoplift","took property","larceny"
    ],
    elements: [
      {
        id: "taking",
        label: "Taking possession of property",
        actions: ["take","grab","remove"],
        requiresVictim: true,
        weight: 0.4
      },
      {
        id: "intent",
        label: "Intent to permanently deprive",
        keywords: ["keep","not return","steal","permanent"],
        weight: 0.6
      }
    ],
    jury: [
      "The defendant took possession of property owned by another.",
      "The defendant intended to permanently deprive the owner of it."
    ]
  },

  // ---------------- Vehicle Code ----------------
  dui: {
    code: "VC 23152",
    statute: { code: "VEH", section: "23152" },
    intentType: "general",
    keywords: [
      "drive","driving","vehicle","dui","intoxicated","drunk driving"
    ],
    elements: [
      {
        id: "driving",
        label: "Driving a vehicle",
        actions: ["drive"],
        weight: 0.5
      },
      {
        id: "impairment",
        label: "Under the influence",
        keywords: ["drunk","intoxicated","bac","under influence"],
        weight: 0.5
      }
    ],
    jury: [
      "The defendant drove a vehicle.",
      "At the time, the defendant was under the influence."
    ]
  },

  // ---------------- Health & Safety ----------------
  narcotics_possession: {
    code: "HSC 11350",
    statute: { code: "HSC", section: "11350" },
    intentType: "general",
    keywords: [
      "drug","drugs","possession","cocaine","heroin","controlled substance"
    ],
    elements: [
      {
        id: "possession",
        label: "Possession of a controlled substance",
        keywords: ["possessed","had on","found on"],
        weight: 0.5
      },
      {
        id: "knowledge",
        label: "Knowledge of presence and nature",
        keywords: ["knew","aware","knowledge"],
        weight: 0.5
      }
    ],
    jury: [
      "The defendant possessed a controlled substance.",
      "The defendant knew of its presence and nature."
    ]
  }

};
