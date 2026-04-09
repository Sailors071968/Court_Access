// ============================================================================
// CourtAccess — PDF Extraction + Cleaning Service (PRODUCTION GRADE)
// Deterministic • Court-safe • Node-only • No hallucination
// ============================================================================

import pdf from "pdf-parse";

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

export async function extractCleanTextFromPDF(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer, {
    normalizeWhitespace: true,
    disableCombineTextItems: false,
  });

  let text = data.text || "";

  // --------------------------------------------------------------------------
  // HARD VALIDATION — FAIL FAST (CRITICAL FOR COURT INTEGRITY)
  // --------------------------------------------------------------------------
  if (!text || text.trim().length < 50) {
    throw new Error("PDF extraction failed — empty or non-readable content");
  }

  // --------------------------------------------------------------------------
  // Normalize unicode (fix hidden PDF encoding issues)
  // --------------------------------------------------------------------------
  text = text.normalize("NFKC");

  // --------------------------------------------------
  // 1. Normalize line endings
  // --------------------------------------------------
  text = text.replace(/\r\n/g, "\n");

  // --------------------------------------------------
  // 2. Remove excessive whitespace
  // --------------------------------------------------
  text = text.replace(/[ \t]+/g, " ");

  // --------------------------------------------------
  // 3. Fix broken words (hyphen line breaks)
  // --------------------------------------------------
  text = text.replace(/-\n/g, "");

  // --------------------------------------------------
  // 4. Merge broken sentences across lines
  // --------------------------------------------------
  text = text.replace(/([a-z])\n([a-z])/g, "$1 $2");

  // --------------------------------------------------
  // 5. Remove repeating headers / footers (SAFE VERSION)
  // --------------------------------------------------
  text = removeRepeatingLines(text);

  // --------------------------------------------------
  // 6. Remove structured/system noise
  // --------------------------------------------------
  text = removeStructuredNoise(text);

  // --------------------------------------------------
  // 7. Normalize spacing again
  // --------------------------------------------------
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

// ============================================================================
// REMOVE REPEATING HEADERS / FOOTERS (SAFE FOR LEGAL TEXT)
// ============================================================================

function removeRepeatingLines(text: string): string {
  const lines = text.split("\n");

  const frequency = new Map<string, number>();

  for (const line of lines) {
    const normalized = line.trim();
    if (!normalized) continue;

    frequency.set(normalized, (frequency.get(normalized) || 0) + 1);
  }

  // Safer threshold (prevents deleting real narrative)
  const threshold = Math.max(5, Math.floor(lines.length * 0.02));

  const filtered = lines.filter(line => {
    const normalized = line.trim();
    if (!normalized) return true;

    // Keep longer narrative lines even if repeated
    return (
      (frequency.get(normalized) || 0) < threshold ||
      normalized.length > 80
    );
  });

  return filtered.join("\n");
}

// ============================================================================
// REMOVE STRUCTURED NOISE (LOGS, TABLES, JUNK)
// ============================================================================

function removeStructuredNoise(text: string): string {
  const lines = text.split("\n");

  return lines
    .filter(line => {
      const l = line.trim();

      if (!l) return true;

      // ❌ Remove CLI / logs
      if (/^\[.*\]$/.test(l)) return false;
      if (/^(INFO|DEBUG|ERROR|WARN)/.test(l)) return false;

      // ❌ Remove ASCII tables
      if (/^[\|\+\-_=]{5,}$/.test(l)) return false;

      // ❌ Remove mostly numeric lines
      if (/^[\d\s\-\/:]+$/.test(l)) return false;

      // ❌ Remove hex / garbage
      if (/^[A-F0-9]{8,}$/i.test(l)) return false;

      // ❌ Remove page numbers
      if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(l)) return false;

      return true;
    })
    .join("\n");
}

// ============================================================================
// SEGMENTATION (NARRATIVE UNITS — LEGAL SAFE)
// ============================================================================

export function segmentIntoNarrativeUnits(text: string): string[] {
  const rawSegments = text
    // Respect paragraphs + safer sentence boundaries
    .split(/\n{2,}|(?<=[\.!?])\s+(?=[A-Z])/)
    .map(s => s.trim())
    .filter(Boolean);

  const segments: string[] = [];

  for (const seg of rawSegments) {
    // Merge short fragments into previous context
    if (seg.length < 40 && segments.length > 0) {
      segments[segments.length - 1] += " " + seg;
    } else {
      segments.push(seg);
    }
  }

  return segments;
}

// ============================================================================
// FINAL LINE VALIDATION (LAST FILTER)
// ============================================================================

export function isValidNarrativeLine(line: string): boolean {
  if (!line || line.length < 20) return false;

  // Must contain letters
  if (!/[a-zA-Z]/.test(line)) return false;

  // Reject system junk
  if (/redis|pm2|localhost|ec2-user/i.test(line)) return false;

  // Reject code-like lines
  if (/[{}<>]/.test(line)) return false;

  return true;
}
