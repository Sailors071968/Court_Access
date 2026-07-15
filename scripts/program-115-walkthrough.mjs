// ============================================================================
// Program 115 — Staging browser walkthrough.
// Loads the running staging build, captures full-page screenshots and console
// errors for public + authenticated routes. Produces a JSON verification report.
//   BASE  (default http://localhost:8080)
// ============================================================================

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.env.OUT || 'reports/screenshots/program-115';
mkdirSync(OUT, { recursive: true });

const CREDS = {
  email: process.env.REVIEW_EMAIL || 'reviewer2@staging.courtaccess.test',
  password: process.env.REVIEW_PASSWORD || 'StagingPass1!',
};
const CASE_ID = process.env.CASE_ID || 'case-stg-0001';

const publicRoutes = [
  ['landing', '/'],
  ['for-defense', '/for-defense'],
  ['features', '/features'],
  ['how-it-works', '/how-it-works'],
  ['pricing', '/pricing'],
  ['security', '/security'],
  ['knowledge-base', '/knowledge-base'],
  ['accessibility', '/accessibility'],
  ['login', '/login'],
  ['register', '/register'],
];

const authRoutes = [
  ['dashboard', '/dashboard'],
  ['cases', '/cases'],
  ['search', '/search'],
  ['settings', '/settings'],
  ['collaborators-shared-access', '/shared-access'],
  ['administration', '/admin'],
  ['admin-operations', '/admin/operations'],
  ['provider-system-health', '/dashboard/system-health'],
  ['usage', '/dashboard/usage'],
  ['case-overview', `/cases/${CASE_ID}/overview`],
  ['case-intake-charges', `/cases/${CASE_ID}/charges`],
  ['evidence-workspace', `/cases/${CASE_ID}/evidence`],
  ['timeline', `/cases/${CASE_ID}/dashboard/case-timeline`],
  ['strategy-center', `/cases/${CASE_ID}/strategy-center`],
  ['attorney-workbench', `/cases/${CASE_ID}/attorney-workbench`],
  ['calcrim-intelligence', `/cases/${CASE_ID}/calcrim-intelligence`],
  ['defense-opportunities', `/cases/${CASE_ID}/defense-opportunities`],
  ['defense-intelligence', `/cases/${CASE_ID}/defense-intelligence`],
  ['trial-notebook', `/cases/${CASE_ID}/trial-notebook`],
  ['evidence-intelligence', `/cases/${CASE_ID}/evidence-intelligence`],
  ['prosecution-weakness', `/cases/${CASE_ID}/prosecution-weakness`],
  ['investigation-opportunities', `/cases/${CASE_ID}/investigation-opportunities`],
  ['contradiction-workspace', `/cases/${CASE_ID}/contradictions`],
  ['narrative-analysis', `/cases/${CASE_ID}/narrative-analysis`],
  ['litigation-strategy', `/cases/${CASE_ID}/litigation-strategy`],
  ['documents', `/cases/${CASE_ID}/documents`],
  ['motions', `/cases/${CASE_ID}/motions`],
  ['research', `/cases/${CASE_ID}/research`],
];

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDS),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  return res.json();
}

async function capture(page, label, path, report) {
  const errors = [];
  const onConsole = (msg) => { if (msg.type() === 'error') errors.push(msg.text()); };
  const onPageError = (err) => errors.push(`pageerror: ${err.message}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  let status = 'ok';
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);
  } catch (e) {
    status = `nav-error: ${e.message}`;
  }
  const file = join(OUT, `${label}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  const title = await page.title().catch(() => '');
  report.push({ label, path, title, status, consoleErrors: errors });
  console.log(`[${status === 'ok' ? 'OK ' : 'ERR'}] ${label.padEnd(28)} ${path.padEnd(42)} errors=${errors.length}`);
  return errors;
}

const run = async () => {
  const auth = await login();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const report = [];

  // Public pages first (no session).
  for (const [label, path] of publicRoutes) await capture(page, label, path, report);

  // Seed authenticated session into localStorage (zustand persist + raw token).
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ auth }) => {
    localStorage.setItem('court-access-token', auth.accessToken);
    localStorage.setItem('court-access-refresh-token', auth.refreshToken);
    localStorage.setItem('court-access-auth', JSON.stringify({
      state: { user: auth.user, isAuthenticated: true, subscriptionStatus: auth.user.subscriptionStatus || 'trial' },
      version: 0,
    }));
  }, { auth });

  for (const [label, path] of authRoutes) await capture(page, label, path, report);

  writeFileSync(join(OUT, 'verification-report.json'), JSON.stringify({
    base: BASE,
    generatedAt: new Date().toISOString(),
    totalPages: report.length,
    pagesWithConsoleErrors: report.filter(r => r.consoleErrors.length > 0).length,
    results: report,
  }, null, 2));

  await browser.close();
  const withErrors = report.filter(r => r.consoleErrors.length > 0).length;
  console.log(`\nCaptured ${report.length} pages; ${withErrors} with console errors.`);
};

run().catch((e) => { console.error(e); process.exit(1); });
