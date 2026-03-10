/**
 * Phase 6: Agency Policy Discovery
 *
 * Uses headless Selenium/ChromeDriver to search agency websites for policies
 * matching the canonical CHP topic taxonomy.
 *
 * Search strategies:
 *   - site:agencydomain.com "use of force policy"
 *   - site:agencydomain.com "policy manual"
 *   - site:agencydomain.com "general orders"
 *   - Direct crawl of known policy page URLs
 */

import { PrismaClient } from '@prisma/client';
import { Builder, By, until, type WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { CATEGORY_DEFINITIONS, type PolicyCategory } from './chpPolicyTaxonomy.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveryResult {
  agencyId: string;
  agencyName: string;
  searchesPerformed: number;
  policyUrlsFound: string[];
  documentsCreated: number;
  errors: string[];
}

interface SearchQuery {
  category: PolicyCategory;
  query: string;
  keywords: string[];
}

// ---------------------------------------------------------------------------
// Build search queries for an agency domain
// ---------------------------------------------------------------------------

function buildSearchQueries(agencyDomain: string): SearchQuery[] {
  const queries: SearchQuery[] = [];

  // Generic policy manual searches
  const genericTerms = [
    'policy manual',
    'general orders',
    'department policies',
    'standard operating procedures',
    'rules and regulations',
  ];

  for (const term of genericTerms) {
    queries.push({
      category: 'Use_of_Force' as PolicyCategory, // Generic — will be reclassified
      query: `site:${agencyDomain} "${term}"`,
      keywords: [term],
    });
  }

  // Category-specific searches
  for (const def of CATEGORY_DEFINITIONS) {
    // Pick top 3 most distinctive keywords per category
    const topKeywords = def.keywords.slice(0, 3);
    for (const kw of topKeywords) {
      queries.push({
        category: def.category,
        query: `site:${agencyDomain} "${kw}"`,
        keywords: [kw],
      });
    }
  }

  return queries;
}

// ---------------------------------------------------------------------------
// Create headless Chrome driver
// ---------------------------------------------------------------------------

async function createDriver(): Promise<WebDriver> {
  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--disable-gpu');
  options.addArguments('--window-size=1920,1080');
  options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  return driver;
}

// ---------------------------------------------------------------------------
// Search Google for agency policies (headless)
// ---------------------------------------------------------------------------

async function searchGoogle(
  driver: WebDriver,
  query: string,
): Promise<string[]> {
  const urls: string[] = [];

  try {
    const encodedQuery = encodeURIComponent(query);
    await driver.get(`https://www.google.com/search?q=${encodedQuery}`);

    // Wait for results
    await driver.wait(until.elementLocated(By.css('#search')), 10000).catch(() => null);

    // Extract result URLs
    const links = await driver.findElements(By.css('#search a[href]'));
    for (const link of links.slice(0, 10)) {
      const href = await link.getAttribute('href').catch(() => '');
      if (
        href &&
        !href.includes('google.com') &&
        !href.includes('youtube.com') &&
        !href.includes('webcache') &&
        (href.endsWith('.pdf') ||
          href.includes('policy') ||
          href.includes('manual') ||
          href.includes('general-order') ||
          href.includes('directive'))
      ) {
        urls.push(href);
      }
    }
  } catch {
    // Search failed — non-fatal
  }

  return urls;
}

// ---------------------------------------------------------------------------
// Direct crawl agency website for policy links
// ---------------------------------------------------------------------------

async function crawlAgencyForPolicies(
  driver: WebDriver,
  websiteUrl: string,
): Promise<string[]> {
  const policyUrls: string[] = [];

  try {
    await driver.get(websiteUrl);
    await driver.sleep(2000);

    // Find links containing policy-related terms
    const allLinks = await driver.findElements(By.css('a[href]'));
    for (const link of allLinks) {
      const href = await link.getAttribute('href').catch(() => '');
      const text = await link.getText().catch(() => '');
      const lowerHref = href.toLowerCase();
      const lowerText = text.toLowerCase();

      const isPolicyLink =
        lowerHref.includes('policy') ||
        lowerHref.includes('manual') ||
        lowerHref.includes('general-order') ||
        lowerHref.includes('directive') ||
        lowerHref.includes('sop') ||
        lowerText.includes('policy') ||
        lowerText.includes('manual') ||
        lowerText.includes('general order');

      const isPdfOrDoc =
        lowerHref.endsWith('.pdf') ||
        lowerHref.endsWith('.doc') ||
        lowerHref.endsWith('.docx');

      if (href && (isPolicyLink || isPdfOrDoc)) {
        // Resolve relative URLs
        let fullUrl = href;
        if (href.startsWith('/')) {
          const baseUrl = new URL(websiteUrl);
          fullUrl = `${baseUrl.origin}${href}`;
        }
        policyUrls.push(fullUrl);
      }
    }
  } catch {
    // Crawl failed — non-fatal
  }

  return [...new Set(policyUrls)]; // Deduplicate
}

// ---------------------------------------------------------------------------
// Main discovery function for a single agency
// ---------------------------------------------------------------------------

export async function discoverAgencyPolicies(agencyId: string): Promise<DiscoveryResult> {
  const agency = await prisma.agency.findUnique({
    where: { agencyId },
  });

  if (!agency) {
    throw new Error(`Agency not found: ${agencyId}`);
  }

  const result: DiscoveryResult = {
    agencyId,
    agencyName: agency.agencyName,
    searchesPerformed: 0,
    policyUrlsFound: [],
    documentsCreated: 0,
    errors: [],
  };

  // Update crawl status
  await prisma.agency.update({
    where: { agencyId },
    data: { crawlStatus: 'in_progress' },
  });

  let driver: WebDriver | null = null;

  try {
    driver = await createDriver();

    // Strategy 1: Direct crawl agency website
    if (agency.website) {
      const directUrls = await crawlAgencyForPolicies(driver, agency.website);
      result.policyUrlsFound.push(...directUrls);

      // Also check common policy subpages
      const commonPaths = ['/policies', '/policy', '/manuals', '/general-orders', '/about/policies'];
      for (const path of commonPaths) {
        try {
          const subUrls = await crawlAgencyForPolicies(driver, `${agency.website}${path}`);
          result.policyUrlsFound.push(...subUrls);
        } catch {
          // Path doesn't exist — non-fatal
        }
      }
    }

    // Strategy 2: Google site search for policy terms
    if (agency.website) {
      const domain = new URL(agency.website).hostname;
      const searchQueries = buildSearchQueries(domain);

      // Limit to first 5 searches to avoid rate limiting
      for (const sq of searchQueries.slice(0, 5)) {
        try {
          const urls = await searchGoogle(driver, sq.query);
          result.policyUrlsFound.push(...urls);
          result.searchesPerformed++;
          await driver.sleep(2000); // Rate limit between searches
        } catch {
          result.errors.push(`Search failed: ${sq.query}`);
        }
      }
    }

    // Deduplicate URLs
    result.policyUrlsFound = [...new Set(result.policyUrlsFound)];

    // Create PolicyDocument entries for discovered URLs
    for (const url of result.policyUrlsFound) {
      const existing = await prisma.policyDocument.findFirst({
        where: { agencyId, sourceUrl: url },
      });

      if (!existing) {
        await prisma.policyDocument.create({
          data: {
            agencyId,
            sourceUrl: url,
            title: extractTitleFromUrl(url),
            ocrStatus: 'pending',
            classificationStatus: 'pending',
          },
        });
        result.documentsCreated++;
      }
    }

    // Update agency status
    await prisma.agency.update({
      where: { agencyId },
      data: {
        crawlStatus: 'completed',
        lastCrawledAt: new Date(),
        policiesDiscovered: result.policyUrlsFound.length > 0,
        policyPagesFound: result.policyUrlsFound.length,
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(errMsg);
    await prisma.agency.update({
      where: { agencyId },
      data: {
        crawlStatus: 'failed',
        crawlError: errMsg,
      },
    });
  } finally {
    if (driver) {
      await driver.quit().catch(() => {});
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Batch discovery for multiple agencies (by priority rank)
// ---------------------------------------------------------------------------

export async function discoverPoliciesByRank(
  limit: number = 10,
  offset: number = 0,
): Promise<DiscoveryResult[]> {
  const agencies = await prisma.agency.findMany({
    where: {
      crawlStatus: 'pending',
      website: { not: null },
    },
    orderBy: { jurisdictionRank: 'asc' },
    skip: offset,
    take: limit,
  });

  const results: DiscoveryResult[] = [];
  for (const agency of agencies) {
    const result = await discoverAgencyPolicies(agency.agencyId);
    results.push(result);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helper: Extract readable title from URL
// ---------------------------------------------------------------------------

function extractTitleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() || '';
    return filename
      .replace(/\.[^.]+$/, '') // Remove extension
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || 'Untitled Policy Document';
  } catch {
    return 'Untitled Policy Document';
  }
}
