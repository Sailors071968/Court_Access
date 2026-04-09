// ============================================================================
// CourtAccess — Actor Resolution Engine (Deterministic)
// ============================================================================

interface ActorMemory {
  lastNamedActor: string | null;
  knownActors: Set<string>;
}

// ----------------------------------------------------------------------------
// CREATE MEMORY
// ----------------------------------------------------------------------------

export function createActorMemory(): ActorMemory {
  return {
    lastNamedActor: null,
    knownActors: new Set(),
  };
}

// ----------------------------------------------------------------------------
// NORMALIZATION RULES
// ----------------------------------------------------------------------------

function normalizeActor(raw: string): string {
  const text = raw.toLowerCase();

  // 🔥 SUSPECT NORMALIZATION
  if (
    text.includes("suspect") ||
    text.includes("robber") ||
    /\bmale\b/.test(text) ||
    text === "he" ||
    text === "him" ||
    text === "subject"
  ) {
    return "Suspect";
  }

  // 🔥 OFFICER NORMALIZATION
  if (text.includes("officer")) {
    return raw;
  }

  // 🔥 DEFAULT CLEANUP
  return raw.trim();
}

// ----------------------------------------------------------------------------
// RESOLVE ACTOR
// ----------------------------------------------------------------------------

export function resolveActor(
  sentence: string,
  extractedActors: string[],
  memory: ActorMemory
): string {
  // --------------------------------------------------------------------------
  // STEP 1: PRIORITY — NAMED ACTORS
  // --------------------------------------------------------------------------

  const namedActor = extractedActors.find((a) =>
    /Officer|Sgt|Lt|Detective/i.test(a)
  );

  if (namedActor) {
    const normalized = normalizeActor(namedActor);

    memory.lastNamedActor = normalized;
    memory.knownActors.add(normalized);

    return normalized;
  }

  // --------------------------------------------------------------------------
  // STEP 2: SUSPECT REFERENCES
  // --------------------------------------------------------------------------

  const suspectActor = extractedActors.find((a) =>
    /suspect|robber|\bmale\b|subject/i.test(a)
  );

  if (suspectActor) {
    return "Suspect";
  }

  // --------------------------------------------------------------------------
  // STEP 3: PRONOUN RESOLUTION
  // --------------------------------------------------------------------------

  if (/\b(he|him|they|them)\b/i.test(sentence)) {
    if (memory.lastNamedActor) {
      return memory.lastNamedActor;
    }
    return "Suspect"; // fallback
  }

  // --------------------------------------------------------------------------
  // STEP 4: FALLBACK
  // --------------------------------------------------------------------------

  if (memory.lastNamedActor) {
    return memory.lastNamedActor;
  }

  return "Unknown";
}
