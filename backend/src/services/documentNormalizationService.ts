// ============================================================================
// Document Normalization Service
// Pre-processes extracted document text to remove artifacts that interfere
// with event extraction (page headers, page numbers, excessive whitespace,
// formatting noise).
// ============================================================================

/**
 * Normalize document text for better NLP event extraction.
 *
 * Steps:
 *   1. Normalize line endings (CRLF → LF)
 *   2. Remove page headers / footers (e.g. "Page 3 of 10")
 *   3. Remove standalone page numbers
 *   4. Collapse excessive blank lines
 *   5. Normalize common timestamp formats
 *   6. Strip common PDF artifacts
 *   7. Trim
 */
export function normalizeDocumentText(text: string): string {
  let normalized = text;

  // 1. Normalize line endings
  normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Remove page headers/footers
  normalized = normalized.replace(/Page\s+\d+\s*(of\s+\d+)?/gi, '');
  normalized = normalized.replace(/-\s*\d+\s*-/g, ''); // — 3 — style page numbers
  normalized = normalized.replace(/^\s*\d+\s*$/gm, ''); // standalone page numbers on own line

  // 3. Remove common report headers that repeat on every page
  normalized = normalized.replace(/OFFICIAL POLICE REPORT/gi, '');
  normalized = normalized.replace(/CONFIDENTIAL\s*[-–—]/gi, '');
  normalized = normalized.replace(/DRAFT\s*[-–—]/gi, '');

  // 4. Collapse excessive blank lines (3+ → 1)
  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  // 5. Normalize timestamp formats for consistent extraction
  //    "18:45 hours" → "18:45"
  //    "6:45 PM"     → "18:45"
  //    "1845 hrs"    → "18:45"
  normalized = normalized.replace(
    /(\d{1,2}:\d{2})\s*hours?/gi,
    '$1',
  );
  normalized = normalized.replace(
    /(\d{1,2}):(\d{2})\s*([AP]M)/gi,
    (_match, h, m, ampm) => {
      let hour = parseInt(h, 10);
      if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      return `${String(hour).padStart(2, '0')}:${m}`;
    },
  );
  normalized = normalized.replace(
    /(\d{4})\s*hrs?/gi,
    (_match, time) => {
      const h = time.slice(0, 2);
      const m = time.slice(2, 4);
      return `${h}:${m}`;
    },
  );

  // 6. Strip common PDF extraction artifacts
  normalized = normalized.replace(/\f/g, '\n'); // form feeds
  normalized = normalized.replace(/\u00a0/g, ' '); // non-breaking spaces
  normalized = normalized.replace(/[^\S\n]+/g, ' '); // collapse horizontal whitespace (preserve newlines)

  // 7. Trim each line and the whole string
  normalized = normalized
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

  return normalized;
}
