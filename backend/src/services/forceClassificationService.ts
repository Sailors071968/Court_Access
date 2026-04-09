// ============================================================================
// CourtAccess — Force Classification Service (LD15 Foundation)
// ============================================================================

export type ForceLevel =
  | "NONE"
  | "COMMAND"
  | "CONTROL"
  | "LESS_LETHAL"
  | "LETHAL"
  | "UNKNOWN";

export function classifyForceFromText(text: string): ForceLevel {
  if (!text) return "UNKNOWN";

  const t = text.toLowerCase();

  // --------------------------------------------------------------------------
  // LETHAL FORCE
  // --------------------------------------------------------------------------
  if (
    t.includes("shot") ||
    t.includes("firearm") ||
    t.includes("gun") ||
    t.includes("killed")
  ) {
    return "LETHAL";
  }

  // --------------------------------------------------------------------------
  // LESS LETHAL
  // --------------------------------------------------------------------------
  if (
    t.includes("taser") ||
    t.includes("beanbag") ||
    t.includes("pepper spray") ||
    t.includes("rubber bullet")
  ) {
    return "LESS_LETHAL";
  }

  // --------------------------------------------------------------------------
  // CONTROL FORCE
  // --------------------------------------------------------------------------
  if (
    t.includes("tackled") ||
    t.includes("restrained") ||
    t.includes("handcuffed") ||
    t.includes("grabbed")
  ) {
    return "CONTROL";
  }

  // --------------------------------------------------------------------------
  // COMMAND PRESENCE
  // --------------------------------------------------------------------------
  if (
    t.includes("ordered") ||
    t.includes("told") ||
    t.includes("commanded")
  ) {
    return "COMMAND";
  }

  return "NONE";
}
