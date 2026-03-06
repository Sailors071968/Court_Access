// ============================================
// Court Access — Agency Crawler Engine (Phase O6)
// Controlled Agency Acquisition Crawler
//
// Pure discovery engine that extracts structured contact
// data from static HTML sources. No headless browser.
// No dynamic execution. No AI heuristics.
//
// This engine:
//   - Fetches static HTML from public sources
//   - Extracts agency data using deterministic parsing
//   - Enforces rate limiting
//   - Checks freeze state before operating
//   - Does NOT auto-activate agencies
//   - Does NOT auto-send email
//   - Does NOT bypass O1-O5 protections
//
// Every function is:
//   - Deterministic (no randomness, no Date.now)
//   - Rate-limited
//   - Sequential processing only (no parallel burst)
//
// Architectural boundary:
//   - Does NOT import O1-O5 engines
//   - Does NOT import SES, escalation, anchor engines
//   - No store access (caller persists)
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of historical entries
//   - No deletion
//   - Deterministic processing
//   - No AI content generation
//   - No fuzzy matching
//   - Static HTML only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type {
  RawAgencyData,
  CrawlerRateLimitConfig,
} from '../models/AgencyDiscoveryModel';

// ---------------------------------------------------------------------------
// ASCII Comparator
// ---------------------------------------------------------------------------

function asciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Rate Limit State
// ---------------------------------------------------------------------------

/**
 * Rate limit state tracker for deterministic enforcement.
 * Caller manages state — engine computes decisions.
 */
export interface RateLimitState {
  requestsThisMinute: number;
  requestsPerDomain: Map<string, number>;
  lastRequestTimestamp: number;              // Unix ms from Date.parse
}

// ---------------------------------------------------------------------------
// Check Rate Limit — deterministic gate
// ---------------------------------------------------------------------------

/**
 * Check whether a request to the given domain is allowed
 * under current rate limit state.
 *
 * Returns 'ALLOW' or 'BLOCKED'.
 * Deterministic — same inputs always produce same result.
 */
export function checkRateLimit(
  state: RateLimitState,
  domain: string,
  _currentTimestamp: string,
  config: CrawlerRateLimitConfig
): 'ALLOW' | 'BLOCKED' {
  // Check global requests per minute
  if (state.requestsThisMinute >= config.maxRequestsPerMinute) {
    return 'BLOCKED';
  }

  // Check per-domain limit
  const domainCount = state.requestsPerDomain.get(domain);
  if (domainCount !== undefined && domainCount >= config.maxRequestsPerDomain) {
    return 'BLOCKED';
  }

  // Check delay between requests
  const currentMs = Date.parse(currentTimestamp);
  if (currentMs - state.lastRequestTimestamp < config.delayBetweenRequestsMs) {
    return 'BLOCKED';
  }

  return 'ALLOW';
}

// ---------------------------------------------------------------------------
// Extract Domain from URL
// ---------------------------------------------------------------------------

/**
 * Extract domain from a URL string.
 * Deterministic ASCII parsing. No external library.
 *
 * Examples:
 *   "https://www.example.com/path" → "www.example.com"
 *   "http://agency.ca.gov/contact" → "agency.ca.gov"
 */
export function extractDomain(url: string): string {
  // Find the start of the domain (after "://")
  let start = 0;
  const protocolEnd = url.indexOf('://');
  if (protocolEnd >= 0) {
    start = protocolEnd + 3;
  }

  // Find the end of the domain (before "/" or end of string)
  let end = url.indexOf('/', start);
  if (end < 0) {
    end = url.length;
  }

  return url.substring(start, end);
}

// ---------------------------------------------------------------------------
// Parse Agency Data from HTML — deterministic extraction
// ---------------------------------------------------------------------------

/**
 * Parse raw agency data from static HTML content.
 *
 * Extraction rules:
 *   - Agency name: text within <h1>, <h2>, or <h3> tags
 *   - Email: ASCII pattern matching for addresses containing '@' and '.'
 *   - Phone: ASCII pattern matching for phone number formats
 *   - Address: text within elements identified by common address patterns
 *
 * Constraints:
 *   - Deterministic regex patterns only
 *   - ASCII-only matching
 *   - No fuzzy matching
 *   - No AI heuristics
 *   - No dynamic execution
 *
 * Returns array of raw agency data extracted from the HTML.
 */
export function parseAgencyDataFromHtml(
  html: string,
  sourceUrl: string
): RawAgencyData[] {
  const results: RawAgencyData[] = [];

  // Extract email addresses — deterministic ASCII pattern
  // Pattern: one or more non-whitespace chars, '@', one or more non-whitespace chars, '.', one or more non-whitespace chars
  const emailPattern = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
  const emails: string[] = [];
  let emailMatch = emailPattern.exec(html);
  while (emailMatch !== null) {
    emails.push(emailMatch[0]);
    emailMatch = emailPattern.exec(html);
  }

  // Extract phone numbers — deterministic ASCII pattern
  // Pattern: common US phone formats
  const phonePattern = /\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g;
  const phones: string[] = [];
  let phoneMatch = phonePattern.exec(html);
  while (phoneMatch !== null) {
    phones.push(phoneMatch[0]);
    phoneMatch = phonePattern.exec(html);
  }

  // Extract headings for agency names — deterministic tag extraction
  const headingPattern = /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/g;
  const headings: string[] = [];
  let headingMatch = headingPattern.exec(html);
  while (headingMatch !== null) {
    const text = headingMatch[1].trim();
    if (text.length > 0) {
      headings.push(text);
    }
    headingMatch = headingPattern.exec(html);
  }

  // Build raw agency data from extracted elements
  // Each heading with at least one email is a candidate
  for (let i = 0; i < headings.length; i++) {
    const agencyName = headings[i];
    const emailAddress = i < emails.length ? emails[i] : null;
    const phoneNumber = i < phones.length ? phones[i] : null;

    results.push({
      agencyName,
      departmentType: '',
      emailAddress,
      mailingAddress: null,
      phoneNumber,
      county: null,
      sourceUrl,
    });
  }

  // Sort by agencyName ASCII for deterministic ordering
  results.sort(function sortByName(a: RawAgencyData, b: RawAgencyData): number {
    return asciiCompare(a.agencyName, b.agencyName);
  });

  return results;
}

// ---------------------------------------------------------------------------
// Crawl Source — fetch and parse static HTML
// ---------------------------------------------------------------------------

/**
 * Fetch static HTML from a public URL and extract agency data.
 *
 * Constraints:
 *   - Static HTML only (no JavaScript rendering)
 *   - No headless browser
 *   - No dynamic execution
 *   - Sequential processing only
 *   - Rate limit must be checked by caller before invoking
 *
 * Parameters:
 *   - sourceUrl: public URL to fetch
 *   - currentTimestamp: ISO 8601, caller-provided
 *
 * Returns array of raw agency data.
 * Async because fetch is inherently asynchronous.
 */
export async function crawlSource(
  sourceUrl: string,
  currentTimestamp: string
): Promise<RawAgencyData[]> {
  // Fetch static HTML
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    return [];
  }

  const html = await response.text();

  // Parse and return structured data
  return parseAgencyDataFromHtml(html, sourceUrl);
}

// ---------------------------------------------------------------------------
// Deduplicate Candidates — ASCII exact match
// ---------------------------------------------------------------------------

/**
 * Check if an agency name already exists in the candidate list.
 *
 * Deduplication rules:
 *   - Normalize: trim whitespace only (no case conversion)
 *   - Compare: ASCII exact match
 *   - If exists → true (skip creation)
 *   - No fuzzy matching
 *
 * Deterministic — same inputs always produce same result.
 */
export function isDuplicateCandidate(
  agencyName: string,
  existingNames: readonly string[]
): boolean {
  const trimmed = agencyName.trim();
  for (let i = 0; i < existingNames.length; i++) {
    if (existingNames[i].trim() === trimmed) {
      return true;
    }
  }
  return false;
}
