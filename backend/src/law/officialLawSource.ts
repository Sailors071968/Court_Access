// ============================================================================
// Official California Law Discovery Engine.
//
// Retrieves statutory text from leginfo.legislature.ca.gov, the Legislature's
// own publication of the codes, and turns the page into a structured record
// that carries its own provenance: the URL it came from, when it was fetched,
// the legislative note published with it, and a fingerprint of the text.
//
// The fingerprint is the whole mechanism. Two retrievals with the same
// fingerprint are the same law; a different one means the section was amended
// between them. That is how synchronisation detects change and how a case
// analysed months ago can be reproduced against the law as it then stood.
//
// Nothing is invented. A section that does not exist, has been repealed, or
// could not be fetched is returned as such with the reason, because a
// fabricated statute would be cited in a filing.
// ============================================================================

import { createHash } from 'node:crypto';

export const EXTRACTION_VERSION = '1.0.0';

const BASE = 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml';

/** Codes the Legislature publishes, by the abbreviation leginfo uses. */
export const CALIFORNIA_CODES: Record<string, string> = {
  BPC: 'Business and Professions Code',
  CIV: 'Civil Code',
  CCP: 'Code of Civil Procedure',
  COM: 'Commercial Code',
  CORP: 'Corporations Code',
  EDC: 'Education Code',
  ELEC: 'Elections Code',
  EVID: 'Evidence Code',
  FAM: 'Family Code',
  FIN: 'Financial Code',
  FGC: 'Fish and Game Code',
  FAC: 'Food and Agricultural Code',
  GOV: 'Government Code',
  HNC: 'Harbors and Navigation Code',
  HSC: 'Health and Safety Code',
  INS: 'Insurance Code',
  LAB: 'Labor Code',
  MVC: 'Military and Veterans Code',
  PEN: 'Penal Code',
  PROB: 'Probate Code',
  PCC: 'Public Contract Code',
  PRC: 'Public Resources Code',
  PUC: 'Public Utilities Code',
  RTC: 'Revenue and Taxation Code',
  SHC: 'Streets and Highways Code',
  UIC: 'Unemployment Insurance Code',
  VEH: 'Vehicle Code',
  WAT: 'Water Code',
  WIC: 'Welfare and Institutions Code',
};

/** Names as they appear inside statutory text, mapped to the code. */
const CODE_NAME_TO_ABBREVIATION: Array<[RegExp, string]> = Object.entries(CALIFORNIA_CODES).map(
  ([abbr, name]) => [new RegExp(`\\b${name.replace(/ /g, '\\s+')}\\b`, 'i'), abbr],
);

export interface StatuteHierarchy {
  level: string;
  heading: string;
}

export interface RetrievedStatute {
  code: string;
  codeName: string;
  section: string;
  officialUrl: string;
  status: 'retrieved' | 'not_found' | 'repealed' | 'unavailable';
  httpStatus: number | null;
  unavailableReason: string | null;
  text: string | null;
  fingerprint: string | null;
  legislativeNote: string | null;
  hierarchy: StatuteHierarchy[];
  retrievedAt: Date;
  extractionVersion: string;
}

/** leginfo section numbers carry a trailing period. */
export function normalizeSection(section: string): string {
  const trimmed = section.trim().replace(/\s+/g, '');
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}

export function officialUrlFor(code: string, section: string): string {
  return `${BASE}?lawCode=${encodeURIComponent(code.toUpperCase())}&sectionNum=${encodeURIComponent(normalizeSection(section))}`;
}

/**
 * The fingerprint identifies the law, not the page. Whitespace and the
 * session-specific parts of the response are normalised away so an
 * insignificant rendering difference is not mistaken for an amendment.
 */
export function fingerprintOf(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return createHash('sha256').update(normalized).digest('hex');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, '\u2019')
    .replace(/&#8220;|&ldquo;/g, '\u201c')
    .replace(/&#8221;|&rdquo;/g, '\u201d')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

/**
 * Pull the statute out of the page. leginfo renders the section inside a
 * container whose id is stable, followed by the JSF view state; everything
 * after that belongs to the framework rather than to the law.
 */
export function parseStatutePage(html: string, section: string): {
  text: string | null;
  hierarchy: StatuteHierarchy[];
  legislativeNote: string | null;
} {
  const start = html.indexOf('codeLawSectionNoHead');
  if (start < 0) return { text: null, hierarchy: [], legislativeNote: null };

  // The published content ends where the framework's own markup begins. Any
  // of these can come first depending on the page, so take the earliest.
  const boundaries = ['ViewState', 'javax.faces', '<input type="hidden"']
    .map((marker) => html.indexOf(marker, start))
    .filter((i) => i > start);
  const end = boundaries.length > 0 ? Math.min(...boundaries) : start + 200000;
  const region = html.slice(start, end);

  // Structural headings are published in h4/h5/h6 elements, in order.
  const hierarchy: StatuteHierarchy[] = [];
  for (const m of region.matchAll(/<h([456])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const heading = stripTags(m[2]).replace(/\s+/g, ' ').trim();
    if (!heading) continue;
    const level =
      /^PART\b/i.test(heading) ? 'part'
      : /^TITLE\b/i.test(heading) ? 'title'
      : /^CHAPTER\b/i.test(heading) ? 'chapter'
      : /^ARTICLE\b/i.test(heading) ? 'article'
      : /^DIVISION\b/i.test(heading) ? 'division'
      : 'heading';
    hierarchy.push({ level, heading });
  }

  const plain = stripTags(region)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // The statutory text begins at the section number and runs to the end of
  // the published content.
  const normalizedSection = normalizeSection(section);
  const sectionIndex = plain.findIndex((l) => l === normalizedSection || l.startsWith(`${normalizedSection} `));
  if (sectionIndex < 0) return { text: null, hierarchy, legislativeNote: null };

  const body = plain.slice(sectionIndex);

  // The legislative note is published in parentheses at the foot of the
  // section and records the act that last touched it.
  let legislativeNote: string | null = null;
  for (let i = body.length - 1; i >= 0; i--) {
    const m = body[i].match(/\((?:Amended|Added|Repealed|Enacted|Renumbered)[\s\S]{0,300}/i);
    if (m) {
      legislativeNote = m[0].replace(/\s+/g, ' ').trim();
      break;
    }
  }

  const text = body.join('\n').trim();
  return { text: text.length > 0 ? text : null, hierarchy, legislativeNote };
}

/** Politeness: leginfo is a public service, so requests are spaced out. */
let lastRequestAt = 0;
const MIN_REQUEST_GAP_MS = Number(process.env.LEGINFO_MIN_GAP_MS ?? 400);

async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

/**
 * Retrieve one section from the Legislature's own publication.
 *
 * Never throws for a missing or unreachable statute: the caller gets a record
 * saying so, with the reason, because "we could not read the law" and "the law
 * says nothing" are different answers and must not be conflated.
 */
export async function retrieveStatute(
  codeInput: string,
  sectionInput: string,
  options: { timeoutMs?: number } = {},
): Promise<RetrievedStatute> {
  const code = codeInput.trim().toUpperCase();
  const section = normalizeSection(sectionInput);
  const officialUrl = officialUrlFor(code, section);
  const retrievedAt = new Date();

  const base: RetrievedStatute = {
    code,
    codeName: CALIFORNIA_CODES[code] ?? code,
    section,
    officialUrl,
    status: 'unavailable',
    httpStatus: null,
    unavailableReason: null,
    text: null,
    fingerprint: null,
    legislativeNote: null,
    hierarchy: [],
    retrievedAt,
    extractionVersion: EXTRACTION_VERSION,
  };

  if (!CALIFORNIA_CODES[code]) {
    return {
      ...base,
      status: 'not_found',
      unavailableReason:
        `"${codeInput}" is not a California code published on leginfo. Recognised codes are ` +
        `${Object.keys(CALIFORNIA_CODES).join(', ')}.`,
    };
  }

  await throttle();

  let response: Response;
  try {
    response = await fetch(officialUrl, {
      headers: {
        // Identify the client honestly to the service being used.
        'User-Agent': 'CourtAccess/1.0 (California criminal litigation intelligence; statutory retrieval)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? 30000),
    });
  } catch (err) {
    return {
      ...base,
      unavailableReason:
        `The official source could not be reached for ${code} ${section}: ${(err as Error).message}. ` +
        'No statutory text is available, so any question about this section is UNKNOWN until it can be retrieved.',
    };
  }

  if (!response.ok) {
    return {
      ...base,
      httpStatus: response.status,
      unavailableReason:
        `The official source returned HTTP ${response.status} for ${code} ${section}. ` +
        'The section could not be read and nothing has been inferred about it.',
    };
  }

  const html = await response.text();
  const { text, hierarchy, legislativeNote } = parseStatutePage(html, section);

  if (!text) {
    return {
      ...base,
      httpStatus: response.status,
      status: 'not_found',
      hierarchy,
      unavailableReason:
        `The official source has no section ${section} in the ${base.codeName}. It may never have existed, ` +
        'or it may have been renumbered. Check the citation against the code.',
    };
  }

  // The Legislature marks a removed section in the text itself.
  const repealed = /\[\s*Repealed\b/i.test(text) || /^\s*\d[\d.]*\.\s*\[?Repealed/i.test(text) ||
    /\(Repealed\b/i.test(legislativeNote ?? '');

  return {
    ...base,
    httpStatus: response.status,
    status: repealed ? 'repealed' : 'retrieved',
    text,
    fingerprint: fingerprintOf(text),
    legislativeNote,
    hierarchy,
    unavailableReason: repealed
      ? `${code} ${section} has been repealed. It cannot support a charge, and any analysis relying on it ` +
        'must use the law in force at the time of the alleged conduct.'
      : null,
  };
}

/**
 * Find the code a statutory cross-reference points at. Text says "Section 21
 * of the Harbors and Navigation Code"; where no code is named, the reference
 * is to the code the reader is already in.
 */
export function resolveCodeFromPhrase(phrase: string, defaultCode: string): string {
  for (const [pattern, abbreviation] of CODE_NAME_TO_ABBREVIATION) {
    if (pattern.test(phrase)) return abbreviation;
  }
  return defaultCode;
}
