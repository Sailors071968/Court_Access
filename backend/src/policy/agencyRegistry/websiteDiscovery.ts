// ---------------------------------------------------------------------------
// Phase 3 — Agency Website Discovery
// For agencies missing websites, attempt discovery via search.
// ---------------------------------------------------------------------------

import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

/**
 * Build a headless Chrome driver for search queries.
 */
function buildDriver(): WebDriver {
  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--disable-gpu');
  options.addArguments('--window-size=1920,1080');

  return new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();
}

export interface DiscoveryResult {
  website: string | null;
  recordsRequestUrl: string | null;
  policyCollectionUrl: string | null;
}

/**
 * Attempt to discover an agency's official website using Google search.
 * Query: "{agencyName}" california official site
 */
export async function discoverAgencyWebsite(
  agencyName: string
): Promise<DiscoveryResult> {
  const driver = buildDriver();
  const result: DiscoveryResult = {
    website: null,
    recordsRequestUrl: null,
    policyCollectionUrl: null,
  };

  try {
    const query = encodeURIComponent(
      `"${agencyName}" california official site`
    );
    const searchUrl = `https://www.google.com/search?q=${query}`;

    await driver.get(searchUrl);
    await driver.wait(until.elementLocated(By.css('#search')), 10000);

    // Extract first result link
    const results = await driver.findElements(By.css('#search a[href]'));

    for (const link of results.slice(0, 5)) {
      const href = await link.getAttribute('href');
      if (!href) continue;

      // Filter out google.com links, ads, and non-government sites
      if (href.includes('google.com')) continue;
      if (href.includes('youtube.com')) continue;
      if (href.includes('facebook.com')) continue;
      if (href.includes('twitter.com')) continue;
      if (href.includes('yelp.com')) continue;
      if (href.includes('wikipedia.org')) continue;

      // Prefer .gov, .org, .us domains
      const url = new URL(href);
      const domain = url.hostname.toLowerCase();
      if (
        domain.endsWith('.gov') ||
        domain.endsWith('.org') ||
        domain.endsWith('.us') ||
        domain.endsWith('.edu')
      ) {
        result.website = `${url.protocol}//${url.hostname}`;
        break;
      }

      // Fallback to first non-filtered result
      if (!result.website) {
        result.website = `${url.protocol}//${url.hostname}`;
      }
    }

    // If we found a website, try to find records request and policy pages
    if (result.website) {
      await discoverSubPages(driver, result);
    }
  } catch (error) {
    console.error(
      `[Website Discovery] Error discovering ${agencyName}:`,
      error instanceof Error ? error.message : error
    );
  } finally {
    await driver.quit();
  }

  return result;
}

/**
 * Given a found website, navigate to it and look for records request
 * and policy pages from the homepage links.
 */
async function discoverSubPages(
  driver: WebDriver,
  result: DiscoveryResult
): Promise<void> {
  if (!result.website) return;

  try {
    await driver.get(result.website);
    await driver.wait(until.elementLocated(By.css('body')), 10000);

    const links = await driver.findElements(By.css('a[href]'));

    for (const link of links) {
      try {
        const href = await link.getAttribute('href');
        const text = (await link.getText()).toLowerCase();
        if (!href) continue;

        // Records request detection
        if (
          text.includes('records request') ||
          text.includes('cpra') ||
          text.includes('public records') ||
          text.includes('request records') ||
          href.toLowerCase().includes('records-request') ||
          href.toLowerCase().includes('public-records')
        ) {
          result.recordsRequestUrl = href;
        }

        // Policy page detection
        if (
          text.includes('policies') ||
          text.includes('policy manual') ||
          text.includes('general orders') ||
          href.toLowerCase().includes('/policies') ||
          href.toLowerCase().includes('/policy')
        ) {
          result.policyCollectionUrl = href;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Homepage visit failed, that's okay
  }
}

/**
 * Batch discover websites for agencies that are missing them.
 * Rate-limited to avoid getting blocked.
 */
export async function batchDiscoverWebsites(
  agencies: Array<{ agencyName: string; website: string | null }>,
  delayMs: number = 3000
): Promise<Map<string, DiscoveryResult>> {
  const results = new Map<string, DiscoveryResult>();
  const missing = agencies.filter((a) => !a.website);

  console.log(
    `[Website Discovery] ${missing.length} agencies need website discovery`
  );

  for (const agency of missing) {
    console.log(
      `[Website Discovery] Searching for: ${agency.agencyName}`
    );
    const result = await discoverAgencyWebsite(agency.agencyName);
    results.set(agency.agencyName, result);

    // Rate limit
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return results;
}
