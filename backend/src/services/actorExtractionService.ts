// ============================================================================
// Actor Extraction Service (Deterministic + Court-Safe)
// ============================================================================

export interface ExtractedActor {
  name: string;
  role: string;
  confidence: number;
}

// Basic deterministic extraction (no hallucination)
export function extractActors(text: string): ExtractedActor[] {
  const actors: ExtractedActor[] = [];

  // Officer names (e.g. "Officer Smith", "Deputy Johnson")
  const officerMatches = text.match(/(Officer|Deputy)\s+[A-Z][a-z]+/g);
  if (officerMatches) {
    for (const match of officerMatches) {
      actors.push({
        name: match,
        role: "law_enforcement",
        confidence: 0.9,
      });
    }
  }

  // Suspect / defendant
  if (/suspect|defendant/i.test(text)) {
    actors.push({
      name: "Unknown Suspect",
      role: "suspect",
      confidence: 0.7,
    });
  }

  // Victim
  if (/victim/i.test(text)) {
    actors.push({
      name: "Victim",
      role: "victim",
      confidence: 0.7,
    });
  }

  return actors;
}
