// ============================================================================
// MULTI-EVENT EXTRACTION ENGINE (ENHANCED v2)
// ============================================================================

export interface ExtractedEvent {
  description: string;
  action: string;
  actor: string;
  target: string | null;
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

export function extractActor(text: string): string {
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
    new RegExp(`\\b${keyword}\\b`).test(lower)
  );
}

// ----------------------------------------------------------------------------
// TARGET EXTRACTION (DETERMINISTIC — NO GUESSING)
// Rule A: Direct object after preposition (at/toward/into/onto/to)
// Rule B: "against" prepositional target
// Rule C: Fallback → null (court-safe: never hallucinate)
// ----------------------------------------------------------------------------

export function extractTarget(text: string): string | null {
  const patterns = [
    /\b(?:at|toward|into|onto|to)\s+(?:the\s+)?([a-zA-Z]+)/i,
    /\b(?:against)\s+(?:the\s+)?([a-zA-Z]+)/i,
  ];

  for (const p of patterns) {
    const match = text.match(p);
    if (match) return match[1].toLowerCase();
  }

  return null;
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
      const target = extractTarget(clause);

      // MULTI-ACTION PER CLAUSE
      if (actions.length > 0) {
        for (const action of actions) {
          events.push({
            description: clause,
            actor,
            action,
            target,
          });
        }
      } else {
        // fallback event
        events.push({
          description: clause,
          actor,
          action: "unknown",
          target,
        });
      }
    }
  }

  return events;
}
