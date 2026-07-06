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

  // DEADLY — use word boundaries; handle "unarmed" negation only for "armed" keyword
  const deadlyKeywords = ["gun", "knife", "shoot", "weapon"];
  const hasDeadlyKeyword = deadlyKeywords.some((k) => new RegExp(`\\b${k}\\b`).test(t));
  const hasArmed = /\barmed\b/.test(t) && !/\bunarmed\b/.test(t);

  if (hasDeadlyKeyword || hasArmed) {
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
