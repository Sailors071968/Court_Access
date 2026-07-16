// ============================================================================
// CourtAccess — Explainable Argument Engine (SHOW YOUR WORK)
// ============================================================================

export function buildExplainableArguments(events: any[]) {

  const argumentsOut: any[] = [];

  // --------------------------------------------------
  // 🧠 DEFINE PROPOSITIONS
  // --------------------------------------------------
  const propositions = {
    P: events.find(e => e.action === "enter"),
    Q: events.find(e => e.description?.includes("missing") || e.target === "stolen property"),
    R: events.find(e => e.target === "forced entry")
  };

  // --------------------------------------------------
  // 🔥 MODUS PONENS (BURGLARY)
  // If entry → intent, entry exists → intent
  // --------------------------------------------------
  if (propositions.P && propositions.Q) {

    argumentsOut.push({
      argumentType: "Modus Ponens",
      validity: "VALID",
      formula: "P → Q, P ⟹ Q",

      mapping: {
        P: "Defendant entered the residence",
        Q: "Defendant intended to commit theft"
      },

      premises: [
        "If a person enters a structure and property is missing, intent to commit theft can be inferred",
        "Defendant entered the residence"
      ],

      conclusion: "Defendant intended to commit theft",

      // 🔥 SHOW THE EVIDENCE
      supportingEvidence: [
        {
          statement: propositions.P.description,
          source: propositions.P.sourceType,
          timestamp: propositions.P.timestamp,
          confidence: propositions.P.confidence
        },
        {
          statement: propositions.Q.description,
          source: propositions.Q.sourceType,
          timestamp: propositions.Q.timestamp,
          confidence: propositions.Q.confidence
        }
      ]
    });
  }

  // --------------------------------------------------
  // 🔥 MODUS TOLLENS (DEFENSE ARGUMENT)
  // If present → seen, not seen → not present
  // --------------------------------------------------
  const denial = events.find(e => e.action === "deny");

  if (denial && propositions.P) {
    argumentsOut.push({
      argumentType: "Modus Tollens",
      validity: "VALID",
      formula: "P → Q, ¬Q ⟹ ¬P",

      mapping: {
        P: "Defendant was present",
        Q: "Defendant was seen at the location"
      },

      premises: [
        "If defendant was present, he would be seen",
        "Defendant claims he was not seen / not present"
      ],

      conclusion: "Defendant was not present (defense claim)",

      supportingEvidence: [
        {
          statement: denial.description,
          source: denial.sourceType
        }
      ]
    });
  }

  return argumentsOut;
}
// --------------------------------------------------
// 🔥 PROSECUTION ARGUMENT BUILDER
// --------------------------------------------------
export function buildProsecutionArguments(events: any[]) {

  const args: any[] = [];

  for (const e of events) {

    if (!e.action) continue;

    if (e.action === "enter") {
      args.push({
        argumentType: "Prosecution Claim",
        validity: "ASSUMED",
        premises: [e.description],
        conclusion: e.description,
        mapping: { element: "entry" },
        supportingEvidence: [e]
      });
    }

    if (e.action === "observe") {
      args.push({
        argumentType: "Prosecution Claim",
        validity: "ASSUMED",
        premises: [e.description],
        conclusion: e.description,
        mapping: { element: "identity" },
        supportingEvidence: [e]
      });
    }
  }

  return args;
}
