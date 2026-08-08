// ============================================================================
// CALCRIM mapping layer.
//
// This module holds no offence definitions. The elements of a crime come from
// the statute, retrieved from the Legislature; what is kept here is only the
// correspondence between a statutory section and the CALCRIM instruction the
// Judicial Council publishes for it.
//
// Where no mapping exists the answer is UNKNOWN. An instruction number guessed
// from a section number would be read out to a jury on this platform's say-so,
// and a wrong one is worse than none.
// ============================================================================

import { normalizeSection } from './officialLawSource.js';
import type { CompiledStatute } from './statutoryCompiler.js';

export interface CalcrimMapping {
  code: string;
  section: string;
  /** The instruction number as the Judicial Council publishes it. */
  instruction: string;
  title: string;
  /** Where this correspondence came from, so it can be checked. */
  authority: string;
}

/**
 * Verified correspondences only. Each entry states the statute it maps and the
 * instruction the Judicial Council publishes for that statute. This table is
 * deliberately small: it grows by verification, not by inference.
 */
const MAPPINGS: CalcrimMapping[] = [
  {
    code: 'PEN',
    section: '187.',
    instruction: 'CALCRIM 520',
    title: 'First or Second Degree Murder With Malice Aforethought',
    authority: 'Judicial Council of California Criminal Jury Instructions, Homicide series',
  },
  {
    code: 'PEN',
    section: '459.',
    instruction: 'CALCRIM 1700',
    title: 'Burglary',
    authority: 'Judicial Council of California Criminal Jury Instructions, Burglary series',
  },
  {
    code: 'PEN',
    section: '211.',
    instruction: 'CALCRIM 1600',
    title: 'Robbery',
    authority: 'Judicial Council of California Criminal Jury Instructions, Robbery series',
  },
  {
    code: 'PEN',
    section: '484.',
    instruction: 'CALCRIM 1800',
    title: 'Theft by Larceny',
    authority: 'Judicial Council of California Criminal Jury Instructions, Theft series',
  },
  {
    code: 'PEN',
    section: '245.',
    instruction: 'CALCRIM 875',
    title: 'Assault With Deadly Weapon or Force Likely to Produce Great Bodily Injury',
    authority: 'Judicial Council of California Criminal Jury Instructions, Assault series',
  },
  {
    code: 'PEN',
    section: '242.',
    instruction: 'CALCRIM 960',
    title: 'Simple Battery',
    authority: 'Judicial Council of California Criminal Jury Instructions, Battery series',
  },
  {
    code: 'PEN',
    section: '240.',
    instruction: 'CALCRIM 915',
    title: 'Simple Assault',
    authority: 'Judicial Council of California Criminal Jury Instructions, Assault series',
  },
];

export interface ElementCorrespondence {
  /** An element as the statute states it. */
  statutoryElement: string;
  /** Where it came from in the section. */
  source: string;
}

export interface CalcrimResult {
  code: string;
  section: string;
  status: 'mapped' | 'unknown';
  instruction: string | null;
  title: string | null;
  authority: string | null;
  /** Elements compiled from the statute, not from a stored definition. */
  elements: ElementCorrespondence[];
  reason: string | null;
}

/**
 * Map a charged section to its instruction and set out the elements the
 * statute itself states. The elements are always compiled from the official
 * text; the mapping only says which instruction those elements belong to.
 */
export function mapToCalcrim(code: string, sectionInput: string, compilation: CompiledStatute | null): CalcrimResult {
  const section = normalizeSection(sectionInput);
  const upper = code.trim().toUpperCase();

  const elements: ElementCorrespondence[] = [];
  if (compilation) {
    for (const c of compilation.conduct) {
      elements.push({ statutoryElement: c, source: 'conduct stated in the section' });
    }
    for (const m of compilation.mentalStates) {
      if (m.mentalState !== 'unknown' && m.basis) {
        elements.push({ statutoryElement: `Mental state: ${m.mentalState}`, source: m.basis });
      }
    }
    for (const s of compilation.subdivisions.slice(0, 6)) {
      if (s.text.length > 40) {
        elements.push({ statutoryElement: `${s.label} ${s.text.slice(0, 260)}`, source: `subdivision ${s.label}` });
      }
    }
  }

  const mapping = MAPPINGS.find((m) => m.code === upper && m.section === section);

  if (!mapping) {
    return {
      code: upper,
      section,
      status: 'unknown',
      instruction: null,
      title: null,
      authority: null,
      elements,
      reason:
        `No verified CALCRIM correspondence is recorded for ${upper} ${section}. The statutory elements above were ` +
        'compiled from the official text and remain usable, but which instruction governs them is UNKNOWN and has ' +
        'not been guessed.',
    };
  }

  return {
    code: upper,
    section,
    status: 'mapped',
    instruction: mapping.instruction,
    title: mapping.title,
    authority: mapping.authority,
    elements,
    reason: null,
  };
}

export function mappingCoverage(): { mappings: number; sections: string[] } {
  return { mappings: MAPPINGS.length, sections: MAPPINGS.map((m) => `${m.code} ${m.section}`) };
}
