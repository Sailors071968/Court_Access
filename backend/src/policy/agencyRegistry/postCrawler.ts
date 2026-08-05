// ---------------------------------------------------------------------------
// Phase 1 — POST Directory Crawler (Headless Selenium)
// Extracts California law enforcement agencies from https://post.ca.gov/le-agencies
// ---------------------------------------------------------------------------

import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { PostAgencyEntry, AgencyType } from './types.js';

const POST_DIRECTORY_URL = 'https://post.ca.gov/le-agencies';

/**
 * Build a headless Chrome WebDriver instance.
 */
// Builder.build() returns a thenable driver that begins creating the session
// immediately. Returning it unawaited leaves the session-creation rejection
// (for example a ChromeDriver/Chrome version mismatch) with no handler
// attached, which terminates the process rather than failing the request.
async function buildDriver(): Promise<WebDriver> {
  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--disable-gpu');
  options.addArguments('--window-size=1920,1080');
  options.addArguments(
    '--user-agent=CourtAccess-PolicyCrawler/1.0 (Legal Research)'
  );

  return new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();
}

/**
 * Crawl the POST directory and extract all agency entries.
 */
export async function crawlPostDirectory(): Promise<PostAgencyEntry[]> {
  const driver = await buildDriver();
  const agencies: PostAgencyEntry[] = [];

  try {
    console.log(`[POST Crawler] Navigating to ${POST_DIRECTORY_URL}`);
    await driver.get(POST_DIRECTORY_URL);

    // Wait for the main content to load
    await driver.wait(until.elementLocated(By.css('main')), 15000);

    // Extract all list items from the agency listings (inside <main> <ul> <li>)
    const listItems = await driver.findElements(By.css('main ul li'));
    console.log(`[POST Crawler] Found ${listItems.length} list items`);

    for (const li of listItems) {
      try {
        const html = await li.getAttribute('innerHTML');
        const text = await li.getText();

        // Skip empty entries
        if (!text.trim()) continue;

        // Extract links
        const links = await li.findElements(By.css('a'));
        let website: string | null = null;
        let agencyName = text.trim();

        if (links.length > 0) {
          const firstLink = links[0];
          website = await firstLink.getAttribute('href');
          const linkText = await firstLink.getText();
          // Use link text as agency name (cleaner than full li text)
          if (linkText.trim()) {
            agencyName = linkText
              .replace(/\(external link\)/gi, '')
              .trim();
          }
        }

        // Detect non-participating agencies
        const isPostParticipating = !text.includes(
          'not a POST participating agency'
        );

        // Detect contract cities
        let contractCity: string | null = null;
        const contractMatch = text.match(
          /contract (?:city|agency),?\s*see\s+(.+?)(?:\(|$)/i
        );
        if (contractMatch) {
          contractCity = contractMatch[1].trim();
        }

        // Detect "see also" references (e.g., "see Los Rios Community College")
        const seeMatch = text.match(/\(see\s+(.+?)(?:\)|$)/i);
        if (seeMatch && !contractCity) {
          contractCity = seeMatch[1].trim();
        }

        // Clean up agency name — remove annotations
        agencyName = agencyName
          .replace(/\(not a POST participating agency\)/gi, '')
          .replace(/\(contract (?:city|agency).*?\)/gi, '')
          .replace(/\(see .*?\)/gi, '')
          .replace(/\(external link\)/gi, '')
          .replace(/\*$/g, '')
          .trim();

        // Skip entries that are just references or empty
        if (!agencyName || agencyName.length < 3) continue;
        // Skip entries that start with "see" (pure references)
        if (/^see\s/i.test(agencyName)) continue;

        agencies.push({
          agencyName,
          website: website && website.startsWith('http') ? website : null,
          postDirectoryUrl: POST_DIRECTORY_URL,
          isPostParticipating,
          contractCity,
        });
      } catch {
        // Skip individual items that fail to parse
        continue;
      }
    }

    console.log(
      `[POST Crawler] Extracted ${agencies.length} agencies from POST directory`
    );
  } finally {
    // Never let teardown mask the original failure.
    await driver.quit().catch(() => {});
  }

  return deduplicateAgencies(agencies);
}

/**
 * Remove duplicate entries (same agency name).
 */
function deduplicateAgencies(agencies: PostAgencyEntry[]): PostAgencyEntry[] {
  const seen = new Set<string>();
  return agencies.filter((a) => {
    const key = a.agencyName.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Infer agency type from the agency name.
 */
export function inferAgencyType(name: string): AgencyType {
  const lower = name.toLowerCase();

  // State agencies (CA prefix or state-level)
  if (lower.startsWith('ca ') || lower.startsWith('ca-')) return 'State';
  if (lower.includes('california highway patrol')) return 'State';
  if (lower.includes('department of justice')) return 'State';
  if (lower.includes('attorney general')) return 'State';
  if (lower.includes('state hospital')) return 'State';
  if (lower.includes('state lottery')) return 'State';
  if (lower.includes('franchise tax')) return 'State';
  if (lower.includes('department of corrections')) return 'State';
  if (lower.includes('department of fish')) return 'State';
  if (lower.includes('department of parks')) return 'State';
  if (lower.includes('department of motor')) return 'State';
  if (lower.includes('department of insurance')) return 'State';
  if (lower.includes('department of consumer')) return 'State';
  if (lower.includes('department of cannabis')) return 'State';
  if (lower.includes('alcoholic beverage')) return 'State';
  if (lower.includes('horse racing')) return 'State';
  if (lower.includes('national guard')) return 'State';
  if (lower.includes('secretary of state')) return 'State';
  if (lower.includes('state controller')) return 'State';
  if (lower.includes('state public defender')) return 'State';
  if (lower.includes('senate sergeant')) return 'State';
  if (lower.includes('assembly sergeant')) return 'State';
  if (lower.includes('exposition park')) return 'State';
  if (lower.includes('cal fire')) return 'State';
  if (lower.includes('emergency services')) return 'State';
  if (lower.includes('industrial relations')) return 'State';
  if (lower.includes('development services')) return 'State';
  if (lower.includes('toxic substances')) return 'State';

  // Sheriff
  if (lower.includes('sheriff')) return 'Sheriff';

  // District Attorney
  if (lower.includes('district attorney')) return 'District_Attorney';

  // Coroner / Medical Examiner
  if (lower.includes('coroner') || lower.includes('medical examiner'))
    return 'Coroner';

  // Probation
  if (lower.includes('probation')) return 'Probation';

  // University / College
  if (
    lower.includes('university') ||
    lower.includes('csu ') ||
    lower.includes('uc ') ||
    lower.includes('cpsu ') ||
    lower.startsWith('uc ') ||
    lower.includes('campus safety') ||
    lower.includes('campus security')
  )
    return 'University';

  // Community College
  if (
    lower.includes('community college') ||
    lower.includes('college police') ||
    lower.includes('college district police') ||
    lower.includes('college department of public safety')
  )
    return 'Community_College';

  // School District
  if (
    lower.includes('school district') ||
    lower.includes('unified school') ||
    lower.includes('school police')
  )
    return 'School_District';

  // Transit
  if (
    lower.includes('transit') ||
    lower.includes('bart') ||
    lower.includes('rail') ||
    lower.includes('railroad') ||
    lower.includes('railway') ||
    lower.includes('amtrak')
  )
    return 'Transit';

  // Airport
  if (lower.includes('airport')) return 'Airport';

  // Harbor / Port
  if (
    lower.includes('harbor') ||
    lower.includes('port of') ||
    lower.includes('port police')
  )
    return 'Harbor';

  // Park Ranger
  if (
    lower.includes('park ranger') ||
    lower.includes('regional park') ||
    lower.includes('parks department')
  )
    return 'Park_Ranger';

  // Communications
  if (
    lower.includes('communications') ||
    lower.includes('911') ||
    lower.includes('dispatch')
  )
    return 'Communications';

  // Default to Police for most city departments
  if (
    lower.includes('police') ||
    lower.includes('public safety') ||
    lower.includes('department of public safety') ||
    lower.includes('marshal')
  )
    return 'Police';

  // Human Services / Special Investigations
  if (
    lower.includes('human services') ||
    lower.includes('investigation') ||
    lower.includes('special investigation')
  )
    return 'Other';

  return 'Other';
}

/**
 * Infer city from agency name.
 */
export function inferCity(name: string): string | null {
  const lower = name.toLowerCase();

  // State agencies don't have a city
  if (lower.startsWith('ca ') || lower.startsWith('ca-')) return null;

  // County-level agencies: extract county name
  const countyMatch = name.match(/^(.+?)\s+County\s/i);
  if (countyMatch) return null; // County-level, not city-level

  // City police departments: extract city name
  const cityPatterns = [
    /^(.+?)\s+Police\s+Department/i,
    /^(.+?)\s+Department\s+of\s+Public\s+Safety/i,
    /^(.+?)\s+Public\s+Safety/i,
    /^(.+?)\s+Police\s+Services/i,
    /^(.+?)\s+Marshal/i,
  ];

  for (const pattern of cityPatterns) {
    const match = name.match(pattern);
    if (match) {
      const city = match[1].trim();
      // Don't return county names as cities
      if (!city.toLowerCase().includes('county')) return city;
    }
  }

  return null;
}

/**
 * Infer county from agency name.
 */
export function inferCounty(name: string): string | null {
  const countyMatch = name.match(/^(.+?)\s+County\s/i);
  if (countyMatch) return countyMatch[1].trim();

  // Some agencies have county in parentheses or other formats
  return null;
}
