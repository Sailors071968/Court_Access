// ============================================================================
// Complaint parsing.
//
// Reads counts out of the text of an uploaded charging document. California
// complaints are formulaic enough that the count number, the code, the section
// and the defendant can usually be found, but "usually" is the whole problem:
// a count read wrongly is a charge the defence prepares against and the People
// never brought.
//
// So nothing here is presented as settled. Every field carries the confidence
// it was extracted with, and the attorney reviews the lot before it becomes a
// filing. Fields the attorney has corrected are never written over.
// ============================================================================

import { CALIFORNIA_CODES } from '../law/officialLawSource.js';

export interface ParsedCharge {
  countNumber: number | null;
  code: string | null;
  section: string | null;
  subdivision: string | null;
  verbatimText: string;
  defendants: string[];
  enhancements: string[];
  attempt: boolean;
  /** Per-field confidence, 0 to 1. A field the parser could not find is null. */
  confidence: Record<string, number>;
}

export interface ParseResult {
  charges: ParsedCharge[];
  /** Mean confidence across everything found, 0 to 1. */
  overallConfidence: number;
  /** What the parser could not do, in words the reviewer can act on. */
  notes: string[];
  courtCaseNumber: string | null;
  court: string | null;
}

/** Code names as they are written in a charging document. */
const CODE_PHRASES: Array<[RegExp, string]> = [
  [/\bPENAL\s+CODE\b/i, 'PEN'],
  [/\bHEALTH\s+(?:AND|&)\s+SAFETY\s+CODE\b/i, 'HSC'],
  [/\bVEHICLE\s+CODE\b/i, 'VEH'],
  [/\bBUSINESS\s+(?:AND|&)\s+PROFESSIONS\s+CODE\b/i, 'BPC'],
  [/\bWELFARE\s+(?:AND|&)\s+INSTITUTIONS\s+CODE\b/i, 'WIC'],
  [/\bFISH\s+(?:AND|&)\s+GAME\s+CODE\b/i, 'FGC'],
  [/\bEVIDENCE\s+CODE\b/i, 'EVID'],
  [/\bGOVERNMENT\s+CODE\b/i, 'GOV'],
  [/\bCORPORATIONS\s+CODE\b/i, 'CORP'],
  [/\bLABOR\s+CODE\b/i, 'LAB'],
  // Abbreviations counsel actually write.
  [/\bPC\b/, 'PEN'],
  [/\bH\s*&\s*S\b|\bHS\b/, 'HSC'],
  [/\bVC\b/, 'VEH'],
];

function codeFrom(text: string): { code: string | null; confidence: number } {
  for (const [pattern, code] of CODE_PHRASES) {
    if (pattern.test(text)) {
      // A spelled-out code name is far more reliable than a two-letter one.
      const spelledOut = pattern.source.includes('CODE');
      return { code, confidence: spelledOut ? 0.95 : 0.6 };
    }
  }
  return { code: null, confidence: 0 };
}

/**
 * Split the document into counts. Complaints number their counts, so the
 * headings are the boundaries.
 */
function splitCounts(text: string): string[] {
  const normalized = text.replace(/\r/g, '');
  const boundaries: number[] = [];
  const pattern = /^\s*COUNT\s+(?:\d+|[IVXLC]+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\b/gim;

  for (const m of normalized.matchAll(pattern)) {
    if (m.index !== undefined) boundaries.push(m.index);
  }
  if (boundaries.length === 0) return [];

  const blocks: string[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    blocks.push(normalized.slice(boundaries[i], boundaries[i + 1] ?? normalized.length).trim());
  }
  return blocks;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function countNumberFrom(block: string): { value: number | null; confidence: number } {
  const m = block.match(/^\s*COUNT\s+(\d+|[A-Za-z]+)/i);
  if (!m) return { value: null, confidence: 0 };
  if (/^\d+$/.test(m[1])) return { value: parseInt(m[1], 10), confidence: 0.98 };
  const word = WORD_NUMBERS[m[1].toLowerCase()];
  if (word) return { value: word, confidence: 0.9 };
  return { value: null, confidence: 0 };
}

/**
 * Read a charging document's counts. Everything returned is a proposal for the
 * attorney to check, never a filing.
 */
export function parseComplaint(text: string): ParseResult {
  const notes: string[] = [];
  const blocks = splitCounts(text);

  if (blocks.length === 0) {
    notes.push(
      'No counts could be identified. The document does not use "COUNT 1", "COUNT TWO" or similar headings ' +
        'that this parser recognises, or the text layer could not be read. The counts will need to be entered by hand.',
    );
    return { charges: [], overallConfidence: 0, notes, courtCaseNumber: null, court: null };
  }

  const charges: ParsedCharge[] = [];

  for (const block of blocks) {
    const confidence: Record<string, number> = {};

    const count = countNumberFrom(block);
    confidence.countNumber = count.confidence;

    const { code, confidence: codeConfidence } = codeFrom(block);
    confidence.code = codeConfidence;

    // "SECTION 245(a)(4)", "section 459", "§ 211".
    const sectionMatch = block.match(/(?:SECTIONS?|§)\s*(\d+(?:\.\d+)*)\s*((?:\([a-zA-Z0-9]+\))*)/i);
    const section = sectionMatch ? sectionMatch[1] : null;
    const subdivision = sectionMatch && sectionMatch[2] ? sectionMatch[2] : null;
    confidence.section = section ? 0.95 : 0;
    confidence.subdivision = subdivision ? 0.9 : 0;

    // "was committed by MARCO RIVERA", "did commit" preceded by a name.
    const defendants: string[] = [];
    for (const m of block.matchAll(/committed by\s+([A-Z][A-Z .'-]{2,60}?)(?:,|\.|\s+who\b|\s+and\s+[A-Z])/g)) {
      const name = m[1].trim().replace(/\s+/g, ' ');
      if (name && !defendants.includes(name)) defendants.push(name);
    }
    confidence.defendants = defendants.length > 0 ? 0.8 : 0;

    // Enhancements are usually pleaded as "within the meaning of PC 12022...".
    const enhancements: string[] = [];
    // Enhancement citations contain periods — "PC 12022.53(b)" — so the clause
    // ends at a period followed by a space and a capital, not at any period.
    for (const m of block.matchAll(/within the meaning of\s+(.{5,200}?)(?=\.\s+[A-Z]|\.\s*$|$)/gis)) {
      const clause = m[1].replace(/\s+/g, ' ').trim();
      if (clause) enhancements.push(clause);
    }

    const attempt = /\bATTEMPTED?\b/i.test(block);

    charges.push({
      countNumber: count.value,
      code,
      section,
      subdivision,
      // The People's words, kept whole. Whatever else is uncertain, this is what
      // the document says.
      verbatimText: block.replace(/\s+/g, ' ').trim(),
      defendants,
      enhancements,
      attempt,
      confidence,
    });

    if (!code) {
      notes.push(`Count ${count.value ?? '?'}: no California code could be identified. Choose one before filing.`);
    } else if (codeConfidence < 0.8) {
      notes.push(
        `Count ${count.value ?? '?'}: the code was read from an abbreviation and may be wrong. ` +
          `Read as ${CALIFORNIA_CODES[code]}.`,
      );
    }
    if (!section) notes.push(`Count ${count.value ?? '?'}: no section number was found.`);
    if (defendants.length === 0) notes.push(`Count ${count.value ?? '?'}: no defendant name was found.`);
  }

  const allScores = charges.flatMap((c) => Object.values(c.confidence));
  const overallConfidence = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

  const caseNumber = text.match(/\bCASE\s+(?:NO\.?|NUMBER)\s*:?\s*([A-Z0-9-]{4,20})/i);
  const court = text.match(/\b(SUPERIOR COURT[^\n]{0,80})/i);

  if (overallConfidence < 0.75) {
    notes.push(
      `Overall confidence is ${(overallConfidence * 100).toFixed(0)}%. Read every count against the document ` +
        'before filing; anything the parser was unsure about is marked.',
    );
  }

  return {
    charges,
    overallConfidence: Math.round(overallConfidence * 100) / 100,
    notes,
    courtCaseNumber: caseNumber ? caseNumber[1] : null,
    court: court ? court[1].replace(/\s+/g, ' ').trim() : null,
  };
}
