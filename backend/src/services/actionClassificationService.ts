// ============================================================================
// CourtAccess — Action Classification Service (Deterministic v1)
// ============================================================================

export interface ClassifiedAction {
  raw: string;
  classified: string;
  category: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// ACTION MAP (EXPANDABLE)
// ---------------------------------------------------------------------------

const ACTION_MAP: Record<
  string,
  { classified: string; category: string; confidence: number }
> = {
  // Movement
  run: { classified: "flee", category: "movement", confidence: 0.9 },
  ran: { classified: "flee", category: "movement", confidence: 0.9 },
  flee: { classified: "flee", category: "movement", confidence: 0.95 },

  approach: { classified: "approach", category: "movement", confidence: 0.9 },
  approached: { classified: "approach", category: "movement", confidence: 0.9 },

  pursue: { classified: "pursuit", category: "movement", confidence: 0.95 },
  pursued: { classified: "pursuit", category: "movement", confidence: 0.95 },

  // Control / Detention
  detain: { classified: "detention", category: "control", confidence: 0.95 },
  detained: { classified: "detention", category: "control", confidence: 0.95 },

  grab: { classified: "physical_control", category: "control", confidence: 0.8 },
  grabbed: { classified: "physical_control", category: "control", confidence: 0.8 },

  // Use of Force
  draw: { classified: "weapon_draw", category: "use_of_force", confidence: 0.9 },
  drew: { classified: "weapon_draw", category: "use_of_force", confidence: 0.9 },

  fire: { classified: "weapon_discharge", category: "use_of_force", confidence: 0.95 },
  fired: { classified: "weapon_discharge", category: "use_of_force", confidence: 0.95 },

  // Presence
  exit: { classified: "exit_vehicle", category: "presence", confidence: 0.9 },
  exited: { classified: "exit_vehicle", category: "presence", confidence: 0.9 },
};

// ---------------------------------------------------------------------------
// MAIN CLASSIFIER
// ---------------------------------------------------------------------------

export function classifyAction(action?: string, description?: string): ClassifiedAction {
  const source = action || description || "";

  if (!source) {
    return {
      raw: "unknown",
      classified: "unknown",
      category: "unknown",
      confidence: 0,
    };
  }

  const normalized = source.toLowerCase();

  // Direct match
  if (action && ACTION_MAP[action.toLowerCase()]) {
    return {
      raw: action,
      ...ACTION_MAP[action.toLowerCase()],
    };
  }

  // Scan description (🔥 NEW)
  for (const key of Object.keys(ACTION_MAP)) {
    const wordBoundary = new RegExp(`\\b${key}\\b`);
    if (wordBoundary.test(normalized)) {
      return {
        raw: source,
        ...ACTION_MAP[key],
        confidence: ACTION_MAP[key].confidence - 0.1,
      };
    }
  }

  return {
    raw: source,
    classified: "unknown",
    category: "unknown",
    confidence: 0.3,
  };
}
