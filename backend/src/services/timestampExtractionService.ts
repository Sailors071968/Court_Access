// ============================================================================
// CourtAccess — Timestamp Extraction Service (Deterministic)
// ============================================================================

export interface ExtractedTimestamp {
  value: string | null;
  confidence: number;
  method: "explicit" | "approximate" | "relative" | "none";
}

// ---------------------------------------------------------------------------
// REGEX PATTERNS
// ---------------------------------------------------------------------------

// [22:41:12] or 22:41:12
const TIME_FULL = /\b((?:[01]?\d|2[0-3]):[0-5]\d:[0-5]\d)\b/;

// 10:30 PM / 9:15 AM
const TIME_AMPM = /\b(1[0-2]|0?[1-9]):([0-5]\d)\s?(AM|PM)\b/i;

// "approximately 10:30 PM"
const APPROX = /(approximately|approx\.?)\s+(.{0,30})/i;

// Military time: "22:45 hours", "22:47 hrs"
const TIME_MILITARY = /\b((?:[01]?\d|2[0-3]):[0-5]\d)\s*(?:hours?|hrs?)\b/i;

// bodycam style 00:01:32
const RELATIVE = /\b\d{2}:\d{2}:\d{2}\b/;

// ---------------------------------------------------------------------------
// MAIN EXTRACTION
// ---------------------------------------------------------------------------

export function extractTimestamp(text: string): ExtractedTimestamp {
  if (!text) {
    return { value: null, confidence: 0, method: "none" };
  }

  // ---------------------------------------------------
  // 1. APPROXIMATE TIME (must check before all others)
  // ---------------------------------------------------
  const approxMatch = text.match(APPROX);
  if (approxMatch) {
    const inner = approxMatch[2];

    // Check for military time inside approximate qualifier
    // ("approximately 22:45 hours" → 22:45:00, confidence 0.7)
    const nestedMilitary = inner.match(TIME_MILITARY);
    if (nestedMilitary) {
      return {
        value: `${nestedMilitary[1]}:00`,
        confidence: 0.7,
        method: "approximate",
      };
    }

    // Check for AM/PM inside approximate qualifier (before HH:MM:SS
    // so that "approximately 10:30 PM, bodycam at 22:41:12" finds the
    // AM/PM time, not the unrelated HH:MM:SS later in the captured text)
    const nestedAmpm = inner.match(TIME_AMPM);
    if (nestedAmpm) {
      const [_, hour, minute, period] = nestedAmpm;

      let h = parseInt(hour);
      if (period.toUpperCase() === "PM" && h !== 12) h += 12;
      if (period.toUpperCase() === "AM" && h === 12) h = 0;

      return {
        value: `${String(h).padStart(2, "0")}:${minute}:00`,
        confidence: 0.7,
        method: "approximate",
      };
    }

    // Check for HH:MM:SS inside approximate qualifier
    const nestedFull = inner.match(TIME_FULL);
    if (nestedFull) {
      return {
        value: nestedFull[1],
        confidence: 0.7,
        method: "approximate",
      };
    }
  }

  // ---------------------------------------------------
  // 2. MILITARY TIME (22:45 hours)
  // ---------------------------------------------------
  const militaryMatch = text.match(TIME_MILITARY);
  if (militaryMatch) {
    return {
      value: `${militaryMatch[1]}:00`,
      confidence: 0.95,
      method: "explicit",
    };
  }

  // ---------------------------------------------------
  // 3. FULL TIMESTAMP (HH:MM:SS)
  // ---------------------------------------------------
  const fullMatch = text.match(TIME_FULL);
  if (fullMatch) {
    return {
      value: fullMatch[1],
      confidence: 0.95,
      method: "explicit",
    };
  }

  // ---------------------------------------------------
  // 4. AM/PM FORMAT
  // ---------------------------------------------------
  const ampmMatch = text.match(TIME_AMPM);
  if (ampmMatch) {
    const [_, hour, minute, period] = ampmMatch;

    let h = parseInt(hour);
    if (period.toUpperCase() === "PM" && h !== 12) h += 12;
    if (period.toUpperCase() === "AM" && h === 12) h = 0;

    const formatted = `${String(h).padStart(2, "0")}:${minute}:00`;

    return {
      value: formatted,
      confidence: 0.9,
      method: "explicit",
    };
  }

  // ---------------------------------------------------
  // 5. RELATIVE TIME (BODYCAM)
  // ---------------------------------------------------
  const relMatch = text.match(RELATIVE);
  if (relMatch) {
    return {
      value: relMatch[0],
      confidence: 0.6,
      method: "relative",
    };
  }

  // ---------------------------------------------------
  // 6. NONE FOUND
  // ---------------------------------------------------
  return {
    value: null,
    confidence: 0,
    method: "none",
  };
}
