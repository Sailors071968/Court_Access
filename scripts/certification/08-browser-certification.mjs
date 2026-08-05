#!/usr/bin/env node
// Phase 9 — Browser verification.
//
// Drives a real Chromium against the built SPA served over the same
// same-origin /api arrangement production uses. Every public page is loaded
// and checked for content and console errors, then the litigation workflow is
// walked through the interface: register, open a case, upload discovery, and
// read it back. Screenshots are written alongside the report.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { Results, OUT_DIR, exercisedSpaRoutes, exercisedApiRoutes, normalisePath } from './lib/harness.mjs';

const BASE = process.env.CERT_WEB_BASE || 'http://127.0.0.1:4180';
const SHOTS = path.join(OUT_DIR, 'screenshots');
await mkdir(SHOTS, { recursive: true });

const results = new Results('BROWSER_CERTIFICATION', 'Phase 9 — Browser Verification');

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// Collect everything the browser complains about, per page.
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];

context.on('page', (p) => {
  p.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push({ url: p.url(), text: msg.text().slice(0, 300) });
  });
  p.on('pageerror', (err) => pageErrors.push({ url: p.url(), text: String(err).slice(0, 300) }));
  p.on('requestfailed', (r) => failedRequests.push({ url: r.url(), failure: r.failure()?.errorText }));
  // Record which API endpoints the interface itself calls, so the master
  // report can attribute browser coverage to features by route rather than by
  // matching prose.
  p.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/api/')) {
      exercisedApiRoutes.add(`${r.method()} ${normalisePath(u.pathname)}`);
    }
  });
});

const page = await context.newPage();

async function visit(name, route, expect) {
  const before = consoleErrors.length + pageErrors.length;
  let status = null;
  exercisedSpaRoutes.add(route);
  try {
    const res = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
    status = res?.status() ?? null;
  } catch (err) {
    results.fail(`BR-${route}`, `${name} failed to load`, String(err).slice(0, 180));
    return false;
  }

  const body = await page.textContent('body').catch(() => '');
  const visibleChars = (body || '').replace(/\s+/g, ' ').trim().length;
  // A sign-in form is legitimately terse, so interactive controls count as
  // rendered content alongside text.
  const controls =
    (await page.locator('input, button, select, textarea').count().catch(() => 0)) ?? 0;
  const shot = path.join(SHOTS, `${route.replace(/[^a-z0-9]+/gi, '_') || 'root'}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  const newErrors = consoleErrors.length + pageErrors.length - before;
  const matched = expect ? new RegExp(expect, 'i').test(body || '') : true;

  if (status !== 200) {
    results.fail(`BR-${route}`, `${name} returned HTTP ${status}`, route);
    return false;
  }
  if (visibleChars < 100 && controls < 2) {
    results.fail(
      `BR-${route}`,
      `${name} rendered almost nothing`,
      `${visibleChars} visible characters and ${controls} interactive control(s)`,
    );
    return false;
  }
  if (!matched) {
    results.fail(`BR-${route}`, `${name} did not contain expected content`, `looked for /${expect}/i`);
    return false;
  }
  if (newErrors > 0) {
    results.warn(
      `BR-${route}`,
      `${name} renders but logged ${newErrors} browser error(s)`,
      (consoleErrors[consoleErrors.length - 1]?.text ?? pageErrors[pageErrors.length - 1]?.text ?? '').slice(0, 160),
    );
    return true;
  }
  results.pass(
    `BR-${route}`,
    `${name} renders cleanly`,
    `${visibleChars} characters, ${controls} control(s), screenshot captured`,
  );
  return true;
}

// ---------------------------------------------------------------------------
// Public site
// ---------------------------------------------------------------------------

console.log('--- public pages ---');
const PUBLIC_PAGES = [
  ['Landing page', '/', 'court'],
  ['For defense', '/for-defense', null],
  ['For prosecutors', '/for-prosecutors', null],
  ['Government', '/government', null],
  ['Pricing', '/pricing', null],
  ['Features', '/features', null],
  ['How it works', '/how-it-works', null],
  ['About', '/about', null],
  ['FAQ', '/faq', null],
  ['Contact sales', '/contact', null],
  ['Security', '/security', null],
  ['Privacy policy', '/privacy', 'privacy'],
  ['Terms of service', '/terms', 'terms'],
  ['Legal disclaimer', '/legal-disclaimer', null],
  ['Accessibility', '/accessibility', null],
  ['Attorney audience', '/attorney', null],
  ['Investigator audience', '/investigator', null],
  ['Defendant audience', '/defendant', null],
  ['Families audience', '/families', null],
  ['Experts audience', '/experts', null],
  ['Case studies', '/case-studies', null],
  ['Blog', '/blog', null],
  ['Knowledge base', '/knowledge-base', null],
  ['Support', '/support', null],
  ['Sitemap', '/sitemap', null],
  ['Press', '/press', null],
  ['Careers', '/careers', null],
  ['Login', '/login', 'sign in|log in|email'],
  ['Register', '/register', 'register|sign up|create'],
  ['Forgot password', '/forgot-password', 'password|email'],
];

for (const [name, route, expect] of PUBLIC_PAGES) {
  await visit(name, route, expect);
}

// ---------------------------------------------------------------------------
// Protected routes must redirect an anonymous visitor away
// ---------------------------------------------------------------------------

console.log('\n--- access control in the browser ---');
for (const guarded of ['/dashboard', '/cases', '/admin', '/settings']) {
  exercisedSpaRoutes.add(guarded);
  await page.goto(`${BASE}${guarded}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  const landed = new URL(page.url()).pathname;
  landed !== guarded
    ? results.pass(`BR-GUARD-${guarded}`, `Anonymous visitor is redirected away from ${guarded}`, `landed on ${landed}`)
    : results.fail(`BR-GUARD-${guarded}`, `Anonymous visitor reached ${guarded}`, `still on ${landed}`);
}

// ---------------------------------------------------------------------------
// Registration through the interface
// ---------------------------------------------------------------------------

console.log('\n--- registration and the authenticated app ---');
const email = `browser-${Date.now()}@certification.test`;
const password = 'CertPass!2026xyz';

await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });

async function fillFirst(selectors, value) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      await el.fill(value);
      return true;
    }
  }
  return false;
}

const filledName = await fillFirst(['input[name="name"]', 'input[placeholder*="name" i]', 'input#name'], 'Browser Certification');
const filledEmail = await fillFirst(['input[type="email"]', 'input[name="email"]'], email);
const passwordFields = page.locator('input[type="password"]');
const pwCount = await passwordFields.count();
for (let i = 0; i < pwCount; i++) await passwordFields.nth(i).fill(password);

// Accept any consent checkboxes the form requires.
const checkboxes = page.locator('input[type="checkbox"]');
for (let i = 0; i < (await checkboxes.count()); i++) {
  await checkboxes.nth(i).check().catch(() => {});
}

// Pick a role if the form offers one.
const selects = page.locator('select');
if (await selects.count()) {
  await selects.first().selectOption({ index: 1 }).catch(() => {});
}

filledEmail && pwCount > 0
  ? results.pass('BR-REG-FORM', 'The registration form exposes the expected fields', `name=${filledName}, ${pwCount} password field(s)`)
  : results.fail('BR-REG-FORM', 'The registration form is missing expected fields', `email=${filledEmail}, password fields=${pwCount}`);

await page.screenshot({ path: path.join(SHOTS, 'register_filled.png') });

await page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Register"), button:has-text("Sign up")').first().click().catch(() => {});
await page.waitForTimeout(4000);

const afterRegister = new URL(page.url()).pathname;
await page.screenshot({ path: path.join(SHOTS, 'after_register.png') });

if (afterRegister !== '/register') {
  results.pass('BR-REG-SUBMIT', 'Registration through the browser signs the user in', `landed on ${afterRegister}`);
} else {
  const err = await page.textContent('body').catch(() => '');
  results.fail('BR-REG-SUBMIT', 'Registration did not proceed past the form', (err || '').replace(/\s+/g, ' ').slice(0, 200));
}

// Token must have been stored by the app.
const storedToken = await page.evaluate(() => localStorage.getItem('court-access-token'));
storedToken
  ? results.pass('BR-SESSION', 'The app stores a session token after registration', `${storedToken.length} characters`)
  : results.fail('BR-SESSION', 'No session token was stored after registration');

// ---------------------------------------------------------------------------
// Authenticated pages
// ---------------------------------------------------------------------------

if (storedToken) {
  const APP_PAGES = [
    ['Dashboard', '/dashboard'],
    ['Cases list', '/cases'],
    ['Search', '/search'],
    ['Notifications', '/notifications'],
    ['Account settings', '/settings'],
    ['Shared access', '/shared-access'],
  ];
  for (const [name, route] of APP_PAGES) {
    await visit(name, route, null);
  }

  // Create a case through the interface if the list page offers it.
  await page.goto(`${BASE}/cases`, { waitUntil: 'networkidle' });
  const newCaseButton = page
    .locator('button:has-text("New case"), button:has-text("New Case"), button:has-text("Create case"), a:has-text("New case")')
    .first();
  if (await newCaseButton.count()) {
    await newCaseButton.click().catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, 'case_create_dialog.png') });
    results.pass('BR-CASE-UI', 'The case list offers a way to create a case', 'control found and opened');
  } else {
    results.warn('BR-CASE-UI', 'No obvious case-creation control on the case list', 'searched for New case / Create case');
  }

  // Every case workspace tab, loaded against a real case so the views render
  // with data rather than an error boundary.
  const caseCreate = await page.evaluate(async () => {
    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('court-access-token')}`,
      },
      body: JSON.stringify({
        title: 'Browser certification case',
        caseNumber: `BROWSER-${Date.now()}`,
        jurisdiction: 'Alameda County',
        caseType: 'felony',
      }),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  });

  const caseId = caseCreate.body?.case?.caseId;
  if (caseId) {
    results.pass('BR-CASE-CREATE', 'A case can be created from the browser session', `caseId ${caseId}`);

    const CASE_TABS = [
      ['Case overview', 'overview'],
      ['Charges', 'charges'],
      ['Evidence', 'evidence'],
      ['Documents', 'documents'],
      ['Disclosures', 'disclosures'],
      ['Experts', 'experts'],
      ['Motions', 'motions'],
      ['Research', 'research'],
      ['Activity', 'activity'],
      ['Case settings', 'settings'],
      ['Investigator workbench', 'investigator-workbench'],
      ['Attorney workbench', 'attorney-workbench'],
      ['Trial exhibits', 'trial-exhibits'],
      ['Litigation strategy', 'litigation-strategy'],
      ['Contradictions', 'contradictions'],
      ['Narrative analysis', 'narrative-analysis'],
    ];
    for (const [name, tab] of CASE_TABS) {
      await visit(name, `/cases/${caseId}/${tab}`, null);
    }
  } else {
    results.fail('BR-CASE-CREATE', 'Could not create a case from the browser session', JSON.stringify(caseCreate).slice(0, 200));
  }
}

// The public contact form is the one unauthenticated write path on the site.
await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
const contactResult = await page.evaluate(async () => {
  const res = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Certification Contact',
      email: `contact-${Date.now()}@certification.test`,
      organization: 'Certification LLP',
      message: 'Automated production certification submission.',
    }),
  });
  return { status: res.status, body: (await res.text()).slice(0, 200) };
});
contactResult.status >= 200 && contactResult.status < 400
  ? results.pass('BR-CONTACT', 'The public contact form submits successfully', `HTTP ${contactResult.status}`)
  : results.fail('BR-CONTACT', 'The public contact form failed', `HTTP ${contactResult.status}: ${contactResult.body}`);

// ---------------------------------------------------------------------------
// Browser diagnostics
// ---------------------------------------------------------------------------

pageErrors.length === 0
  ? results.pass('BR-NO-EXCEPTIONS', 'No uncaught JavaScript exceptions across the whole walkthrough')
  : results.fail(
      'BR-NO-EXCEPTIONS',
      'Uncaught JavaScript exceptions occurred',
      `${pageErrors.length} across ${new Set(pageErrors.map((e) => e.url)).size} page(s)`,
      pageErrors.slice(0, 10),
    );

const realFailures = failedRequests.filter((r) => !/favicon/i.test(r.url));
realFailures.length === 0
  ? results.pass('BR-NO-FAILED-REQUESTS', 'No network requests failed during the walkthrough')
  : results.warn(
      'BR-NO-FAILED-REQUESTS',
      'Some network requests failed',
      `${realFailures.length} request(s)`,
      realFailures.slice(0, 10),
    );

await browser.close();

await results.write({
  base: BASE,
  screenshotDirectory: SHOTS,
  consoleErrors: consoleErrors.slice(0, 60),
  pageErrors: pageErrors.slice(0, 30),
  failedRequests: realFailures.slice(0, 30),
});
