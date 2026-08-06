#!/usr/bin/env node
// Program 144 (Gold Standard) — browser verification of the admin module.
//
// Drives a real Chromium through the administrator workflow described in
// Phase 10: Administration → Gold Standard Certification → Import → Inventory
// → Classification → Processing → Results → History → Regression, with no
// command line. Also confirms the module is invisible and unreachable to a
// non-administrator.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { Results, OUT_DIR, exercisedSpaRoutes } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const BASE = process.env.CERT_WEB_BASE || 'http://127.0.0.1:4180';
const CORPUS = '/tmp/courtaccess-certification-corpus/SYNTHETIC-001';
const SHOTS = path.join(OUT_DIR, 'screenshots');
await mkdir(SHOTS, { recursive: true });

const results = new Results('GOLD_STANDARD_BROWSER', 'Program 144 — Gold Standard Browser Verification');

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });

const pageErrors = [];
context.on('page', (p) => {
  p.on('pageerror', (err) => pageErrors.push(String(err).slice(0, 200)));
});

/** Register through the UI and return the page, signed in. */
async function signUp(page, role) {
  const email = `gsui-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@certification.test`;
  await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
  await page.locator('input[name="name"], input#name').first().fill('Certification Reviewer');
  await page.locator('input[type="email"]').first().fill(email);
  const pw = page.locator('input[type="password"]');
  for (let i = 0; i < (await pw.count()); i++) await pw.nth(i).fill('CertPass!2026xyz');
  const selects = page.locator('select');
  if (await selects.count()) await selects.first().selectOption({ value: role }).catch(() => {});
  const boxes = page.locator('input[type="checkbox"]');
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check().catch(() => {});
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3500);
  return email;
}

// ---------------------------------------------------------------------------
// A non-administrator must not see or reach the module
// ---------------------------------------------------------------------------

const attorneyPage = await context.newPage();
await signUp(attorneyPage, 'attorney');

exercisedSpaRoutes.add('/admin/gold-standard');
await attorneyPage.goto(`${BASE}/admin/gold-standard`, { waitUntil: 'networkidle' });
const attorneyText = (await attorneyPage.textContent('body')) ?? '';
await attorneyPage.screenshot({ path: path.join(SHOTS, 'gold_standard_denied_attorney.png') });

const deniedInUi =
  /access denied|restricted to administrators/i.test(attorneyText) ||
  !new URL(attorneyPage.url()).pathname.startsWith('/admin/gold-standard');
const leakedContent = /Import certification case|Corpus fingerprint|certification corpora/i.test(attorneyText);

deniedInUi && !leakedContent
  ? results.pass(
      'GSUI-01',
      'An attorney is refused at the Gold Standard route and sees none of it',
      new URL(attorneyPage.url()).pathname,
    )
  : results.fail(
      'GSUI-01',
      'An attorney reached the Gold Standard module',
      `landed on ${new URL(attorneyPage.url()).pathname}; leaked content: ${leakedContent}`,
    );

// The API must refuse them too, whatever the UI does.
const attorneyApi = await attorneyPage.evaluate(async () => {
  const res = await fetch('/api/certification/status', {
    headers: { Authorization: `Bearer ${localStorage.getItem('court-access-token')}` },
  });
  return { status: res.status, body: (await res.text()).slice(0, 160) };
});
attorneyApi.status === 403
  ? results.pass('GSUI-02', 'The certification API refuses an attorney', `HTTP 403: ${attorneyApi.body.slice(0, 90)}`)
  : results.fail('GSUI-02', 'The certification API answered an attorney', `HTTP ${attorneyApi.status}`);

// The admin dashboard must not advertise the module to non-admins either.
await attorneyPage.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
// Let the router finish swapping views before reading the page.
await attorneyPage.waitForTimeout(1500);
const advertisedLinks = await attorneyPage.locator('a[href="/admin/gold-standard"]').count();
// The module's own controls, which only exist when it has rendered.
const moduleControls = await attorneyPage
  .locator('button:has-text("Import certification case"), input[placeholder="GS-001"], h1:has-text("Gold Standard Certification")')
  .count();
const adminPageText = (await attorneyPage.textContent('body')) ?? '';
const mentionIndex = adminPageText.toLowerCase().indexOf('gold standard');
const mentionContext =
  mentionIndex >= 0
    ? adminPageText.replace(/\s+/g, ' ').slice(Math.max(0, mentionIndex - 120), mentionIndex + 120)
    : '';

advertisedLinks === 0 && moduleControls === 0
  ? results.pass(
      'GSUI-03',
      'A non-administrator is offered no entry point and sees none of the module',
      `no link and none of the module's controls are present`,
      { mentionContext },
    )
  : results.fail(
      'GSUI-03',
      'A non-administrator can see part of the module',
      `${advertisedLinks} link(s), ${moduleControls} module control(s)`,
      { mentionContext },
    );

await attorneyPage.close();

// ---------------------------------------------------------------------------
// Administrator workflow
// ---------------------------------------------------------------------------

const adminPage = await context.newPage();
const adminEmail = await signUp(adminPage, 'attorney');
await prisma.user.update({ where: { email: adminEmail }, data: { role: 'admin' } });

// Re-authenticate so the session token carries the admin role.
await adminPage.evaluate(async (email) => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'CertPass!2026xyz' }),
  });
  const data = await res.json();
  localStorage.setItem('court-access-token', data.accessToken);
  const stored = JSON.parse(localStorage.getItem('court-access-auth') ?? '{"state":{}}');
  stored.state.user = data.user;
  stored.state.isAuthenticated = true;
  stored.state.subscriptionStatus = data.user?.subscriptionStatus ?? 'trial';
  localStorage.setItem('court-access-auth', JSON.stringify(stored));
}, adminEmail);

// Administration → Gold Standard Certification, by clicking, not by URL.
await adminPage.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await adminPage.screenshot({ path: path.join(SHOTS, 'gold_standard_admin_entry.png') });

const entryLink = adminPage.locator('a:has-text("Gold Standard Certification")').first();
if (await entryLink.count()) {
  results.pass('GSUI-04', 'Administration offers a Gold Standard Certification entry point', 'link present on /admin');
  await entryLink.click();
  await adminPage.waitForLoadState('networkidle');
} else {
  results.fail('GSUI-04', 'No entry point to the module from Administration', 'link not found on /admin');
  await adminPage.goto(`${BASE}/admin/gold-standard`, { waitUntil: 'networkidle' });
}

// Wait for the module heading itself rather than reading mid-render.
await adminPage
  .locator('h1:has-text("Gold Standard Certification")')
  .first()
  .waitFor({ timeout: 20000 })
  .catch(() => {});
const moduleText = (await adminPage.textContent('body')) ?? '';
await adminPage.screenshot({ path: path.join(SHOTS, 'gold_standard_module.png') });

/Gold Standard Certification/i.test(moduleText) && /Administrator-only module/i.test(moduleText)
  ? results.pass('GSUI-05', 'The module opens for an administrator and states its restriction', 'header and notice rendered')
  : results.fail('GSUI-05', 'The module did not render for an administrator', moduleText.slice(0, 200));

// Step rail: the workflow Phase 10 describes.
const railLabels = ['Corpora', 'Import', 'Inventory', 'Results', 'History & Regression'];
const missingSteps = [];
for (const l of railLabels) {
  if (!(await adminPage.locator(`button:has-text("${l}")`).count())) missingSteps.push(l);
}
missingSteps.length === 0
  ? results.pass('GSUI-06', 'The administrator workflow is presented as steps', railLabels.join(' → '))
  : results.fail('GSUI-06', 'Workflow steps are missing', missingSteps.join(', '));

// --- Import wizard ---------------------------------------------------------

await adminPage.locator('button:has-text("Import")').first().click();
await adminPage.waitForTimeout(600);

const reference = `UI-${Date.now().toString().slice(-6)}`;
await adminPage.locator('input[placeholder="GS-001"]').fill(reference);
await adminPage.locator('input[placeholder*="certification corpus"]').fill('Browser-verified corpus');
await adminPage.locator('input[placeholder*="/srv/courtaccess"]').fill(CORPUS);
await adminPage.screenshot({ path: path.join(SHOTS, 'gold_standard_import_form.png') });

await adminPage.locator('button:has-text("Preview folder")').click();
await adminPage.waitForTimeout(6000);
const previewText = (await adminPage.textContent('body')) ?? '';
await adminPage.screenshot({ path: path.join(SHOTS, 'gold_standard_preview.png') });

/\b32 file\(s\)/.test(previewText) || /\d+ file\(s\),/.test(previewText)
  ? results.pass(
      'GSUI-07',
      'Preview lists the delivery before anything is imported',
      (previewText.match(/\d+ file\(s\), [\d.]+ [KMG]?B/) ?? ['counts shown'])[0],
    )
  : results.fail('GSUI-07', 'Preview produced no file listing', previewText.slice(0, 200));

/in archive/i.test(previewText)
  ? results.pass('GSUI-08', 'Files inside a delivered archive are shown individually in the preview')
  : results.warn('GSUI-08', 'The preview did not mark any archive members', 'expected the nested ZIP to be expanded');

await adminPage.locator('button:has-text("Import")').last().click();
// Import ingests and processes every file; give it room.
await adminPage.waitForTimeout(45000);
const inventoryText = (await adminPage.textContent('body')) ?? '';
await adminPage.screenshot({ path: path.join(SHOTS, 'gold_standard_inventory.png'), fullPage: false });

/Document classification/i.test(inventoryText)
  ? results.pass('GSUI-09', 'Import completes and lands on the inventory', 'classification panel rendered')
  : results.fail('GSUI-09', 'Import did not reach the inventory', inventoryText.slice(0, 250));

// The inventory must show the counts Phase 3 asks for.
const inventoryFacts = ['Files', 'Size', 'Documents', 'Video', 'Audio', 'Images', 'Duplicates'];
const missingFacts = inventoryFacts.filter((f) => !inventoryText.includes(f));
missingFacts.length === 0
  ? results.pass('GSUI-10', 'The inventory reports totals, media breakdown and duplicates', inventoryFacts.join(', '))
  : results.fail('GSUI-10', 'The inventory is missing required counts', missingFacts.join(', '));

/police report|transcript|laboratory report/i.test(inventoryText)
  ? results.pass('GSUI-11', 'Mixed discovery is shown separated into document types', 'classes visible in the inventory')
  : results.fail('GSUI-11', 'No document classification is shown', inventoryText.slice(0, 200));

// --- Run the certification -------------------------------------------------

const runButton = adminPage.locator('button:has-text("Run certification")').first();
if (await runButton.count()) {
  await runButton.click();
  await adminPage.waitForTimeout(30000);
  const resultsText = (await adminPage.textContent('body')) ?? '';
  await adminPage.screenshot({ path: path.join(SHOTS, 'gold_standard_results.png') });

  /Pages indexed/i.test(resultsText) && /Timeline events/i.test(resultsText)
    ? results.pass(
        'GSUI-12',
        'A certification run completes and reports what the pipeline produced',
        'pages, timeline events and graph nodes shown',
      )
    : results.fail('GSUI-12', 'The certification results did not render', resultsText.slice(0, 250));

  /CALCRIM and mens rea/i.test(resultsText)
    ? results.pass('GSUI-13', 'CALCRIM and mens rea coverage is reported')
    : results.fail('GSUI-13', 'CALCRIM and mens rea coverage is missing from the results');

  /Recorded as UNKNOWN|Processing failures|Baseline established/i.test(resultsText)
    ? results.pass('GSUI-14', 'UNKNOWN findings and failures are surfaced rather than hidden')
    : results.warn('GSUI-14', 'Neither UNKNOWNs nor failures were shown', 'the corpus may have produced none');
} else {
  results.fail('GSUI-12', 'No control to run a certification', 'button not found on the inventory');
}

// --- History and regression ------------------------------------------------

await adminPage.locator('button:has-text("Corpora")').first().click();
await adminPage.waitForTimeout(1500);
const corporaText = (await adminPage.textContent('body')) ?? '';
await adminPage.screenshot({ path: path.join(SHOTS, 'gold_standard_corpora.png') });

corporaText.includes(reference)
  ? results.pass('GSUI-15', 'The imported corpus is listed and retained', `reference ${reference} shown`)
  : results.fail('GSUI-15', 'The imported corpus is not listed', corporaText.slice(0, 200));

const historyLink = adminPage.locator('button:has-text("History")').last();
await historyLink.click();
await adminPage.waitForTimeout(2500);
const historyText = (await adminPage.textContent('body')) ?? '';
await adminPage.screenshot({ path: path.join(SHOTS, 'gold_standard_history.png') });

/baseline|Build|Differences/i.test(historyText)
  ? results.pass('GSUI-16', 'Run history with baseline and regression status is shown', 'history table rendered')
  : results.fail('GSUI-16', 'Run history did not render', historyText.slice(0, 200));

// ---------------------------------------------------------------------------

pageErrors.length === 0
  ? results.pass('GSUI-17', 'No uncaught JavaScript exceptions across the workflow')
  : results.fail('GSUI-17', 'Uncaught JavaScript exceptions occurred', pageErrors.slice(0, 3).join(' | '));

await browser.close();
await results.write({ base: BASE, corpus: CORPUS, reference, screenshotDirectory: SHOTS, pageErrors });
await prisma.$disconnect();
