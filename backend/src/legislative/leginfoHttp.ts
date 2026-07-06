// ============================================================================
// Respectful leginfo HTTP client — rate-limited via crawlerSafetyService
// ============================================================================

import {
  checkCrawlSafety,
  DEFAULT_CRAWL_SAFETY,
  endCrawlSession,
  recordCrawlError,
  recordDomainRequest,
  recordPageVisit,
  startCrawlSession,
  type CrawlSafetyConfig,
} from '../workers/crawlerSafetyService.ts';
import { LEGINFO_BASE_URL } from './caCodes.ts';

const LEGISLATIVE_USER_AGENT =
  'CourtAccess-LegislativeDiscovery/1.0 (+https://courtaccess.app/legislative-info)';

const LEGISLATIVE_CRAWL_CONFIG: CrawlSafetyConfig = {
  ...DEFAULT_CRAWL_SAFETY,
  maxPagesPerAgency: 50_000,
  maxCrawlTimeMs: 4 * 60 * 60 * 1000,
  userAgent: LEGISLATIVE_USER_AGENT,
};

export interface LeginfoFetchResult {
  url: string;
  status: number;
  html: string;
  fetchedAt: string;
}

export interface LeginfoHttpOptions {
  sessionId: string;
  config?: CrawlSafetyConfig;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ensureLeginfoSession(sessionId: string, config = LEGISLATIVE_CRAWL_CONFIG): void {
  const result = startCrawlSession(sessionId, LEGINFO_BASE_URL, config);
  if (!result.allowed && !result.session) {
    throw new Error(result.reason ?? 'Unable to start leginfo crawl session');
  }
}

export async function fetchLeginfoPage(
  url: string,
  options: LeginfoHttpOptions,
): Promise<LeginfoFetchResult> {
  const config = options.config ?? LEGISLATIVE_CRAWL_CONFIG;
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRetries = options.maxRetries ?? 3;

  ensureLeginfoSession(options.sessionId, config);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const safety = checkCrawlSafety(options.sessionId, url, config);
    if (!safety.allowed) {
      if (safety.waitMs > 0) {
        await sleep(safety.waitMs);
        continue;
      }
      throw new Error(safety.reason ?? 'Crawl safety check failed');
    }

    try {
      const domain = new URL(url).hostname;
      recordDomainRequest(domain);

      const response = await fetchImpl(url, {
        headers: {
          'User-Agent': config.userAgent,
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });

      recordPageVisit(options.sessionId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      const html = await response.text();
      return {
        url,
        status: response.status,
        html,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      recordCrawlError(options.sessionId);
      const backoff = Math.min(1000 * 2 ** attempt, 8000);
      await sleep(backoff);
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

export function closeLeginfoSession(sessionId: string): void {
  endCrawlSession(sessionId);
}

export { LEGISLATIVE_CRAWL_CONFIG, LEGISLATIVE_USER_AGENT };
