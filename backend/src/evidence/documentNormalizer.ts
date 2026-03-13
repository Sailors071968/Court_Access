// ============================================================================
// Core Evidence System — Document Normalization Engine (Parts 6-11)
// Ensures uploaded documents are in canonical evidence format before analysis.
// Includes multiplex detection, anti-multiplex enforcement, and transcript
// exception rules.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageAnalysis {
  pageIndex: number;
  pageNumbersDetected: number[];
  textRegionCount: number;
  headerFooterRepetitions: number;
  logicalPageCount: number;
  isMultiplexed: boolean;
}

export interface NormalizationResult {
  accepted: boolean;
  totalPages: number;
  analyzedPages: PageAnalysis[];
  multiplexDetected: boolean;
  maxMultiplexCount: number;
  rejectionReason?: string;
  normalizedPageCount: number;
}

export interface DocumentNormalizationInput {
  evidenceId: string;
  evidenceType: string;
  fileName: string;
  pageCount: number;
  /** Raw page data for analysis (in production, extracted from PDF) */
  pages: PageData[];
}

export interface PageData {
  pageIndex: number;
  text: string;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Evidence types that are transcripts (allowed 1-4 pages per sheet) */
const TRANSCRIPT_TYPES = ['transcript'];

/** Maximum logical pages per physical page for transcripts */
const MAX_TRANSCRIPT_MULTIPLEX = 4;

/** Maximum logical pages per physical page for non-transcripts */
const MAX_NON_TRANSCRIPT_MULTIPLEX = 1;

// ---------------------------------------------------------------------------
// Multiplex Detection Algorithm (Part 9)
// ---------------------------------------------------------------------------

/**
 * Detect page numbers present on a single page.
 * Looks for patterns like "Page 1", "- 1 -", "1 of 10", standalone numbers
 * at top/bottom of page.
 */
export function detectPageNumbers(text: string): number[] {
  const pageNumbers: number[] = [];
  const patterns = [
    /Page\s+(\d+)/gi,
    /[-–—]\s*(\d+)\s*[-–—]/g,
    /(\d+)\s+of\s+\d+/gi,
    /^\s*(\d+)\s*$/gm,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num < 10000 && !pageNumbers.includes(num)) {
        pageNumbers.push(num);
      }
    }
  }

  return pageNumbers.sort((a, b) => a - b);
}

/**
 * Detect distinct text regions on a single page.
 * Multiple text blocks separated by significant whitespace indicate
 * multiplexed content.
 */
export function detectTextRegions(text: string): number {
  if (!text.trim()) return 0;

  // Split on multiple consecutive newlines (indicating separate regions)
  const regions = text.split(/\n{3,}/).filter((r) => r.trim().length > 20);
  return regions.length;
}

/**
 * Detect repeated headers/footers on a single page.
 * If the same header pattern appears multiple times, the page likely
 * contains multiple logical pages.
 */
export function detectHeaderFooterRepetitions(text: string): number {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 4) return 0;

  // Look for repeated short lines (likely headers/footers)
  const shortLines = lines.filter((l) => l.length < 80 && l.length > 5);
  const counts = new Map<string, number>();
  for (const line of shortLines) {
    const normalized = line.toLowerCase().replace(/\d+/g, '#');
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  let maxRepetitions = 0;
  for (const count of counts.values()) {
    if (count > maxRepetitions) maxRepetitions = count;
  }

  return maxRepetitions;
}

/**
 * Detect if a single page is multiplexed (Part 9).
 * Returns the estimated number of logical pages on this physical page.
 */
export function detectMultiplexPage(page: PageData): PageAnalysis {
  const pageNumbers = detectPageNumbers(page.text);
  const textRegionCount = detectTextRegions(page.text);
  const headerFooterRepetitions = detectHeaderFooterRepetitions(page.text);

  // Determine logical page count
  let logicalPageCount = 1;

  // Signal 1: Multiple page numbers
  if (pageNumbers.length > 1) {
    logicalPageCount = Math.max(logicalPageCount, pageNumbers.length);
  }

  // Signal 2: Multiple text regions (>3 suggests multiplex)
  if (textRegionCount > 3) {
    const estimatedFromRegions = Math.ceil(textRegionCount / 2);
    logicalPageCount = Math.max(logicalPageCount, estimatedFromRegions);
  }

  // Signal 3: Repeated headers/footers
  if (headerFooterRepetitions > 1) {
    logicalPageCount = Math.max(logicalPageCount, headerFooterRepetitions);
  }

  return {
    pageIndex: page.pageIndex,
    pageNumbersDetected: pageNumbers,
    textRegionCount,
    headerFooterRepetitions,
    logicalPageCount,
    isMultiplexed: logicalPageCount > 1,
  };
}

// ---------------------------------------------------------------------------
// Enforcement Logic (Part 10)
// ---------------------------------------------------------------------------

/**
 * Normalize and validate a document.
 * Enforces anti-multiplex rules based on evidence type.
 *
 * Non-transcript evidence: max 1 logical page per physical page.
 * Transcript evidence: max 4 logical pages per physical page.
 */
export function normalizeDocument(input: DocumentNormalizationInput): NormalizationResult {
  const isTranscript = TRANSCRIPT_TYPES.includes(input.evidenceType);
  const maxAllowed = isTranscript ? MAX_TRANSCRIPT_MULTIPLEX : MAX_NON_TRANSCRIPT_MULTIPLEX;

  const analyzedPages: PageAnalysis[] = [];
  let multiplexDetected = false;
  let maxMultiplexCount = 1;
  let totalLogicalPages = 0;

  for (const page of input.pages) {
    const analysis = detectMultiplexPage(page);
    analyzedPages.push(analysis);

    if (analysis.isMultiplexed) {
      multiplexDetected = true;
    }
    if (analysis.logicalPageCount > maxMultiplexCount) {
      maxMultiplexCount = analysis.logicalPageCount;
    }
    totalLogicalPages += analysis.logicalPageCount;
  }

  // Enforcement: Check against limits
  if (maxMultiplexCount > maxAllowed) {
    const typeLabel = isTranscript ? 'court reporter transcripts' : 'discovery documents';
    const limitLabel = isTranscript
      ? `maximum ${MAX_TRANSCRIPT_MULTIPLEX} pages per sheet`
      : 'one page per page';

    return {
      accepted: false,
      totalPages: input.pageCount,
      analyzedPages,
      multiplexDetected,
      maxMultiplexCount,
      normalizedPageCount: totalLogicalPages,
      rejectionReason:
        `CourtAccess requires discovery documents to be uploaded with one page per page. ` +
        `Multiplexed documents are not permitted except for ${typeLabel} (${limitLabel}). ` +
        `Detected ${maxMultiplexCount}-up format on page ${analyzedPages.find((p) => p.logicalPageCount > maxAllowed)?.pageIndex ?? 0 + 1}.`,
    };
  }

  return {
    accepted: true,
    totalPages: input.pageCount,
    analyzedPages,
    multiplexDetected,
    maxMultiplexCount,
    normalizedPageCount: totalLogicalPages,
  };
}

// ---------------------------------------------------------------------------
// Auto-Normalization Placeholder (Part 11 — Future)
// ---------------------------------------------------------------------------

/**
 * Placeholder interface for future auto-splitting of multiplexed pages.
 * Example: 4-up transcript → split into 4 individual pages.
 *
 * NOT IMPLEMENTED — only the interface is defined here.
 */
export interface AutoNormalizationConfig {
  /** Whether auto-normalization is enabled */
  enabled: boolean;
  /** Maximum pages to auto-split (safety limit) */
  maxPagesToSplit: number;
  /** Evidence types eligible for auto-normalization */
  eligibleTypes: string[];
}

/**
 * Placeholder: Auto-split multiplexed pages into individual pages.
 * @returns null — not yet implemented.
 */
export function autoNormalizeDocument(
  _input: DocumentNormalizationInput,
  _config: AutoNormalizationConfig,
): null {
  // Future implementation:
  // 1. Detect multiplex regions on each page
  // 2. Extract each logical page region
  // 3. Create individual page PDFs
  // 4. Return array of split page data
  return null;
}
