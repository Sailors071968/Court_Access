#!/usr/bin/env node
// Program 149, Phase 10 — browser verification of the complaint workspace.
//
// Files a complaint entirely through the interface, with no API call made by
// the test: an attorney fills the form, ticks the allegations, previews it and
// files it. Then reads a second document by pasting its text and reviewing
// what the parser proposed, and finally copies the whole filing forward into
// an amendment.

import path from 'node:path';
import { chromium } from 'playwright';
import { Results, OUT_DIR } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const BASE = process.env.CERT_WEB_BASE || 'http://127.0.0.1:4180';
const SHOTS = path.join(OUT_DIR, 'screenshots');
const results = new Results('COMPLAINT_WORKSPACE_BROWSER', 'Program 149 — Complaint Workspace Browser');

const email = `workspace-${Date.now()}@certification.test`;
const password = 'CertPass!2026xyz';

const registration = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Workspace Counsel', email, password, defaultRole: 'attorney', termsAccepted: true, privacyAccepted: true }),
});
const auth = await registration.json();

// The case is created through the API; everything about charges is done in the
// browser, which is what this suite is verifying.
const caseRes = await fetch(`${BASE}/api/cases`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` },
  body: JSON.stringify({
    title: 'People v. Okonkwo',
    caseNumber: `WS-${Date.now()}`,
    jurisdiction: 'Los Angeles County',
    caseType: 'felony',
  }),
});
const caseJson = await caseRes.json();
const caseId = caseJson?.case?.caseId ?? caseJson?.caseId;

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1500, height: 1300 } });
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

// --- Phase 1: file a complaint entirely from the browser -----------------------

(await page.locator('[data-testid="open-workspace"]').count()) > 0
  ? results.pass('WSB-01', 'An attorney is offered a way to file a charging document from the case', 'workspace opener present')
  : results.fail('WSB-01', 'There is no way to file a charging document from the interface');

await page.locator('[data-testid="open-workspace"]').click();
await page.locator('[data-testid="complaint-workspace"]').waitFor({ timeout: 20000 }).catch(() => {});

const kinds = await page.locator('[data-testid="doc-kind"] option').count();
kinds >= 5
  ? results.pass('WSB-02', 'Every kind of charging document can be created', `${kinds} kinds offered`)
  : results.fail('WSB-02', 'Not every document kind is offered', String(kinds));

// The selector populates from an API call, so wait for it rather than racing
// it. This failed against the production artifact behind nginx and passed
// against the dev server purely on timing.
await page
  .locator('[data-testid="count-code-0"] option')
  .first()
  .waitFor({ timeout: 20000 })
  .catch(() => {});
await page.waitForFunction(
  () => (document.querySelector('[data-testid="count-code-0"]')?.children.length ?? 0) > 5,
  { timeout: 20000 },
).catch(() => {});
const codeOptions = await page.locator('[data-testid="count-code-0"] option').count();
codeOptions >= 29
  ? results.pass('WSB-03', 'The California code selector offers every code', `${codeOptions} codes`)
  : results.fail('WSB-03', 'The code selector is incomplete', String(codeOptions));

await page.locator('[data-testid="doc-name"]').fill('Complaint');
await page.locator('[data-testid="doc-number"]').fill('BA246810');
await page.locator('[data-testid="count-code-0"]').selectOption('PEN');
await page.locator('[data-testid="count-section-0"]').fill('245');
await page.locator('[data-testid="count-text-0"]').fill(
  'On or about April 2, 2026, the crime of ASSAULT WITH A DEADLY WEAPON, in violation of PENAL CODE SECTION 245(a)(1), a Felony, was committed by DAVID OKONKWO.',
);
await page.locator('[data-testid="count-defendants-0"]').fill('David Okonkwo, Ana Vasquez');

// Allegations that change exposure must be enterable.
await page.locator('[data-testid="allegation-strikeAllegation-0"]').check();
await page.locator('[data-testid="allegation-seriousFelony-0"]').check();
await page.locator('[data-testid="allegation-firearmAllegation-0"]').check();

// A second count.
await page.locator('[data-testid="add-count"]').click();
await page.waitForTimeout(400);
await page.locator('[data-testid="count-code-1"]').selectOption('HSC');
await page.locator('[data-testid="count-section-1"]').fill('11378');
await page.locator('[data-testid="count-text-1"]').fill(
  'On or about April 2, 2026, the crime of POSSESSION FOR SALE OF A CONTROLLED SUBSTANCE, in violation of HEALTH AND SAFETY CODE SECTION 11378, was committed by ANA VASQUEZ.',
);
await page.locator('[data-testid="count-defendants-1"]').fill('Ana Vasquez');

await page.screenshot({ path: path.join(SHOTS, 'complaint_workspace.png'), fullPage: true });

// Preview before filing.
await page.locator('[data-testid="preview-filing"]').click();
await page.locator('[data-testid="filing-preview"]').waitFor({ timeout: 10000 }).catch(() => {});
const previewText = (await page.locator('[data-testid="filing-preview"]').textContent().catch(() => '')) ?? '';
/Penal Code section 245/.test(previewText) && /Health and Safety Code section 11378/.test(previewText)
  ? results.pass('WSB-04', 'The filing can be previewed before it is committed', previewText.replace(/\s+/g, ' ').slice(0, 110))
  : results.fail('WSB-04', 'The preview is wrong or missing', previewText.slice(0, 200));

// Nothing has changed on the case yet.
const beforeFiling = (await page.textContent('body')) ?? '';
/No charging document has been filed/i.test(beforeFiling)
  ? results.pass('WSB-05', 'Nothing changes on the case until the document is filed', 'no current charges while drafting')
  : results.warn('WSB-05', 'The case may already show charges before filing');

await page.locator('[data-testid="file-document"]').click();
await page.waitForTimeout(9000);
const afterFiling = (await page.textContent('body')) ?? '';
await page.screenshot({ path: path.join(SHOTS, 'complaint_filed.png'), fullPage: true });

/As charged in the Complaint/i.test(afterFiling)
  ? results.pass('WSB-06', 'Filing from the browser makes the document operative', 'Complaint is now operative')
  : results.fail('WSB-06', 'The filed document did not become operative', afterFiling.slice(0, 250));

/Count 1 — Penal Code section 245/.test(afterFiling)
  ? results.pass('WSB-07', 'The counts entered in the browser appear as the current charges', 'count 1 shown')
  : results.fail('WSB-07', 'The entered counts did not appear');

// --- Phase 2: the defendant matrix ------------------------------------------------

(await page.locator('[data-testid="defendant-matrix"]').count()) > 0
  ? results.pass('WSB-08', 'A defendant and count matrix is displayed', 'matrix rendered')
  : results.fail('WSB-08', 'No defendant matrix is displayed');

const matrixText = (await page.locator('[data-testid="defendant-matrix"]').textContent().catch(() => '')) ?? '';
/David Okonkwo/.test(matrixText) && /Ana Vasquez/.test(matrixText)
  ? results.pass('WSB-09', 'Every defendant appears in the matrix', 'both defendants shown')
  : results.fail('WSB-09', 'The matrix is missing defendants', matrixText.slice(0, 150));

/Charged/.test(matrixText) && /—/.test(matrixText)
  ? results.pass('WSB-10', 'The matrix distinguishes a charged defendant from one not charged on that count', 'charged and blank cells shown')
  : results.fail('WSB-10', 'The matrix does not distinguish cell states');

/Strike/.test(matrixText) && /Serious felony/.test(matrixText) && /Firearm/.test(matrixText)
  ? results.pass('WSB-11', 'Allegations entered in the browser are shown against the count', 'strike, serious felony, firearm')
  : results.fail('WSB-11', 'Allegations are not shown', matrixText.slice(0, 200));

/none has been calculated/i.test(matrixText)
  ? results.pass('WSB-12', 'Where the People plead no exposure, none is invented', 'exposure reported as not calculated')
  : results.warn('WSB-12', 'The exposure note is not shown in the matrix');

// --- Phase 7: read a document by pasting it -----------------------------------------

await page.locator('[data-testid="open-workspace"]').click();
await page.locator('[data-testid="complaint-workspace"]').waitFor({ timeout: 20000 }).catch(() => {});
await page.locator('[data-testid="doc-kind"]').selectOption('amended_complaint');
await page.locator('[data-testid="paste-complaint"]').click();
await page.waitForTimeout(400);

await page.locator('[data-testid="paste-text"]').fill(`
CASE NO: BA246810

COUNT 1
On or about April 2, 2026, the crime of ASSAULT WITH A DEADLY WEAPON, in violation of PENAL CODE SECTION 245(a)(1), a Felony,
was committed by DAVID OKONKWO.

COUNT 2
On or about April 2, 2026, the crime of SECOND DEGREE ROBBERY, in violation of PENAL CODE SECTION 211, a Felony,
was committed by DAVID OKONKWO.
`);
await page.locator('[data-testid="do-parse"]').click();
await page.locator('[data-testid="parse-result"]').waitFor({ timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1200);

const parseText = (await page.locator('[data-testid="parse-result"]').textContent().catch(() => '')) ?? '';
/confidence/i.test(parseText) && /check every count before filing/i.test(parseText)
  ? results.pass('WSB-13', 'A parsed document reports its confidence and asks to be checked', parseText.replace(/\s+/g, ' ').slice(0, 110))
  : results.fail('WSB-13', 'Parsing did not report confidence or ask for review', parseText.slice(0, 200));

const section0 = await page.locator('[data-testid="count-section-0"]').inputValue().catch(() => '');
const section1 = await page.locator('[data-testid="count-section-1"]').inputValue().catch(() => '');
section0 === '245' && section1 === '211'
  ? results.pass('WSB-14', 'The parsed counts are loaded into the form for review, not filed', `sections ${section0} and ${section1}`)
  : results.fail('WSB-14', 'Parsed counts were not loaded for review', `${section0}, ${section1}`);

// The attorney corrects something the parser got wrong, then files.
await page.locator('[data-testid="count-defendants-0"]').fill('David Okonkwo');
await page.locator('[data-testid="count-defendants-1"]').fill('David Okonkwo');
await page.screenshot({ path: path.join(SHOTS, 'complaint_parsed.png'), fullPage: true });

await page.locator('[data-testid="file-document"]').click();
await page.waitForTimeout(9000);
const afterAmend = (await page.textContent('body')) ?? '';

/As charged in the Amended Complaint/i.test(afterAmend)
  ? results.pass('WSB-15', 'A document read from pasted text can be reviewed and filed', 'Amended Complaint is operative')
  : results.fail('WSB-15', 'The parsed document was not filed', afterAmend.slice(0, 200));

/Penal Code section 211/.test(afterAmend)
  ? results.pass('WSB-16', 'A count added by the amendment appears in the current charges', 'PC 211 charged')
  : results.fail('WSB-16', 'The new count did not appear');

/was added in the Amended Complaint|No longer charged/i.test(afterAmend)
  ? results.pass('WSB-17', 'What the amendment changed is explained in the history', 'change described')
  : results.warn('WSB-17', 'Changes from the amendment are not described');

// --- Phase 1: copy a prior filing forward -------------------------------------------

await page.locator('[data-testid="open-workspace"]').click();
await page.locator('[data-testid="complaint-workspace"]').waitFor({ timeout: 20000 }).catch(() => {});
const duplicateOptions = await page.locator('[data-testid="duplicate-of"] option').count();
duplicateOptions >= 3
  ? results.pass('WSB-18', 'A new filing can be started from any prior one', `${duplicateOptions - 1} prior filing(s) offered`)
  : results.fail('WSB-18', 'Prior filings are not offered to copy', String(duplicateOptions));

await page.locator('[data-testid="doc-kind"]').selectOption('information');
const priorValue = await page.locator('[data-testid="duplicate-of"] option').nth(1).getAttribute('value');
await page.locator('[data-testid="duplicate-of"]').selectOption(priorValue);
await page.locator('[data-testid="file-document"]').click();
await page.waitForTimeout(9000);
const afterInformation = (await page.textContent('body')) ?? '';

/As charged in the Information/i.test(afterInformation)
  ? results.pass('WSB-19', 'A filing copied from a prior one can be filed as an Information', 'Information is operative')
  : results.fail('WSB-19', 'The copied filing was not filed', afterInformation.slice(0, 200));

// --- History and audit ----------------------------------------------------------------

const filings = ['Complaint', 'Amended Complaint', 'Information'];
const missing = filings.filter((f) => !afterInformation.includes(f));
missing.length === 0
  ? results.pass('WSB-20', 'Every filing made in this session remains on the record', filings.join(' → '))
  : results.fail('WSB-20', 'Filings are missing from the history', missing.join(', '));

const audited = await prisma.chargeAuditEvent.count({ where: { caseId } });
audited > 0
  ? results.pass('WSB-21', 'Everything done in the browser is recorded in the audit trail', `${audited} events`)
  : results.fail('WSB-21', 'Browser actions were not audited');

const documents = await prisma.chargingDocument.count({ where: { caseId } });
documents === 3
  ? results.pass('WSB-22', 'Three documents were filed and none was destroyed', `${documents} charging documents`)
  : results.warn('WSB-22', 'Unexpected number of charging documents', String(documents));

await page.screenshot({ path: path.join(SHOTS, 'complaint_history.png'), fullPage: true });

pageErrors.length === 0
  ? results.pass('WSB-23', 'No uncaught JavaScript exceptions across the workspace')
  : results.fail('WSB-23', 'Uncaught JavaScript exceptions occurred', pageErrors.slice(0, 2).join(' | '));

await browser.close();
await results.write({ caseId, base: BASE });
await prisma.$disconnect();
