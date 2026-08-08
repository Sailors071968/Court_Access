#!/usr/bin/env node
// Program 148, Phase 11 — browser verification of charging documents.
//
// Files a complaint, an amended complaint and an information through the API,
// then drives a real browser to the case's charges tab and asserts that an
// attorney sees the operative charges prominently, the whole filing history
// below, and every change named in words they can act on.

import path from 'node:path';
import { chromium } from 'playwright';
import { Results, OUT_DIR } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const BASE = process.env.CERT_WEB_BASE || 'http://127.0.0.1:4180';
const SHOTS = path.join(OUT_DIR, 'screenshots');
const results = new Results('CHARGING_BROWSER', 'Program 148 — Charging Documents Browser');

const email = `charging-${Date.now()}@certification.test`;
const password = 'CertPass!2026xyz';

const registration = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Charging Counsel', email, password, defaultRole: 'attorney', termsAccepted: true, privacyAccepted: true }),
});
const auth = await registration.json();
const token = auth.accessToken;

async function api(method, url, body) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const created = await api('POST', '/api/cases', {
  title: 'People v. Rivera',
  caseNumber: `BROWSE-${Date.now()}`,
  jurisdiction: 'Los Angeles County',
  caseType: 'felony',
});
const caseId = created.json?.case?.caseId ?? created.json?.caseId;

// --- Three filings, as a real prosecution would produce -----------------------

await api('POST', `/api/cases/${caseId}/charges/documents`, {
  kind: 'complaint',
  name: 'Complaint',
  filedAt: '2026-01-15T00:00:00.000Z',
  court: 'Superior Court of California, County of Los Angeles',
  courtCaseNumber: 'BA987654',
  charges: [
    {
      countNumber: 1,
      code: 'PEN',
      section: '459',
      verbatimText:
        'On or about January 2, 2026, the crime of FIRST DEGREE RESIDENTIAL BURGLARY, in violation of PENAL CODE SECTION 459, a Felony, was committed by MARCO RIVERA.',
      enhancements: ['PC 12022(a)(1) — principal armed with a firearm'],
      defendants: [{ name: 'Marco Rivera' }, { name: 'Luis Doe' }],
    },
    {
      countNumber: 2,
      code: 'HSC',
      section: '11350',
      verbatimText:
        'On or about January 2, 2026, the crime of POSSESSION OF A CONTROLLED SUBSTANCE, in violation of HEALTH AND SAFETY CODE SECTION 11350, was committed by LUIS DOE.',
      defendants: [{ name: 'Luis Doe' }],
    },
  ],
});

await api('POST', `/api/cases/${caseId}/charges/documents`, {
  kind: 'amended_complaint',
  name: 'First Amended Complaint',
  filedAt: '2026-02-10T00:00:00.000Z',
  courtCaseNumber: 'BA987654',
  charges: [
    {
      countNumber: 1,
      code: 'PEN',
      section: '459',
      verbatimText:
        'On or about January 2, 2026, the crime of FIRST DEGREE RESIDENTIAL BURGLARY, in violation of PENAL CODE SECTION 459, a Felony, was committed by MARCO RIVERA, who did enter an inhabited dwelling house.',
      defendants: [{ name: 'Marco Rivera' }],
    },
    {
      countNumber: 2,
      code: 'PEN',
      section: '211',
      verbatimText:
        'On or about January 2, 2026, the crime of SECOND DEGREE ROBBERY, in violation of PENAL CODE SECTION 211, a Felony, was committed by MARCO RIVERA.',
      defendants: [{ name: 'Marco Rivera' }],
    },
  ],
});

await api('POST', `/api/cases/${caseId}/charges/documents`, {
  kind: 'information',
  name: 'Information',
  filedAt: '2026-03-20T00:00:00.000Z',
  courtCaseNumber: 'BA987654',
  charges: [
    {
      countNumber: 1,
      code: 'PEN',
      section: '459',
      verbatimText:
        'On or about January 2, 2026, the crime of FIRST DEGREE RESIDENTIAL BURGLARY, in violation of PENAL CODE SECTION 459, a Felony, was committed by MARCO RIVERA, who did enter an inhabited dwelling house.',
      defendants: [
        { name: 'Marco Rivera' },
        { name: 'Luis Doe', status: 'severed', note: 'Severed for separate trial.' },
      ],
    },
    {
      countNumber: 2,
      code: 'PEN',
      section: '211',
      verbatimText:
        'On or about January 2, 2026, the crime of SECOND DEGREE ROBBERY, in violation of PENAL CODE SECTION 211, a Felony, was committed by MARCO RIVERA.',
      status: 'dismissed',
      defendants: [{ name: 'Marco Rivera', status: 'dismissed' }],
    },
  ],
});

// --- Browser -------------------------------------------------------------------

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
const pageErrors = [];
context.on('page', (p) => p.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200))));
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.locator('input[type="email"]').first().fill(email);
await page.locator('input[type="password"]').first().fill(password);
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(4500);

await page.goto(`${BASE}/cases/${caseId}/charges`, { waitUntil: 'networkidle' });
await page.locator('[data-testid="charges-panel"]').waitFor({ timeout: 40000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(SHOTS, 'charges.png'), fullPage: true });

const text = (await page.textContent('body')) ?? '';

(await page.locator('[data-testid="current-charges"]').count()) > 0
  ? results.pass('CHB-01', 'Current charges are shown prominently', 'current charges panel rendered')
  : results.fail('CHB-01', 'No current charges panel is displayed');

/As charged in the Information/i.test(text)
  ? results.pass('CHB-02', 'The operative document is named, and it is the newest filing', 'Information')
  : results.fail('CHB-02', 'The operative document is not identified', text.slice(0, 200));

/Count 1 — Penal Code section 459/.test(text)
  ? results.pass('CHB-03', 'Counts are shown with their citation', 'Count 1 — Penal Code section 459')
  : results.fail('CHB-03', 'Counts are not shown with citations');

/did enter an inhabited dwelling house/i.test(text)
  ? results.pass('CHB-04', "The People's own wording is displayed, not a paraphrase", 'verbatim allegation rendered')
  : results.fail('CHB-04', 'The verbatim charge text is not displayed');

/Dismissed/i.test(text) && /1 active/.test(text)
  ? results.pass('CHB-05', 'Dismissed counts are shown as dismissed rather than hidden', '1 active, 1 dismissed')
  : results.fail('CHB-05', 'Dismissed counts are not distinguished', text.slice(0, 200));

/severed/i.test(text)
  ? results.pass('CHB-06', 'A severed defendant is shown as severed', 'Luis Doe severed')
  : results.fail('CHB-06', 'Severance is not displayed');

/statute retrieved/i.test(text)
  ? results.pass('CHB-07', 'Each count shows whether its statute was retrieved from the Legislature', 'statute status shown per count')
  : results.warn('CHB-07', 'Statute retrieval status is not shown per count');

// --- History ---------------------------------------------------------------------

(await page.locator('[data-testid="charging-history"]').count()) > 0
  ? results.pass('CHB-08', 'The charging history is shown below the current charges', 'history panel rendered')
  : results.fail('CHB-08', 'No charging history is displayed');

const filings = ['Complaint', 'First Amended Complaint', 'Information'];
const missingFilings = filings.filter((f) => !text.includes(f));
missingFilings.length === 0
  ? results.pass('CHB-09', 'Every filing remains visible, including superseded ones', filings.join(' → '))
  : results.fail('CHB-09', 'Some filings are missing from the history', missingFilings.join(', '));

/Operative/i.test(text)
  ? results.pass('CHB-10', 'The operative filing is marked in the history', 'operative badge shown')
  : results.fail('CHB-10', 'The operative filing is not marked');

// Expand the amended complaint to read what it changed.
await page.locator('button:has-text("First Amended Complaint")').first().click().catch(() => {});
await page.waitForTimeout(800);
const expanded = (await page.textContent('body')) ?? '';

/was added in the First Amended Complaint/i.test(expanded)
  ? results.pass('CHB-11', 'An added count is explained in words', 'addition described')
  : results.fail('CHB-11', 'The added count is not explained', expanded.slice(0, 200));

/no longer charged/i.test(expanded)
  ? results.pass('CHB-12', 'A count no longer charged is explained', 'removal described')
  : results.fail('CHB-12', 'The dropped count is not explained');

/rewritten/i.test(expanded)
  ? results.pass('CHB-13', 'A rewritten allegation is flagged', 'modification described')
  : results.warn('CHB-13', 'The rewritten allegation is not flagged');

/Luis Doe is no longer charged/i.test(expanded)
  ? results.pass('CHB-14', 'A defendant removed from a count is named', 'defendant removal described')
  : results.warn('CHB-14', 'The removed defendant is not named');

await page.screenshot({ path: path.join(SHOTS, 'charges_history.png'), fullPage: true });

// --- Comparison ---------------------------------------------------------------------

await page.locator('text=Compare with first').first().click().catch(() => {});
await page.locator('[data-testid="charge-comparison"]').waitFor({ timeout: 20000 }).catch(() => {});
await page.waitForTimeout(800);
const compared = (await page.locator('[data-testid="charge-comparison"]').textContent().catch(() => '')) ?? '';

compared.length > 0
  ? results.pass('CHB-15', 'Two filings can be compared from the interface', compared.replace(/\s+/g, ' ').slice(0, 110))
  : results.fail('CHB-15', 'Comparison did not render');

await page.screenshot({ path: path.join(SHOTS, 'charges_comparison.png'), fullPage: true });

// The charging record is authoritative on this page; nothing below it may
// contradict what it says.
!/No charges filed yet/i.test(await page.textContent('body'))
  ? results.pass('CHB-17', 'Nothing on the page contradicts the charges set out at the top', 'no conflicting empty state')
  : results.fail('CHB-17', 'The page says charges exist and also says none are filed');

pageErrors.length === 0
  ? results.pass('CHB-16', 'No uncaught JavaScript exceptions across the charging workflow')
  : results.fail('CHB-16', 'Uncaught JavaScript exceptions occurred', pageErrors.slice(0, 2).join(' | '));

await browser.close();
await results.write({ caseId, base: BASE });
await prisma.$disconnect();
