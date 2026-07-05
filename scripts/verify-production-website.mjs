#!/usr/bin/env node
/**
 * Priority Zero — Production website verification (courtaccess.net)
 * Run after deploy: node scripts/verify-production-website.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://courtaccess.net';
const OUT_DIR = process.env.OUT_DIR || '/workspace/reports/screenshots/production';

const CHECKS = {
  title: 'Criminal Case Intelligence Platform',
  staleTitle: 'Court Access System',
  staleBundle: 'Loading Court Access',
  buildStamp: 'CourtAccess build:',
  heroText: 'Criminal Case May Have Defenses',
};

async function fetchHtml() {
  const res = await fetch(PRODUCTION_URL, { redirect: 'follow' });
  return { status: res.status, html: await res.text(), headers: Object.fromEntries(res.headers) };
}

const result = {
  program: 'PRIORITY-ZERO',
  verifiedAt: new Date().toISOString(),
  url: PRODUCTION_URL,
  checks: [],
  screenshots: [],
  status: 'FAIL',
  errors: [],
};

try {
  const { status, html, headers } = await fetchHtml();

  const titleOk = html.includes(CHECKS.title);
  const staleTitle = html.includes(CHECKS.staleTitle);
  const staleBundle = html.includes(CHECKS.staleBundle);
  const buildStamp = html.includes(CHECKS.buildStamp);
  const lastModified = headers['last-modified'] ?? headers['Last-Modified'] ?? null;

  result.checks.push({ name: 'http_status', pass: status === 200, value: status });
  result.checks.push({ name: 'title_branding', pass: titleOk, expected: CHECKS.title });
  result.checks.push({ name: 'no_stale_title', pass: !staleTitle, value: staleTitle ? CHECKS.staleTitle : 'absent' });
  result.checks.push({ name: 'no_stale_bundle', pass: !staleBundle, value: staleBundle ? 'present' : 'absent' });
  result.checks.push({ name: 'build_stamp', pass: buildStamp, optional: true });
  result.checks.push({ name: 'last_modified', pass: true, value: lastModified });

  if (!titleOk) result.errors.push('Production title missing Criminal Case Intelligence Platform branding');
  if (staleTitle) result.errors.push('Production still serves stale Court Access System title');
  if (staleBundle) result.errors.push('Production bundle contains Loading Court Access string');

  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle', timeout: 60000 });
    const bodyText = await page.textContent('body');
    const heroOk = Boolean(bodyText?.includes(CHECKS.heroText) || bodyText?.includes(CHECKS.title));
    result.checks.push({ name: 'hero_content', pass: heroOk });

    const desktopPath = `${OUT_DIR}/production-landing-desktop.png`;
    await page.screenshot({ path: desktopPath, fullPage: true });
    result.screenshots.push(desktopPath);

    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobilePage.goto(PRODUCTION_URL, { waitUntil: 'networkidle', timeout: 60000 });
    const mobilePath = `${OUT_DIR}/production-landing-mobile.png`;
    await mobilePage.screenshot({ path: mobilePath, fullPage: true });
    result.screenshots.push(mobilePath);

    if (!heroOk) result.errors.push('Landing page missing expected hero content');
  } finally {
    await browser.close();
  }

  const criticalPass = result.checks
    .filter((c) => !c.optional)
    .every((c) => c.pass);

  result.status = criticalPass && result.errors.length === 0 ? 'PASS' : 'FAIL';
} catch (err) {
  result.errors.push(err instanceof Error ? err.message : String(err));
  result.status = 'FAIL';
}

const reportPath = '/workspace/reports/PRODUCTION_WEBSITE_VERIFY.json';
writeFileSync(reportPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exit(result.status === 'PASS' ? 0 : 1);
