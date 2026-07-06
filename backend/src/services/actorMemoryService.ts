// ============================================================================
// Actor Memory Service (Deterministic Coreference)
// ============================================================================

interface ActorMemory {
  lastActor: string | null;
}

// Initialize memory
export function createActorMemory(): ActorMemory {
  return {
    lastActor: null,
  };
}

// Resolve actor using memory
export function resolveActor(
  sentence: string,
  extractedActors: { name: string }[],
  memory: ActorMemory
): string {
  // If we found a real actor → update memory
  if (extractedActors.length > 0) {
    const actor = extractedActors[0].name;
    memory.lastActor = actor;
    return actor;
  }

  // Pronoun detection
  if (/\b(he|him|they|the officer|the deputy)\b/i.test(sentence)) {
    if (memory.lastActor) {
      return memory.lastActor;
    }
  }

  return "unknown";
}
