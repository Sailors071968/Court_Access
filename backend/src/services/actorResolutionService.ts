// ============================================================================
// CourtAccess — Actor Resolution Service (SEQUENTIAL CONTEXT ENGINE)
// ============================================================================

export interface ResolvedActor {
  original: string;
  resolved: string | string[];
  confidence: number;
  method: "exact" | "context" | "fallback";
}

// ---------------------------------------------------------------------------
// PRONOUNS
// ---------------------------------------------------------------------------

const PRONOUNS = ["he", "she", "they", "them", "him"];

function isPronoun(actor: string): boolean {
  return PRONOUNS.includes(actor.toLowerCase());
}

// ---------------------------------------------------------------------------
// MAIN RESOLUTION ENGINE (🔥 SEQUENTIAL CONTEXT)
// ---------------------------------------------------------------------------

export function resolveActors(
  chunkText: string,
  events: any[]
): any[] {
  let lastKnownActor: string | null = null;

  return events.map((event, index) => {
    const resolvedActors: ResolvedActor[] = [];

    const actors = event.actors || [];

    for (const actor of actors) {
      // ---------------------------------------------------
      // CASE 1: Named actor → update memory
      // ---------------------------------------------------
      if (!isPronoun(actor) && actor !== "unknown") {
        lastKnownActor = actor;

        resolvedActors.push({
          original: actor,
          resolved: actor,
          confidence: 1.0,
          method: "exact",
        });

        continue;
      }

      // ---------------------------------------------------
      // CASE 2: Pronoun → use last known actor
      // ---------------------------------------------------
      if (lastKnownActor) {
        resolvedActors.push({
          original: actor,
          resolved: lastKnownActor,
          confidence: 0.85,
          method: "context",
        });
      } else {
        resolvedActors.push({
          original: actor,
          resolved: actor,
          confidence: 0.3,
          method: "fallback",
        });
      }
    }

    return {
      ...event,
      resolvedActors,
    };
  });
}
