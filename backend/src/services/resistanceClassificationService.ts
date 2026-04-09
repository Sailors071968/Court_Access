// ============================================================================
// CourtAccess — Resistance Classification Service
// ============================================================================

export type ResistanceLevel =
  | "NONE"
  | "PASSIVE"
  | "ACTIVE"
  | "AGGRESSIVE"
  | "DEADLY"
  | "UNKNOWN";

export function classifyResistanceFromText(text: string): ResistanceLevel {
  if (!text) return "UNKNOWN";

  const t = text.toLowerCase();

  // DEADLY — use word boundaries to prevent "unarmed" matching "armed"
  if (
    /\bgun\b/.test(t) ||
    /\bknife\b/.test(t) ||
    /\barmed\b/.test(t) ||
    /\bshoot\b/.test(t) ||
    /\bweapon\b/.test(t)
  ) {
    // Exclude negations like "unarmed"
    if (/\bunarmed\b/.test(t)) return "NONE";
    return "DEADLY";
  }

  // AGGRESSIVE
  if (
    t.includes("attack") ||
    t.includes("assault") ||
    t.includes("punch") ||
    t.includes("kick") ||
    t.includes("fight")
  ) {
    return "AGGRESSIVE";
  }

  // ACTIVE — use word boundaries to prevent "ran" matching "entrance"
  if (
    /\bresist\b/.test(t) ||
    /\bflee\b/.test(t) ||
    /\bran\b/.test(t) ||
    /\bstruggle\b/.test(t)
  ) {
    return "ACTIVE";
  }

  // PASSIVE
  if (
    t.includes("refused") ||
    t.includes("would not") ||
    t.includes("non-compliant")
  ) {
    return "PASSIVE";
  }

  // NONE
  if (
    t.includes("complied") ||
    t.includes("cooperative")
  ) {
    return "NONE";
  }

  return "UNKNOWN";
}
