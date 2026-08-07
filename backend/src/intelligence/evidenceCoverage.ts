// ============================================================================
// Evidence coverage.
//
// For every charged count, takes the elements out of the statute itself and
// shows what in the record touches each one, what appears to cut against it,
// and what is not there at all.
//
// It does not decide whether an element is proved. That is a jury question and
// this platform has no business answering it. What it does is put the material
// beside the element so counsel can see the shape of the evidence in one place
// — and, more usefully, see where there is none.
//
// An element with nothing behind it is reported as having nothing behind it.
// That is the most valuable cell in the matrix and the easiest one to hide.
// ============================================================================

import prisma from '../lib/prisma.js';
import { getStatute } from '../law/lawService.js';
import { mapToCalcrim } from '../law/calcrimMapping.js';

export interface CoverageCitation {
  evidenceId: string;
  fileName: string;
  excerpt: string;
  matchedOn: string;
}

export interface ElementCoverage {
  element: string;
  /** Where the element came from — always the statute, never a stored list. */
  source: string;
  supporting: CoverageCitation[];
  /** Passages that appear to cut the other way, by their own language. */
  conflicting: CoverageCitation[];
  /** Nothing in the record touches this element. */
  status: 'has_material' | 'no_material';
  citationCount: number;
  /** Why this is the status, in a sentence. */
  basis: string;
}

export interface CountCoverage {
  countNumber: number;
  citation: string;
  code: string;
  section: string;
  officialUrl: string | null;
  legislativeNote: string | null;
  calcrim: { status: string; instruction: string | null; reason: string | null };
  mentalStates: Array<{ mentalState: string; basis: string | null }>;
  elements: ElementCoverage[];
  elementsWithMaterial: number;
  elementsWithout: number;
  /** Set when the statute could not be read, so no elements exist to cover. */
  unavailable: string | null;
}

/** Words that mark a passage as cutting against something. */
const CONTRARY = /\b(?:did not|denied|denies|no evidence|unable to|inconclusive|negative results?|not located|could not|was not|never)\b/i;

/**
 * Terms worth searching the record for, taken from the element's own words.
 * Statutory language is specific, so the nouns and verbs in an element are
 * usually the words a report would use for the same thing.
 */
function searchTermsFor(element: string): string[] {
  const stop = new Set([
    'the', 'and', 'any', 'that', 'with', 'for', 'was', 'were', 'has', 'had', 'this', 'from', 'who', 'not', 'shall',
    'other', 'person', 'defendant', 'every', 'which', 'been', 'their', 'there', 'when', 'upon', 'such', 'into',
    'commit', 'committed', 'code', 'section', 'subdivision', 'means', 'defined', 'described', 'pursuant',
  ]);
  return [...new Set(
    element
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 5 && !stop.has(w)),
  )].slice(0, 10);
}

function quote(text: string, at: number, length: number): string {
  const from = Math.max(0, at - 120);
  const to = Math.min(text.length, at + length + 180);
  return (
    (from > 0 ? '…' : '') +
    text.slice(from, to).replace(/\s+/g, ' ').trim() +
    (to < text.length ? '…' : '')
  );
}

export async function buildEvidenceCoverage(caseId: string, tenantId: string): Promise<{
  caseId: string;
  counts: CountCoverage[];
  documentsExamined: number;
  note: string | null;
  caveat: string;
}> {
  const operative = await prisma.chargingDocument.findFirst({
    where: { caseId, tenantId, status: 'filed' },
    orderBy: { filingSequence: 'desc' },
    include: { charges: { where: { status: 'active' }, orderBy: { countNumber: 'asc' } } },
  });

  const evidence = await prisma.evidence.findMany({
    where: { caseId, tenantId },
    select: { evidenceId: true, fileName: true },
  });
  const chunks = await prisma.evidenceChunk.findMany({
    where: { evidenceId: { in: evidence.map((e) => e.evidenceId) } },
    select: { evidenceId: true, text: true },
  });
  const fileNameOf = new Map(evidence.map((e) => [e.evidenceId, e.fileName]));

  const caveat =
    'This matrix organises the material beside each element. It does not decide whether an element is proved: ' +
    'that is a question for a jury on evidence a court has admitted. An element shown with nothing behind it ' +
    'means nothing in the record uses language matching it, not that the element fails.';

  if (!operative) {
    return {
      caseId,
      counts: [],
      documentsExamined: evidence.length,
      note: 'No charging document has been filed, so there are no counts to cover.',
      caveat,
    };
  }

  const counts: CountCoverage[] = [];

  for (const charge of operative.charges) {
    const statute = await getStatute(charge.code, charge.section).catch(() => null);

    if (!statute?.text || !statute.compilation) {
      counts.push({
        countNumber: charge.countNumber,
        citation: charge.normalizedCitation,
        code: charge.code,
        section: charge.section,
        officialUrl: statute?.officialUrl ?? null,
        legislativeNote: null,
        calcrim: { status: 'unknown', instruction: null, reason: 'The statute could not be read.' },
        mentalStates: [],
        elements: [],
        elementsWithMaterial: 0,
        elementsWithout: 0,
        unavailable:
          statute?.unavailableReason ??
          `${charge.code} ${charge.section} could not be read from the official source, so its elements are not ` +
            'known and no coverage can be shown for this count.',
      });
      continue;
    }

    const compilation = statute.compilation;

    // The elements come from the statute every time, never from a stored list.
    const elementTexts: Array<{ text: string; source: string }> = [
      ...compilation.conduct.map((c) => ({ text: c, source: 'conduct stated in the section' })),
      ...compilation.subdivisions
        .filter((s) => s.text.length > 40)
        .slice(0, 6)
        .map((s) => ({ text: `${s.label} ${s.text}`, source: `subdivision ${s.label}` })),
    ];

    const elements: ElementCoverage[] = [];

    for (const { text: elementText, source } of elementTexts) {
      const terms = searchTermsFor(elementText);
      const supporting: CoverageCitation[] = [];
      const conflicting: CoverageCitation[] = [];
      const seen = new Set<string>();

      for (const chunk of chunks) {
        for (const term of terms) {
          const at = chunk.text.toLowerCase().indexOf(term);
          if (at < 0) continue;
          const key = `${chunk.evidenceId}:${term}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const excerpt = quote(chunk.text, at, term.length);
          const citation: CoverageCitation = {
            evidenceId: chunk.evidenceId,
            fileName: fileNameOf.get(chunk.evidenceId) ?? 'Unknown document',
            excerpt,
            matchedOn: term,
          };

          // A passage carrying contrary language is put on the other side, so
          // counsel sees both without the platform judging which wins.
          if (CONTRARY.test(excerpt)) conflicting.push(citation);
          else supporting.push(citation);

          if (supporting.length + conflicting.length >= 6) break;
        }
        if (supporting.length + conflicting.length >= 6) break;
      }

      const total = supporting.length + conflicting.length;
      elements.push({
        element: elementText.slice(0, 400),
        source,
        supporting,
        conflicting,
        status: total > 0 ? 'has_material' : 'no_material',
        citationCount: total,
        basis:
          total > 0
            ? `${total} passage(s) in the record use language matching this element. Each is quoted so it can be ` +
              'checked against the document.'
            : 'Nothing in the record uses language matching this element. That may mean the material has not been ' +
              'produced, has not been processed, or does not exist — the record does not say which.',
      });
    }

    counts.push({
      countNumber: charge.countNumber,
      citation: charge.normalizedCitation,
      code: charge.code,
      section: charge.section,
      officialUrl: statute.officialUrl,
      legislativeNote: statute.legislativeNote,
      calcrim: (() => {
        const m = mapToCalcrim(charge.code, charge.section, compilation);
        return { status: m.status, instruction: m.instruction, reason: m.reason };
      })(),
      mentalStates: compilation.mentalStates.map((m) => ({ mentalState: m.mentalState, basis: m.basis })),
      elements,
      elementsWithMaterial: elements.filter((e) => e.status === 'has_material').length,
      elementsWithout: elements.filter((e) => e.status === 'no_material').length,
      unavailable: null,
    });
  }

  return {
    caseId,
    counts,
    documentsExamined: evidence.length,
    note: evidence.length === 0 ? 'No evidence has been processed, so every element shows nothing behind it.' : null,
    caveat,
  };
}

// ---------------------------------------------------------------------------
// Explainability
// ---------------------------------------------------------------------------

export interface Explanation {
  subject: string;
  whyDisplayed: string;
  producedBy: string;
  producedAt: Date;
  supportingEvidence: CoverageCitation[];
  conflictingEvidence: CoverageCitation[];
  missingEvidence: string[];
  repository: string;
  authorities: Array<{ citation: string; officialUrl: string | null }>;
  openQuestions: string[];
  /** Anything that cannot be answered is named here rather than left blank. */
  unknown: string[];
}

/**
 * Explain one thing the platform is showing. Everything an explanation asserts
 * is drawn from a record; anything that cannot be answered is listed as
 * unknown rather than omitted, because a silent gap reads as "nothing to say".
 */
export async function explain(params: {
  caseId: string;
  tenantId: string;
  kind: 'theme' | 'count';
  id: string;
}): Promise<Explanation | null> {
  if (params.kind === 'count') {
    const coverage = await buildEvidenceCoverage(params.caseId, params.tenantId);
    const count = coverage.counts.find((c) => String(c.countNumber) === params.id);
    if (!count) return null;

    return {
      subject: `Count ${count.countNumber} — ${count.citation}`,
      whyDisplayed:
        'This count appears because it is charged in the operative charging document filed in this case.',
      producedBy: 'Charging document record, with statutory text retrieved from the California Legislature.',
      producedAt: new Date(),
      supportingEvidence: count.elements.flatMap((e) => e.supporting).slice(0, 10),
      conflictingEvidence: count.elements.flatMap((e) => e.conflicting).slice(0, 10),
      missingEvidence: count.elements
        .filter((e) => e.status === 'no_material')
        .map((e) => `Nothing in the record matches: ${e.element.slice(0, 140)}`),
      repository: 'Official California law (leginfo.legislature.ca.gov) and this case\u2019s evidence',
      authorities: count.officialUrl ? [{ citation: count.citation, officialUrl: count.officialUrl }] : [],
      openQuestions: count.elements
        .filter((e) => e.conflicting.length > 0)
        .map((e) => `Does the contrary material bear on: ${e.element.slice(0, 120)}?`),
      unknown: [
        ...(count.calcrim.status === 'unknown'
          ? [count.calcrim.reason ?? 'No CALCRIM correspondence is recorded for this section.']
          : []),
        ...count.mentalStates
          .filter((m) => m.mentalState === 'unknown')
          .map(() => 'The statute states no mental state in its own words; whether one is implied is a question of construction.'),
      ],
    };
  }

  return null;
}
