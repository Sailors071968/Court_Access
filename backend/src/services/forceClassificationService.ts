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
    /\bshot\b/.test(t) ||
    /\bfirearm\b/.test(t) ||
    /\bgun\b/.test(t) ||
    /\bkilled\b/.test(t)
  ) {
    return "LETHAL";
  }

  // --------------------------------------------------------------------------
  // LESS LETHAL
  // --------------------------------------------------------------------------
  if (
    /\btaser\b/.test(t) ||
    /\bbeanbag\b/.test(t) ||
    /\bpepper spray\b/.test(t) ||
    /\brubber bullet\b/.test(t)
  ) {
    return "LESS_LETHAL";
  }

  // --------------------------------------------------------------------------
  // CONTROL FORCE
  // --------------------------------------------------------------------------
  if (
    /\btackled\b/.test(t) ||
    /\brestrained\b/.test(t) ||
    /\bhandcuffed\b/.test(t) ||
    /\bgrabbed\b/.test(t)
  ) {
    return "CONTROL";
  }

  // --------------------------------------------------------------------------
  // COMMAND PRESENCE
  // --------------------------------------------------------------------------
  if (
    /\bordered\b/.test(t) ||
    /\btold\b/.test(t) ||
    /\bcommanded\b/.test(t)
  ) {
    return "COMMAND";
  }

  return "NONE";
}
