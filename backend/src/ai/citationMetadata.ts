// ============================================================================
// Program 135 — Evidence Citation Metadata Extraction
// Deterministically extracts navigable citation locators from evidence text by
// type: police reports (page/paragraph/sentence), preliminary & trial
// transcripts (page/line), body/dash-cam & audio (timestamps), photographs
// (bounding regions — only when provided), and exhibits (exhibit no./page/
// image location). Locators that the source does not establish are reported as
// UNKNOWN and are NEVER fabricated. Every returned locator carries an `anchor`
// that the UI can use to navigate directly to the supporting material.
// ============================================================================

export type LocatorProvenance = 'repository' | 'unknown';

export interface CitationLocator {
  kind: 'page_paragraph' | 'page_line' | 'timestamp' | 'bounding_region' | 'exhibit';
  label: string;
  anchor: string; // navigable anchor, e.g. "p12#para3", "t=00:04:21", "ex4:p2"
  page?: number;
  paragraph?: number;
  sentence?: number;
  line?: number;
  timestamp?: string;
  region?: { x: number; y: number; w: number; h: number };
  exhibit?: string;
  provenance: LocatorProvenance;
  snippet?: string;
}

export interface MetadataExtractionResult {
  evidenceType: string;
  locators: CitationLocator[];
  navigable: number; // count with provenance 'repository'
  unknown: number;
}

const TS_RE = /(?:^|\s)(\d{1,2}:\d{2}:\d{2}(?:\.\d{1,3})?)/g;
const PAGE_RE = /\bpage\s+(\d{1,4})\b/gi;
const LINE_RE = /\bline\s+(\d{1,4})\b/gi;
const EXHIBIT_RE = /\bexhibit\s+([A-Z0-9]{1,4})\b/gi;

function normType(t: string): string {
  return t.toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Extract locators from raw evidence text. `hints` may carry structured data
 * the caller already has (e.g. OCR bounding boxes, known page count); anything
 * not established stays UNKNOWN.
 */
export function extractCitationLocators(
  evidenceType: string,
  text: string,
  hints: { regions?: Array<{ x: number; y: number; w: number; h: number; label?: string }>; pageCount?: number } = {},
): MetadataExtractionResult {
  const type = normType(evidenceType);
  const locators: CitationLocator[] = [];
  const src = text ?? '';

  const pushTimestamps = () => {
    const seen = new Set<string>();
    for (const m of src.matchAll(TS_RE)) {
      const ts = m[1];
      if (seen.has(ts)) continue;
      seen.add(ts);
      locators.push({ kind: 'timestamp', label: `Timestamp ${ts}`, anchor: `t=${ts}`, timestamp: ts, provenance: 'repository' });
    }
    if (seen.size === 0) locators.push({ kind: 'timestamp', label: 'Timestamp UNKNOWN', anchor: '', provenance: 'unknown' });
  };

  const pushPageLine = () => {
    const pages = [...src.matchAll(PAGE_RE)].map((m) => parseInt(m[1], 10));
    const lines = [...src.matchAll(LINE_RE)].map((m) => parseInt(m[1], 10));
    if (pages.length === 0 && lines.length === 0) {
      locators.push({ kind: 'page_line', label: 'Page/Line UNKNOWN', anchor: '', provenance: 'unknown' });
      return;
    }
    const maxLen = Math.max(pages.length, lines.length);
    for (let i = 0; i < maxLen; i += 1) {
      const page = pages[i]; const line = lines[i];
      locators.push({
        kind: 'page_line',
        label: `Page ${page ?? '?'}${line !== undefined ? `, Line ${line}` : ''}`,
        anchor: `p${page ?? 0}${line !== undefined ? `#l${line}` : ''}`,
        page, line,
        provenance: page !== undefined || line !== undefined ? 'repository' : 'unknown',
      });
    }
  };

  const pushPageParagraph = () => {
    // Split into paragraphs; associate each detected "Page N" with paragraph index.
    const paragraphs = src.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length === 0) {
      locators.push({ kind: 'page_paragraph', label: 'Page/Paragraph UNKNOWN', anchor: '', provenance: 'unknown' });
      return;
    }
    let currentPage = 1;
    paragraphs.forEach((para, idx) => {
      const pm = [...para.matchAll(PAGE_RE)];
      if (pm.length) currentPage = parseInt(pm[pm.length - 1][1], 10);
      const sentences = para.split(/(?<=[.!?])\s+/).filter(Boolean);
      locators.push({
        kind: 'page_paragraph',
        label: `Page ${currentPage}, Paragraph ${idx + 1}`,
        anchor: `p${currentPage}#para${idx + 1}`,
        page: currentPage,
        paragraph: idx + 1,
        sentence: sentences.length ? 1 : undefined,
        provenance: 'repository',
        snippet: para.slice(0, 140),
      });
    });
  };

  const pushExhibits = () => {
    const ex = [...src.matchAll(EXHIBIT_RE)];
    if (ex.length === 0) {
      locators.push({ kind: 'exhibit', label: 'Exhibit UNKNOWN', anchor: '', provenance: 'unknown' });
      return;
    }
    const pages = [...src.matchAll(PAGE_RE)].map((m) => parseInt(m[1], 10));
    ex.forEach((m, i) => {
      const exhibit = m[1];
      const page = pages[i];
      locators.push({
        kind: 'exhibit',
        label: `Exhibit ${exhibit}${page !== undefined ? `, Page ${page}` : ''}`,
        anchor: `ex${exhibit}${page !== undefined ? `:p${page}` : ''}`,
        exhibit, page,
        provenance: 'repository',
      });
    });
  };

  const pushRegions = () => {
    if (hints.regions && hints.regions.length) {
      hints.regions.forEach((r, i) => locators.push({
        kind: 'bounding_region',
        label: r.label ?? `Region ${i + 1}`,
        anchor: `bbox=${r.x},${r.y},${r.w},${r.h}`,
        region: { x: r.x, y: r.y, w: r.w, h: r.h },
        provenance: 'repository',
      }));
    } else {
      locators.push({ kind: 'bounding_region', label: 'Bounding region UNKNOWN', anchor: '', provenance: 'unknown' });
    }
  };

  if (/police|report|incident|arrest/.test(type)) pushPageParagraph();
  else if (/transcript|prelim|preliminary|trial|hearing|deposition/.test(type)) pushPageLine();
  else if (/bodycam|body_cam|dashcam|dash_cam|body_worn|audio|video|call|recording|911/.test(type)) pushTimestamps();
  else if (/photo|image|picture/.test(type)) pushRegions();
  else if (/exhibit/.test(type)) pushExhibits();
  else {
    // Unknown/mixed type: attempt all deterministic locators the text supports.
    pushPageParagraph();
    pushTimestamps();
    pushExhibits();
  }

  const navigable = locators.filter((l) => l.provenance === 'repository').length;
  const unknown = locators.filter((l) => l.provenance === 'unknown').length;
  return { evidenceType, locators, navigable, unknown };
}
