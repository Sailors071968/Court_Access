// ---------------------------------------------------------------------------
// Phase 4 — Website Crawling Worker (BullMQ)
// Crawls agency websites to identify policy-related pages and documents.
// Phase 5 — Policy Document Discovery (integrated)
// ---------------------------------------------------------------------------

import { Worker, Queue, Job } from 'bullmq';
import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import {
  CrawlResult,
  DocumentUrl,
  POLICY_KEYWORDS,
  DEFAULT_CRAWLER_CONFIG,
  CrawlerConfig,
} from '../agencyRegistry/types.js';

// Queue names
export const SITE_CRAWL_QUEUE = 'agency-site-crawl-queue';
export const DOCUMENT_DOWNLOAD_QUEUE = 'policy-document-download-queue';

export interface SiteCrawlJobData {
  agencyId: string;
  agencyName: string;
  website: string;
  config?: Partial<CrawlerConfig>;
}

/**
 * Build a headless Chrome driver for crawling.
 */
// See postCrawler.buildDriver: the thenable returned by build() must be
// awaited so that a failed session creation rejects into the caller instead
// of surfacing as an unhandled rejection.
async function buildDriver(userAgent: string): Promise<WebDriver> {
  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--disable-gpu');
  options.addArguments('--window-size=1920,1080');
  options.addArguments(`--user-agent=${userAgent}`);

  return new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();
}

/**
 * Check if a URL is a document (PDF, DOCX, DOC).
 */
function isDocumentUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.endsWith('.pdf') ||
    lower.endsWith('.doc') ||
    lower.endsWith('.docx') ||
    lower.includes('.pdf?') ||
    lower.includes('.doc?') ||
    lower.includes('.docx?')
  );
}

/**
 * Estimate MIME type from URL.
 */
function estimateMimeType(url: string): string | null {
  const lower = url.toLowerCase();
  if (lower.endsWith('.pdf') || lower.includes('.pdf?'))
    return 'application/pdf';
  if (lower.endsWith('.doc') || lower.includes('.doc?'))
    return 'application/msword';
  if (lower.endsWith('.docx') || lower.includes('.docx?'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return null;
}

/**
 * Check if a page URL or text contains policy-related keywords.
 */
function containsPolicyKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return POLICY_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Estimate document type from URL and surrounding text.
 */
function estimateDocumentType(url: string, text: string): string | null {
  const combined = `${url} ${text}`.toLowerCase();

  if (
    combined.includes('use of force') ||
    combined.includes('use-of-force') ||
    combined.includes('force continuum')
  )
    return 'USE_OF_FORCE';
  if (
    combined.includes('internal affairs') ||
    combined.includes('personnel complaint')
  )
    return 'INTERNAL_AFFAIRS';
  if (
    combined.includes('body camera') ||
    combined.includes('body-worn') ||
    combined.includes('bwc')
  )
    return 'BODY_CAMERA';
  if (
    combined.includes('discipline') ||
    combined.includes('disciplinary')
  )
    return 'DISCIPLINE';
  if (
    combined.includes('training manual') ||
    combined.includes('training bulletin')
  )
    return 'TRAINING';
  if (
    combined.includes('general order') ||
    combined.includes('policy manual') ||
    combined.includes('department manual')
  )
    return 'GENERAL_POLICY';

  return null;
}

/**
 * Crawl a single agency website and discover policy pages and documents.
 */
export async function crawlAgencySite(
  data: SiteCrawlJobData,
  config: CrawlerConfig = DEFAULT_CRAWLER_CONFIG
): Promise<CrawlResult> {
  const result: CrawlResult = {
    agencyId: data.agencyId,
    pagesFound: 0,
    policyPagesFound: 0,
    policyUrls: [],
    documentUrls: [],
    error: null,
  };

  const driver = await buildDriver(config.userAgent);
  const visited = new Set<string>();
  const toVisit: string[] = [data.website];
  const baseUrl = new URL(data.website);
  const baseDomain = baseUrl.hostname;

  try {
    while (toVisit.length > 0 && visited.size < config.maxPagesPerSite) {
      const url = toVisit.shift()!;

      // Normalize URL and skip if already visited
      const normalizedUrl = normalizeUrl(url);
      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      // Only crawl same domain
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname !== baseDomain) continue;
      } catch {
        continue;
      }

      // Check if this is a document URL
      if (isDocumentUrl(url)) {
        result.documentUrls.push({
          url,
          title: extractTitleFromUrl(url),
          mimeType: estimateMimeType(url),
          estimatedType: estimateDocumentType(url, ''),
        });
        continue;
      }

      try {
        // Rate limit: 1 request per second
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 / config.requestsPerSecondPerSite)
        );

        await driver.get(url);
        await driver.wait(until.elementLocated(By.css('body')), config.requestTimeoutMs);

        result.pagesFound++;

        // Get page text to check for policy keywords
        const pageText = await driver.findElement(By.css('body')).getText();
        const pageTitle = await driver.getTitle();

        if (containsPolicyKeywords(pageText) || containsPolicyKeywords(pageTitle)) {
          result.policyPagesFound++;
          result.policyUrls.push(url);
        }

        // Extract all links from the page
        const links = await driver.findElements(By.css('a[href]'));

        for (const link of links) {
          try {
            const href = await link.getAttribute('href');
            const linkText = await link.getText();
            if (!href) continue;

            // Resolve relative URLs
            let absoluteUrl: string;
            try {
              absoluteUrl = new URL(href, url).toString();
            } catch {
              continue;
            }

            // Check if it's a document
            if (isDocumentUrl(absoluteUrl)) {
              const docUrl: DocumentUrl = {
                url: absoluteUrl,
                title: linkText.trim() || extractTitleFromUrl(absoluteUrl),
                mimeType: estimateMimeType(absoluteUrl),
                estimatedType: estimateDocumentType(absoluteUrl, linkText),
              };

              // Only add if it might be policy-related or if the page is a policy page
              if (
                containsPolicyKeywords(`${absoluteUrl} ${linkText}`) ||
                containsPolicyKeywords(pageText)
              ) {
                // Deduplicate
                if (!result.documentUrls.some((d) => d.url === absoluteUrl)) {
                  result.documentUrls.push(docUrl);
                }
              }
            }

            // Add to crawl queue if same domain and not visited
            try {
              const linkUrl = new URL(absoluteUrl);
              if (
                linkUrl.hostname === baseDomain &&
                !visited.has(normalizeUrl(absoluteUrl)) &&
                !absoluteUrl.includes('#') &&
                !absoluteUrl.includes('mailto:') &&
                !absoluteUrl.includes('tel:') &&
                !absoluteUrl.includes('javascript:')
              ) {
                toVisit.push(absoluteUrl);
              }
            } catch {
              // Invalid URL, skip
            }
          } catch {
            continue;
          }
        }
      } catch (error) {
        // Page load failed, continue to next
        console.warn(
          `[Site Crawl] Failed to load ${url}: ${error instanceof Error ? error.message : 'unknown'}`
        );
      }
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    await driver.quit().catch(() => {});
  }

  console.log(
    `[Site Crawl] ${data.agencyName}: ${result.pagesFound} pages, ` +
      `${result.policyPagesFound} policy pages, ${result.documentUrls.length} documents`
  );

  return result;
}

/**
 * Normalize a URL for deduplication.
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash, hash, and common tracking params
    let normalized = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
    normalized = normalized.replace(/\/+$/, '');
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Extract a human-readable title from a document URL.
 */
function extractTitleFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const filename = parsed.pathname.split('/').pop();
    if (!filename) return null;
    return filename
      .replace(/\.[^.]+$/, '') // Remove extension
      .replace(/[-_]/g, ' ') // Replace dashes/underscores with spaces
      .replace(/\b\w/g, (c) => c.toUpperCase()); // Title case
  } catch {
    return null;
  }
}

/**
 * Create the BullMQ queue for site crawling.
 */
export function createSiteCrawlQueue(redisUrl?: string): Queue<SiteCrawlJobData> {
  const connection = redisUrl
    ? { url: redisUrl }
    : { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 };

  return new Queue<SiteCrawlJobData>(SITE_CRAWL_QUEUE, { connection });
}

/**
 * Create and start the site crawl worker.
 */
export function createSiteCrawlWorker(
  onComplete?: (result: CrawlResult) => Promise<void>,
  redisUrl?: string
): Worker<SiteCrawlJobData> {
  const connection = redisUrl
    ? { url: redisUrl }
    : { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 };

  const worker = new Worker<SiteCrawlJobData>(
    SITE_CRAWL_QUEUE,
    async (job: Job<SiteCrawlJobData>) => {
      console.log(
        `[Site Crawl Worker] Processing: ${job.data.agencyName} (${job.data.website})`
      );

      const result = await crawlAgencySite(job.data);

      if (onComplete) {
        await onComplete(result);
      }

      return result;
    },
    {
      connection,
      concurrency: DEFAULT_CRAWLER_CONFIG.maxConcurrentSites,
      limiter: {
        max: 2,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Site Crawl Worker] Completed: ${job.data.agencyName}`);
  });

  worker.on('failed', (job, error) => {
    console.error(
      `[Site Crawl Worker] Failed: ${job?.data.agencyName}`,
      error.message
    );
  });

  return worker;
}
