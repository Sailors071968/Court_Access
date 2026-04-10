// ============================================================================
// CourtAccess — Structured Attribute Extraction (Phase 3)
// DETERMINISTIC: Extract ONLY what is explicitly present. No inference.
// If not found → null. No guessing.
// ============================================================================

// ---------------------------------------------------------------------------
// EXTRACTION RULES
// ---------------------------------------------------------------------------

// 1. HEIGHT — "5'8", "6'2", "5'10"
const HEIGHT_REGEX = /\b([4-7]'[0-9]{1,2}"?)\b/;

// 2. WEAPON — explicit keyword match only
const WEAPONS = [
  "handgun",
  "revolver",
  "rifle",
  "knife",
  "shotgun",
  "firearm",
  "pistol",
  "taser",
  "baton",
  "pepper spray",
  "machete",
  "sword",
  "brass knuckles",
  "baseball bat",
] as const;

// Build a regex that matches any weapon keyword with word boundaries
const WEAPON_REGEX = new RegExp(
  `\\b(${WEAPONS.join("|")})\\b`,
  "i",
);

// 3. VEHICLE — color + make + model (reuse from extractTarget)
export const VEHICLE_COLORS = [
  "red", "blue", "black", "gray", "grey", "white", "silver",
  "green", "brown", "dark", "maroon", "tan", "beige", "gold",
  "orange", "yellow", "purple",
];

export const VEHICLE_MAKES = [
  "Toyota", "Honda", "Ford", "Chevy", "Chevrolet", "Nissan",
  "BMW", "Mercedes", "Hyundai", "Kia", "Dodge", "Jeep",
  "Subaru", "Volkswagen", "VW", "Audi", "Lexus", "Acura",
  "Mazda", "Buick", "Cadillac", "GMC", "Lincoln", "Chrysler",
  "Ram", "Tesla", "Volvo", "Infiniti", "Mitsubishi",
];

const VEHICLE_REGEX = new RegExp(
  `\\b(${VEHICLE_COLORS.join("|")})\\s+(${VEHICLE_MAKES.join("|")})\\s+([A-Za-z]+)\\b`,
  "i",
);

// 4. DIRECTION — cardinal movement directions
const DIRECTION_REGEX = /\b(northbound|southbound|eastbound|westbound)\b/i;

// ---------------------------------------------------------------------------
// EXTRACTED ATTRIBUTES TYPE
// ---------------------------------------------------------------------------

export interface ExtractedAttributes {
  height: string | null;
  weapon: string | null;
  vehicle: string | null;
  direction: string | null;
}

// ---------------------------------------------------------------------------
// MAIN EXTRACTION FUNCTION
// ---------------------------------------------------------------------------

/**
 * Extract structured attributes from a text clause.
 * Rules are deterministic — if not found, returns null.
 * No inference, no guessing.
 */
export function extractAttributes(text: string): ExtractedAttributes {
  return {
    height: extractHeight(text),
    weapon: extractWeapon(text),
    vehicle: extractVehicle(text),
    direction: extractDirection(text),
  };
}

// ---------------------------------------------------------------------------
// INDIVIDUAL EXTRACTORS
// ---------------------------------------------------------------------------

function extractHeight(text: string): string | null {
  const match = text.match(HEIGHT_REGEX);
  if (!match) return null;

  // Normalize: strip trailing quote if present, return as-is
  const raw = match[1].replace(/"$/, "");
  return raw;
}

function extractWeapon(text: string): string | null {
  const match = text.match(WEAPON_REGEX);
  if (!match) return null;
  return match[1].toLowerCase();
}

function extractVehicle(text: string): string | null {
  const match = text.match(VEHICLE_REGEX);
  if (!match) return null;
  return `${match[1]} ${match[2]} ${match[3]}`.toLowerCase();
}

function extractDirection(text: string): string | null {
  const match = text.match(DIRECTION_REGEX);
  if (!match) return null;
  return match[1].toLowerCase();
}

// ---------------------------------------------------------------------------
// UTILITY: Check if attributes has any non-null value
// ---------------------------------------------------------------------------

export function hasAttributes(attrs: ExtractedAttributes): boolean {
  return attrs.height !== null
    || attrs.weapon !== null
    || attrs.vehicle !== null
    || attrs.direction !== null;
}
