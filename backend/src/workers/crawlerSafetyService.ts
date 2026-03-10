// ============================================================================
// Phase 67 — Crawler Safety Service
// Protections: 1 req/sec per domain, max 200 pages per agency,
// max crawl time 5 minutes, robots.txt compliance.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrawlSafetyConfig {
  maxPagesPerAgency: number;
  maxCrawlTimeMs: number;
  requestDelayMs: number;
  respectRobotsTxt: boolean;
  maxConcurrentDomains: number;
  userAgent: string;
}

export interface DomainThrottle {
  domain: string;
  lastRequestAt: number;
  requestCount: number;
  isBlocked: boolean;
  blockReason?: string;
}

export interface CrawlSession {
  agencyId: string;
  domain: string;
  startedAt: number;
  pagesVisited: number;
  errors: number;
  isActive: boolean;
  timedOut: boolean;
}

export interface RobotsTxtRules {
  domain: string;
  disallowedPaths: string[];
  crawlDelay: number | null;
  fetchedAt: number;
  raw: string;
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

export const DEFAULT_CRAWL_SAFETY: CrawlSafetyConfig = {
  maxPagesPerAgency: 200,
  maxCrawlTimeMs: 5 * 60 * 1000, // 5 minutes
  requestDelayMs: 1000, // 1 request/sec
  respectRobotsTxt: true,
  maxConcurrentDomains: 2,
  userAgent: 'CourtAccess-PolicyCrawler/1.0 (+https://courtaccess.app/crawler-info)',
};

// ---------------------------------------------------------------------------
// Domain Throttle Manager
// ---------------------------------------------------------------------------

const domainThrottles = new Map<string, DomainThrottle>();
const activeSessions = new Map<string, CrawlSession>();
const robotsTxtCache = new Map<string, RobotsTxtRules>();

/**
 * Extract domain from URL.
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
}

/**
 * Check if we can make a request to the given domain.
 * Enforces 1 req/sec per domain.
 */
export function canRequestDomain(
  domain: string,
  config: CrawlSafetyConfig = DEFAULT_CRAWL_SAFETY,
): { allowed: boolean; waitMs: number; reason?: string } {
  const throttle = domainThrottles.get(domain);

  if (!throttle) {
    return { allowed: true, waitMs: 0 };
  }

  if (throttle.isBlocked) {
    return { allowed: false, waitMs: 0, reason: throttle.blockReason ?? 'Domain is blocked' };
  }

  const elapsed = Date.now() - throttle.lastRequestAt;
  const delay = config.requestDelayMs;

  if (elapsed < delay) {
    return { allowed: false, waitMs: delay - elapsed, reason: `Rate limit: wait ${delay - elapsed}ms` };
  }

  return { allowed: true, waitMs: 0 };
}

/**
 * Record a request to a domain (updates throttle timestamp).
 */
export function recordDomainRequest(domain: string): void {
  const existing = domainThrottles.get(domain);
  if (existing) {
    existing.lastRequestAt = Date.now();
    existing.requestCount++;
  } else {
    domainThrottles.set(domain, {
      domain,
      lastRequestAt: Date.now(),
      requestCount: 1,
      isBlocked: false,
    });
  }
}

/**
 * Block a domain (e.g., if robots.txt disallows crawling).
 */
export function blockDomain(domain: string, reason: string): void {
  const existing = domainThrottles.get(domain);
  if (existing) {
    existing.isBlocked = true;
    existing.blockReason = reason;
  } else {
    domainThrottles.set(domain, {
      domain,
      lastRequestAt: 0,
      requestCount: 0,
      isBlocked: true,
      blockReason: reason,
    });
  }
}

// ---------------------------------------------------------------------------
// Crawl Session Management
// ---------------------------------------------------------------------------

/**
 * Start a crawl session for an agency. Enforces max concurrent domains.
 */
export function startCrawlSession(
  agencyId: string,
  url: string,
  config: CrawlSafetyConfig = DEFAULT_CRAWL_SAFETY,
): { allowed: boolean; session?: CrawlSession; reason?: string } {
  const domain = extractDomain(url);

  // Check concurrent domain limit
  const activeDomains = new Set(
    Array.from(activeSessions.values())
      .filter((s) => s.isActive)
      .map((s) => s.domain)
  );

  if (!activeDomains.has(domain) && activeDomains.size >= config.maxConcurrentDomains) {
    return {
      allowed: false,
      reason: `Max concurrent domains reached (${config.maxConcurrentDomains}). Active: ${Array.from(activeDomains).join(', ')}`,
    };
  }

  const session: CrawlSession = {
    agencyId,
    domain,
    startedAt: Date.now(),
    pagesVisited: 0,
    errors: 0,
    isActive: true,
    timedOut: false,
  };

  activeSessions.set(agencyId, session);
  return { allowed: true, session };
}

/**
 * Check if a crawl session can visit another page.
 * Enforces max pages and max crawl time.
 */
export function canVisitPage(
  agencyId: string,
  config: CrawlSafetyConfig = DEFAULT_CRAWL_SAFETY,
): { allowed: boolean; reason?: string } {
  const session = activeSessions.get(agencyId);
  if (!session || !session.isActive) {
    return { allowed: false, reason: 'No active crawl session' };
  }

  // Check max pages
  if (session.pagesVisited >= config.maxPagesPerAgency) {
    return { allowed: false, reason: `Max pages reached (${config.maxPagesPerAgency})` };
  }

  // Check max crawl time
  const elapsed = Date.now() - session.startedAt;
  if (elapsed >= config.maxCrawlTimeMs) {
    session.timedOut = true;
    session.isActive = false;
    return { allowed: false, reason: `Max crawl time exceeded (${config.maxCrawlTimeMs / 1000}s)` };
  }

  return { allowed: true };
}

/**
 * Record a page visit in the crawl session.
 */
export function recordPageVisit(agencyId: string): void {
  const session = activeSessions.get(agencyId);
  if (session) {
    session.pagesVisited++;
  }
}

/**
 * Record an error in the crawl session.
 */
export function recordCrawlError(agencyId: string): void {
  const session = activeSessions.get(agencyId);
  if (session) {
    session.errors++;
  }
}

/**
 * End a crawl session.
 */
export function endCrawlSession(agencyId: string): CrawlSession | null {
  const session = activeSessions.get(agencyId);
  if (session) {
    session.isActive = false;
    activeSessions.delete(agencyId);
    return session;
  }
  return null;
}

// ---------------------------------------------------------------------------
// robots.txt Compliance
// ---------------------------------------------------------------------------

/**
 * Parse robots.txt content for our user agent.
 */
export function parseRobotsTxt(domain: string, content: string): RobotsTxtRules {
  const rules: RobotsTxtRules = {
    domain,
    disallowedPaths: [],
    crawlDelay: null,
    fetchedAt: Date.now(),
    raw: content,
  };

  const lines = content.split('\n');
  let isRelevantBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim().toLowerCase();

    if (line.startsWith('user-agent:')) {
      const agent = line.replace('user-agent:', '').trim();
      isRelevantBlock = agent === '*' || agent.includes('courtaccess');
    }

    if (isRelevantBlock) {
      if (line.startsWith('disallow:')) {
        const path = line.replace('disallow:', '').trim();
        if (path.length > 0) {
          rules.disallowedPaths.push(path);
        }
      }
      if (line.startsWith('crawl-delay:')) {
        const delay = parseFloat(line.replace('crawl-delay:', '').trim());
        if (!isNaN(delay)) {
          rules.crawlDelay = delay;
        }
      }
    }
  }

  robotsTxtCache.set(domain, rules);
  return rules;
}

/**
 * Check if a URL is allowed by robots.txt rules.
 */
export function isUrlAllowedByRobots(url: string): { allowed: boolean; reason?: string } {
  const domain = extractDomain(url);
  const rules = robotsTxtCache.get(domain);

  if (!rules) {
    // No robots.txt cached — allow by default (caller should fetch first)
    return { allowed: true };
  }

  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    for (const disallowed of rules.disallowedPaths) {
      if (path.startsWith(disallowed)) {
        return { allowed: false, reason: `Blocked by robots.txt: Disallow ${disallowed}` };
      }
    }
  } catch {
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Get cached robots.txt rules for a domain.
 */
export function getCachedRobotsTxt(domain: string): RobotsTxtRules | null {
  return robotsTxtCache.get(domain) ?? null;
}

// ---------------------------------------------------------------------------
// Safety Check (all-in-one for a single request)
// ---------------------------------------------------------------------------

/**
 * Comprehensive safety check before making a crawl request.
 * Checks: rate limit, page limit, time limit, robots.txt.
 */
export function checkCrawlSafety(
  agencyId: string,
  url: string,
  config: CrawlSafetyConfig = DEFAULT_CRAWL_SAFETY,
): { allowed: boolean; reason?: string; waitMs: number } {
  const domain = extractDomain(url);

  // 1. Domain rate limit
  const rateCheck = canRequestDomain(domain, config);
  if (!rateCheck.allowed) {
    return { allowed: false, reason: rateCheck.reason, waitMs: rateCheck.waitMs };
  }

  // 2. Page/time limits
  const pageCheck = canVisitPage(agencyId, config);
  if (!pageCheck.allowed) {
    return { allowed: false, reason: pageCheck.reason, waitMs: 0 };
  }

  // 3. robots.txt
  if (config.respectRobotsTxt) {
    const robotsCheck = isUrlAllowedByRobots(url);
    if (!robotsCheck.allowed) {
      return { allowed: false, reason: robotsCheck.reason, waitMs: 0 };
    }
  }

  return { allowed: true, waitMs: 0 };
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

export function getCrawlerSafetyStatus(): {
  activeSessions: CrawlSession[];
  domainThrottles: DomainThrottle[];
  robotsTxtCacheSize: number;
  config: CrawlSafetyConfig;
} {
  return {
    activeSessions: Array.from(activeSessions.values()),
    domainThrottles: Array.from(domainThrottles.values()),
    robotsTxtCacheSize: robotsTxtCache.size,
    config: DEFAULT_CRAWL_SAFETY,
  };
}

/**
 * Reset all state (for testing).
 */
export function resetCrawlerSafety(): void {
  domainThrottles.clear();
  activeSessions.clear();
  robotsTxtCache.clear();
}
