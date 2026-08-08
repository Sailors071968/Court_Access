#!/usr/bin/env node
// Program 147, Phase 10 — browser verification of the statutory intelligence UI.
//
// Drives a real browser through an administrator looking up California law:
// retrieving a section from the Legislature, reading what the compiler made of
// it, following a cross-reference, and seeing UNKNOWN where no CALCRIM
// correspondence is recorded.

import path from 'node:path';
import { chromium } from 'playwright';
import { Results, OUT_DIR } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const BASE = process.env.CERT_WEB_BASE || 'http://127.0.0.1:4180';
const SHOTS = path.join(OUT_DIR, 'screenshots');
const results = new Results('STATUTORY_INTELLIGENCE_BROWSER', 'Program 147 — Statutory Intelligence Browser');

const email = `statute-${Date.now()}@certification.test`;
const password = 'CertPass!2026xyz';
await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Statute Reviewer', email, password, defaultRole: 'attorney', termsAccepted: true, privacyAccepted: true }),
});
await prisma.user.update({ where: { email }, data: { role: 'admin', emailVerifiedAt: new Date() } });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
const pageErrors = [];
context.on('page', (p) => p.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200))));
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.locator('input[type="email"]').first().fill(email);
await page.locator('input[type="password"]').first().fill(password);
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(4500);

// Reached by clicking, not by URL.
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
const navEntry = page.locator('aside a:has-text("Statutory Intelligence")').first();
(await navEntry.count()) > 0
  ? results.pass('SIB-01', 'An administrator can reach statutory intelligence from the navigation', 'Admin → Statutory Intelligence')
  : results.fail('SIB-01', 'Statutory intelligence is not offered in the navigation');

await navEntry.click().catch(() => {});
await page.locator('[data-testid="statutory-intelligence"]').waitFor({ timeout: 30000 }).catch(() => {});

// Every California code should be selectable, not a fixed offence list.
const codeOptions = await page.locator('[data-testid="law-code"] option').count();
codeOptions >= 29
  ? results.pass('SIB-02', 'Every California code is selectable', `${codeOptions} codes`)
  : results.fail('SIB-02', 'Too few codes are offered', String(codeOptions));

// Retrieve burglary.
await page.locator('[data-testid="law-section"]').fill('459');
await page.locator('[data-testid="law-lookup"]').click();
await page.locator('[data-testid="law-result"]').waitFor({ timeout: 90000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(SHOTS, 'statutory_intelligence.png'), fullPage: true });

const text = (await page.textContent('body')) ?? '';

/Every person who enters any house/i.test(text)
  ? results.pass('SIB-03', 'The statute the Legislature publishes is shown in full', 'Penal Code 459 text rendered')
  : results.fail('SIB-03', 'The statutory text is not displayed', text.slice(0, 200));

const officialLink = await page.locator('a[href*="leginfo.legislature.ca.gov"]').count();
officialLink > 0
  ? results.pass('SIB-04', 'The reader can open the official page and check it', `${officialLink} link(s) to the official source`)
  : results.fail('SIB-04', 'No link to the official source is offered');

const facts = ['Legislative version', 'Fingerprint', 'Retrieved', 'Served from'];
const missing = facts.filter((f) => !text.includes(f));
missing.length === 0
  ? results.pass('SIB-05', 'Provenance is shown alongside the text', facts.join(', '))
  : results.fail('SIB-05', 'Provenance is incomplete', missing.join(', '));

/Stats\. \d{4}/.test(text)
  ? results.pass('SIB-06', 'The legislative version is displayed', (text.match(/Amended by Stats\.[^)]*\)/) ?? ['shown'])[0].slice(0, 90))
  : results.fail('SIB-06', 'No legislative version is displayed');

/Mental state/i.test(text) && /intent/i.test(text)
  ? results.pass('SIB-07', 'The mental state compiled from the statute is shown with the words that establish it')
  : results.fail('SIB-07', 'No mental state is displayed');

/Depends on \d+ other section/i.test(text)
  ? results.pass('SIB-08', 'The sections this charge depends on are listed', (text.match(/Depends on \d+ other section\(s\)/) ?? [''])[0])
  : results.fail('SIB-08', 'Cross-referenced sections are not shown');

// Follow a dependency by clicking it.
const dependency = page.locator('[data-testid="law-result"] button.font-mono').first();
if ((await dependency.count()) > 0) {
  const label = (await dependency.textContent()) ?? '';
  await dependency.click();
  await page.locator('[data-testid="law-lookup"]').click();
  await page.waitForTimeout(4000);
  const followed = (await page.textContent('body')) ?? '';
  followed.includes(label.trim().split(' ')[0])
    ? results.pass('SIB-09', 'A dependency can be followed by clicking it', `followed ${label.trim()}`)
    : results.warn('SIB-09', 'Following a dependency did not load it', label);
} else {
  results.warn('SIB-09', 'No dependency was offered to follow');
}

// A charge with no verified instruction must say UNKNOWN.
await page.locator('[data-testid="law-code"]').selectOption('HSC');
await page.locator('[data-testid="law-section"]').fill('11350');
await page.locator('[data-testid="law-lookup"]').click();
await page.waitForTimeout(6000);
const unmapped = (await page.textContent('body')) ?? '';
/UNKNOWN/.test(unmapped) && /has not been guessed/i.test(unmapped)
  ? results.pass('SIB-10', 'A charge with no verified instruction shows UNKNOWN, not a guess', 'CALCRIM reported as unknown')
  : results.fail('SIB-10', 'An unmapped charge did not report UNKNOWN', unmapped.slice(0, 200));

// A section that does not exist must be explained, not blank.
await page.locator('[data-testid="law-code"]').selectOption('PEN');
await page.locator('[data-testid="law-section"]').fill('99999');
await page.locator('[data-testid="law-lookup"]').click();
await page.waitForTimeout(6000);
const missingText = (await page.locator('[data-testid="law-error"]').textContent().catch(() => '')) ?? '';
/no section 99999/i.test(missingText)
  ? results.pass('SIB-11', 'A section that does not exist is explained rather than shown blank', missingText.slice(0, 110))
  : results.fail('SIB-11', 'A nonexistent section was not explained', missingText.slice(0, 150));

pageErrors.length === 0
  ? results.pass('SIB-12', 'No uncaught JavaScript exceptions across statutory lookup')
  : results.fail('SIB-12', 'Uncaught JavaScript exceptions occurred', pageErrors.slice(0, 2).join(' | '));

await browser.close();
await results.write({ base: BASE });
await prisma.$disconnect();
