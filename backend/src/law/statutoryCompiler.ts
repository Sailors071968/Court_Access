// ============================================================================
// Dynamic Statutory Compiler.
//
// Turns the official text of a section into structure: what kind of provision
// it is, what it forbids, what mental state it requires, what it punishes,
// what it defines, and what other law it depends on.
//
// Everything here is read out of the statute's own words. Where the words do
// not settle a question the answer is UNKNOWN, with the reason recorded.
// A mental state guessed at is a mental state argued in court on this
// platform's authority, and the platform does not have that authority.
// ============================================================================

import { resolveCodeFromPhrase, normalizeSection } from './officialLawSource.js';

export const COMPILER_VERSION = '1.0.0';

export type ProvisionKind =
  | 'offense'
  | 'enhancement'
  | 'sentencing'
  | 'procedure'
  | 'definition'
  | 'exemption'
  | 'evidence_rule'
  | 'discovery'
  | 'administrative'
  | 'unknown';

export type MentalState =
  | 'intent'
  | 'knowledge'
  | 'willfulness'
  | 'malice'
  | 'recklessness'
  | 'negligence'
  | 'strict_liability'
  | 'unknown';

export interface Subdivision {
  label: string;
  text: string;
}

export interface CrossReference {
  /** The phrase in the statute that made the reference. */
  phrase: string;
  code: string;
  section: string;
  /** definition | reference — a definitional link is followed first. */
  kind: 'definition' | 'reference';
}

export interface DefinedTerm {
  term: string;
  definition: string;
}

export interface MentalStateFinding {
  mentalState: MentalState;
  /** The words in the statute that establish it. */
  basis: string | null;
  confidence: number;
}

export interface CompiledStatute {
  compilerVersion: string;
  kind: ProvisionKind;
  kindBasis: string;
  subdivisions: Subdivision[];
  mentalStates: MentalStateFinding[];
  crossReferences: CrossReference[];
  definedTerms: DefinedTerm[];
  punishments: string[];
  exceptions: string[];
  affirmativeDefenses: string[];
  enhancements: string[];
  /** Sentences that state prohibited conduct. */
  conduct: string[];
  /** Everything the compiler could not settle, and why. */
  unknowns: Array<{ field: string; reason: string }>;
}

// ---------------------------------------------------------------------------
// Subdivisions
// ---------------------------------------------------------------------------

function extractSubdivisions(text: string): Subdivision[] {
  const out: Subdivision[] = [];
  // Subdivisions are published as (a), (b), (1), (2), (A), (B) at line start.
  const lines = text.split('\n');
  let current: Subdivision | null = null;

  for (const line of lines) {
    const m = line.match(/^\(([a-zA-Z0-9]{1,4})\)\s*(.*)$/);
    if (m) {
      if (current) out.push(current);
      current = { label: `(${m[1]})`, text: m[2].trim() };
    } else if (current) {
      current.text = `${current.text} ${line.trim()}`.trim();
    }
  }
  if (current) out.push(current);
  return out;
}

// ---------------------------------------------------------------------------
// Cross references
// ---------------------------------------------------------------------------

function extractCrossReferences(text: string, defaultCode: string): CrossReference[] {
  const found = new Map<string, CrossReference>();

  // "Section 21 of the Harbors and Navigation Code",
  // "subdivision (d) of Section 18075.55 of the Health and Safety Code",
  // "Sections 211 and 212", "Section 459".
  const pattern =
    /(?:pursuant to |as defined in |defined by |described in |specified in |under |violation of )?\bSections?\s+([\d]+(?:\.\d+)*(?:\s*(?:,|and|or)\s*[\d]+(?:\.\d+)*)*)/g;

  for (const m of text.matchAll(pattern)) {
    const numbers = m[1].split(/\s*(?:,|and|or)\s*/).filter(Boolean);

    // The code a reference belongs to is often several clauses away — the
    // Legislature writes "Article 2 (commencing with Section 123400) of
    // Chapter 2 of Part 2 of Division 106 of the Health and Safety Code".
    // Read forward to the next section mention and take the code named there.
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 220);
    const untilNextSection = after.split(/\bSections?\s+\d/)[0];
    const codeNamed = untilNextSection.match(/of\s+the\s+([A-Z][A-Za-z' ]*?(?:\s+and\s+[A-Z][A-Za-z' ]*?)?)\s+Code\b/);
    const codePhrase = codeNamed ? codeNamed[0] : '';
    const code = codePhrase ? resolveCodeFromPhrase(codePhrase, defaultCode) : defaultCode;
    const lead = (m[0].match(/^(?:pursuant to|as defined in|defined by|described in|specified in|under|violation of)/i) ?? [''])[0];
    const kind: CrossReference['kind'] = /defined/i.test(lead) ? 'definition' : 'reference';

    for (const n of numbers) {
      const section = normalizeSection(n);
      const key = `${code} ${section}`;
      // A definitional link is the more useful classification; keep it.
      const existing = found.get(key);
      if (!existing || (existing.kind === 'reference' && kind === 'definition')) {
        found.set(key, { phrase: m[0].replace(/\s+/g, ' ').trim().slice(0, 160), code, section, kind });
      }
    }
  }

  return [...found.values()];
}

// ---------------------------------------------------------------------------
// Defined terms
// ---------------------------------------------------------------------------

function extractDefinedTerms(text: string): DefinedTerm[] {
  const out: DefinedTerm[] = [];
  // Statutes define with curly or straight quotes followed by "means".
  const pattern = /[“"']([^”"']{2,80})[”"']\s+(?:means|shall mean|is defined as|includes)\s+([^.]{5,400})\./g;
  for (const m of text.matchAll(pattern)) {
    out.push({ term: m[1].trim(), definition: m[2].replace(/\s+/g, ' ').trim() });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mental state
//
// Read from the operative words the Legislature used. Several may appear in
// one section, because different subdivisions can carry different states.
// ---------------------------------------------------------------------------

/**
 * A readable quotation of the statute around a matched phrase, snapped to
 * word boundaries so a citation never begins in the middle of a number.
 */
function quoteAround(text: string, index: number, length: number): string {
  const flat = text.replace(/\s+/g, ' ');
  const flatIndex = flat.indexOf(text.slice(index, index + length).replace(/\s+/g, ' '));
  const at = flatIndex >= 0 ? flatIndex : index;

  const SENTENCE_END = /[.;:](?=\s+[A-Z(])/g;
  let from = 0;
  let to = flat.length;
  for (const m of flat.matchAll(SENTENCE_END)) {
    if (m.index! < at) from = m.index! + 1;
    else {
      to = m.index! + 1;
      break;
    }
  }

  let quote = flat.slice(from, to).trim();

  // Very long provisions are one sentence; keep the operative words in view.
  if (quote.length > 400) {
    const local = at - from;
    const start = Math.max(0, local - 160);
    const end = Math.min(quote.length, local + length + 200);
    const head = start > 0 ? '…' : '';
    const tail = end < quote.length ? '…' : '';
    quote = `${head}${quote.slice(start, end).replace(/^\S*\s/, '').replace(/\s\S*$/, '')}${tail}`;
  }

  return quote;
}

const MENTAL_STATE_RULES: Array<{ state: MentalState; pattern: RegExp; confidence: number }> = [
  { state: 'intent', pattern: /\bwith (?:the )?intent to\b|\bintentionally\b|\bfor the purpose of\b/i, confidence: 0.9 },
  { state: 'knowledge', pattern: /\bknowingly\b|\bwith knowledge\b|\bknows or reasonably should know\b/i, confidence: 0.9 },
  { state: 'willfulness', pattern: /\bwillfully\b|\bwilful\b/i, confidence: 0.9 },
  { state: 'malice', pattern: /\bmalice(?: aforethought)?\b|\bmaliciously\b/i, confidence: 0.9 },
  { state: 'recklessness', pattern: /\brecklessly\b|\breckless disregard\b/i, confidence: 0.9 },
  { state: 'negligence', pattern: /\bnegligen(?:ce|tly)\b|\bcriminal negligence\b/i, confidence: 0.85 },
];

function extractMentalStates(text: string, kind: ProvisionKind): MentalStateFinding[] {
  // A section that creates no liability has no mental state to require. Penal
  // Code section 20 discusses intent and criminal negligence at length without
  // requiring either of anybody, and reading a mens rea out of it would be a
  // fabrication of exactly the kind that ends up in a brief.
  if (kind !== 'offense' && kind !== 'enhancement') {
    return [{ mentalState: 'unknown', basis: null, confidence: 0 }];
  }

  const out: MentalStateFinding[] = [];

  for (const rule of MENTAL_STATE_RULES) {
    const m = text.match(rule.pattern);
    if (!m) continue;
    // Quote the statute's own words, so the finding cites the Legislature
    // rather than this tool. Section numbers contain periods, so a sentence
    // boundary is a period followed by space and a capital — not any period.
    out.push({
      mentalState: rule.state,
      basis: quoteAround(text, m.index ?? text.indexOf(m[0]), m[0].length),
      confidence: rule.confidence,
    });
  }

  if (out.length === 0) {
    // Silence about mental state is not the same as strict liability: in
    // California, Penal Code section 20 requires a union of act and intent
    // unless the Legislature says otherwise, and deciding which applies is a
    // question of construction this compiler is not entitled to settle.
    return [
      {
        mentalState: 'unknown',
        basis: null,
        confidence: 0,
      },
    ];
  }

  return out;
}

// ---------------------------------------------------------------------------
// Punishment, exceptions, defenses, enhancements
// ---------------------------------------------------------------------------

function sentencesMatching(text: string, pattern: RegExp, limit = 8): string[] {
  const sentences = text.split(/(?<=\.)\s+/);
  const out: string[] = [];
  for (const s of sentences) {
    if (pattern.test(s)) {
      const clean = s.replace(/\s+/g, ' ').trim();
      if (clean.length > 10) out.push(clean.slice(0, 500));
    }
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// What kind of provision is this?
// ---------------------------------------------------------------------------

function classifyProvision(
  text: string,
  hierarchy: Array<{ level: string; heading: string }> = [],
): { kind: ProvisionKind; basis: string } {
  const tests: Array<{ kind: ProvisionKind; pattern: RegExp; label: string }> = [
    // Some offences announce liability; others define the crime itself, as
    // section 187 does with "Murder is the unlawful killing...".
    { kind: 'offense', pattern: /\bis guilty of\b|\bis punishable by\b|\bshall be punished\b|\bis a (?:felony|misdemeanor)\b|\bis the unlawful\b|\bis an? unlawful\b|\bcommits? (?:the crime|an offense)\b/i, label: 'creates criminal liability' },
    { kind: 'enhancement', pattern: /\bin addition (?:and consecutive )?to (?:the )?(?:punishment|sentence|term)\b|\bshall (?:receive|be imposed) an additional (?:term|punishment)\b|\benhancement\b/i, label: 'adds to a punishment imposed elsewhere' },
    { kind: 'sentencing', pattern: /\bthe court shall (?:impose|sentence|order)\b|\bterm of imprisonment shall be\b|\btriad\b/i, label: 'directs how a sentence is imposed' },
    { kind: 'definition', pattern: /\bas used in this (?:chapter|title|part|code|article|section)[^.]{0,80}means\b|\bthe following definitions\b/i, label: 'defines terms used elsewhere' },
    { kind: 'evidence_rule', pattern: /\bis (?:admissible|inadmissible)\b|\bevidence of\b.{0,60}\bshall not be admitted\b|\bprivilege\b/i, label: 'governs the admission of evidence' },
    { kind: 'discovery', pattern: /\bshall (?:disclose|be disclosed|provide discovery)\b|\bdiscovery\b.{0,40}\bshall\b/i, label: 'governs disclosure between the parties' },
    { kind: 'exemption', pattern: /\bdoes not apply to\b|\bshall not apply\b|\bis exempt\b/i, label: 'removes conduct from a prohibition' },
    { kind: 'procedure', pattern: /\bthe (?:court|magistrate|district attorney) (?:shall|may)\b|\bpetition\b|\bmotion\b|\bhearing\b/i, label: 'sets out a procedure' },
    { kind: 'administrative', pattern: /\bthe department shall\b|\bthe board shall\b|\bregulations\b/i, label: 'directs an agency' },
  ];

  // Where the section sits in the code is evidence about what it does. A
  // provision under "OF CRIMES AGAINST THE PERSON" that defines conduct is an
  // offence even if a later subdivision carves out an exemption, so the
  // structural signal outranks a stray "shall not apply".
  const underCrimes = hierarchy.some((h) => /\bOF CRIMES\b|\bCRIMES AND PUNISHMENT/i.test(h.heading));
  const offenseTest = tests[0];
  if (underCrimes) {
    const m = text.match(offenseTest.pattern);
    if (m) {
      return {
        kind: 'offense',
        basis:
          `${offenseTest.label} — "${m[0].replace(/\s+/g, ' ').trim().slice(0, 90)}", in a part of the code ` +
          'headed as defining crimes',
      };
    }
  }

  for (const t of tests) {
    const m = text.match(t.pattern);
    if (m) return { kind: t.kind, basis: `${t.label} — "${m[0].replace(/\s+/g, ' ').trim().slice(0, 120)}"` };
  }

  return {
    kind: 'unknown',
    basis: 'The section does not use language this compiler recognises as creating an offence, an enhancement, a definition, a procedure or an evidentiary rule.',
  };
}

// ---------------------------------------------------------------------------

export function compileStatute(
  text: string,
  code: string,
  hierarchy: Array<{ level: string; heading: string }> = [],
): CompiledStatute {
  const { kind, basis } = classifyProvision(text, hierarchy);
  const subdivisions = extractSubdivisions(text);
  const crossReferences = extractCrossReferences(text, code);
  const definedTerms = extractDefinedTerms(text);
  const mentalStates = extractMentalStates(text, kind);

  const punishments = sentencesMatching(
    text,
    /\bpunish(?:able|ed)\b|\bimprisonment\b|\bstate prison\b|\bcounty jail\b|\bfine (?:of |not exceeding )\b/i,
  );
  const exceptions = sentencesMatching(text, /\bexcept\b|\bunless\b|\bdoes not apply\b|\bshall not apply\b/i);
  const affirmativeDefenses = sentencesMatching(
    text,
    /\bit is a defense\b|\baffirmative defense\b|\bshall be a defense\b|\bit shall not be a violation\b/i,
  );
  const enhancements = sentencesMatching(
    text,
    /\bin addition to\b.{0,60}\b(?:punishment|sentence|term)\b|\badditional (?:term|punishment)\b/i,
  );
  const conduct = sentencesMatching(text, /\bevery person who\b|\bany person who\b|\bwho(?:ever)?\b.{0,80}\bshall\b/i, 6);

  const unknowns: CompiledStatute['unknowns'] = [];
  if (kind === 'unknown') {
    unknowns.push({ field: 'kind', reason: basis });
  }
  if (mentalStates.length === 1 && mentalStates[0].mentalState === 'unknown') {
    unknowns.push({
      field: 'mentalState',
      reason:
        kind === 'offense' || kind === 'enhancement'
          ? 'The section states no mental state in its own words. Whether one is implied is a question of statutory ' +
            'construction — Penal Code section 20 requires a union of act and intent unless the Legislature dispensed ' +
            'with it — and that is not settled from the text alone.'
          : `This section is a ${kind.replace('_', ' ')} rather than a provision creating liability, so no mental ` +
            'state attaches to it.',
    });
  }
  if (punishments.length === 0 && kind === 'offense') {
    unknowns.push({
      field: 'punishment',
      reason: 'The section creates liability but states no punishment in its own text; it is set elsewhere in the code.',
    });
  }

  return {
    compilerVersion: COMPILER_VERSION,
    kind,
    kindBasis: basis,
    subdivisions,
    mentalStates,
    crossReferences,
    definedTerms,
    punishments,
    exceptions,
    affirmativeDefenses,
    enhancements,
    conduct,
    unknowns,
  };
}
