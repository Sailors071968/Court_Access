// ============================================================================
// MULTI-EVENT EXTRACTION ENGINE (ENHANCED v2)
// ============================================================================

export interface ExtractedEvent {
  description: string;
  action: string;
  actor: string;
  timestamp?: string;
}

// ----------------------------------------------------------------------------
// ACTION KEYWORDS (EXPANDED)
// ----------------------------------------------------------------------------

const ACTION_KEYWORDS = [
  "approach",
  "exit",
  "enter",
  "draw",
  "fire",
  "shoot",
  "detain",
  "handcuff",
  "search",
  "pursue",
  "chase",
  "strike",
  "tase",
  "yell",
  "order",
  "command",
  "observe",
  "interview",
  "respond",
  "arrive",
  "leave",
  "transport",
];

// ----------------------------------------------------------------------------
// SENTENCE SPLIT
// ----------------------------------------------------------------------------

function splitSentences(text: string): string[] {
  return text
    .replace(/\n/g, " ")
    .split(/[.?!]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ----------------------------------------------------------------------------
// CLAUSE SPLIT (MORE AGGRESSIVE)
// ----------------------------------------------------------------------------

function splitClauses(sentence: string): string[] {
  return sentence
    .split(/,| and | then | after | while | when | as | which | who /i)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ----------------------------------------------------------------------------
// ACTOR EXTRACTION
// ----------------------------------------------------------------------------

function extractActor(text: string): string {
  const match = text.match(
    /(Officer\s+\w+|Deputy\s+\w+|Detective\s+\w+|Suspect|Victim|Defendant)/i
  );
  return match ? match[0] : "unknown";
}

// ----------------------------------------------------------------------------
// ACTION EXTRACTION
// ----------------------------------------------------------------------------

function extractActions(text: string): string[] {
  const lower = text.toLowerCase();

  return ACTION_KEYWORDS.filter((keyword) =>
    lower.includes(keyword)
  );
}

// ----------------------------------------------------------------------------
// MAIN EXTRACTION
// ----------------------------------------------------------------------------

export function extractEvents(chunkText: string): ExtractedEvent[] {
  const sentences = splitSentences(chunkText);

  const events: ExtractedEvent[] = [];

  for (const sentence of sentences) {
    const clauses = splitClauses(sentence);

    for (const clause of clauses) {
      if (clause.length < 8) continue;

      const actor = extractActor(clause);
      const actions = extractActions(clause);

      // 🔥 MULTI-ACTION PER CLAUSE
      if (actions.length > 0) {
        for (const action of actions) {
          events.push({
            description: clause,
            actor,
            action,
          });
        }
      } else {
        // fallback event
        events.push({
          description: clause,
          actor,
          action: "unknown",
        });
      }
    }
  }

  return events;
}
