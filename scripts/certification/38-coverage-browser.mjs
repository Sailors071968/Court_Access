#!/usr/bin/env node
// Program 153, Phase 14 — browser verification of coverage and Explain This.

import { createHash } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright';
import { Results, OUT_DIR } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const BASE = process.env.CERT_WEB_BASE || 'http://127.0.0.1:4180';
const SHOTS = path.join(OUT_DIR, 'screenshots');
const results = new Results('COVERAGE_BROWSER', 'Program 153 — Evidence Coverage Browser');

const email = `coverage-${Date.now()}@certification.test`;
const password = 'CertPass!2026xyz';
const reg = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Coverage Counsel', email, password, defaultRole: 'attorney', termsAccepted: true, privacyAccepted: true }),
});
const auth = await reg.json();
const api = (method, url, body) =>
  fetch(`${BASE}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));

const made = await api('POST', '/api/cases', {
  title: 'People v. Serrano',
  caseNumber: `CB-${Date.now()}`,
  jurisdiction: 'Los Angeles County',
  caseType: 'felony',
});
const caseId = made.json?.case?.caseId ?? made.json?.caseId;

const report = `
LOS ANGELES POLICE DEPARTMENT — INVESTIGATIVE REPORT
An unknown subject entered the residence through an unlocked window. The residence is an inhabited dwelling house
occupied by the reporting party. A television and a laptop were taken from the building.
No fingerprints were located on the window frame. The witness was unable to identify the subject.
`;
const evidence = await prisma.evidence.create({
  data: {
    caseId,
    tenantId: auth.user.tenantId,
    uploadedBy: auth.user.userId,
    fileName: 'Burglary Report.pdf',
    size: BigInt(report.length),
    mimeType: 'application/pdf',
    evidenceType: 'police_report',
    processingStatus: 'completed',
  },
});
await prisma.evidenceChunk.create({
  data: {
    evidenceId: evidence.evidenceId,
    tenantId: auth.user.tenantId,
    chunkIndex: 0,
    text: report,
    startOffset: 0,
    endOffset: report.length,
    charCount: report.length,
    checksum: createHash('sha256').update(report).digest('hex').slice(0, 16),
  },
});
await api('POST', `/api/cases/${caseId}/charges/documents`, {
  kind: 'complaint',
  name: 'Complaint',
  filedAt: '2026-06-01T00:00:00.000Z',
  charges: [
    {
      countNumber: 1,
      code: 'PEN',
      section: '459',
      verbatimText:
        'On or about May 2, 2026, the crime of FIRST DEGREE RESIDENTIAL BURGLARY, in violation of PENAL CODE SECTION 459, a Felony, was committed by ANA SERRANO.',
      defendants: [{ name: 'Ana Serrano' }],
    },
  ],
});

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

await page.goto(`${BASE}/cases/${caseId}/overview`, { waitUntil: 'networkidle' });
const tab = page.locator('a:has-text("Evidence Coverage")').first();
(await tab.count()) > 0
  ? results.pass('CVB-01', 'Evidence coverage is offered as a case tab', 'reachable by clicking')
  : results.fail('CVB-01', 'Evidence coverage cannot be reached by clicking');

await tab.click().catch(() => {});
await page.locator('[data-testid="evidence-coverage"]').waitFor({ timeout: 120000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(SHOTS, 'evidence_coverage.png'), fullPage: true });
const text = (await page.textContent('body')) ?? '';

(await page.locator('[data-testid="evidence-coverage"]').count()) > 0
  ? results.pass('CVB-02', 'The coverage matrix renders', 'panel present')
  : results.fail('CVB-02', 'The coverage matrix did not render', text.slice(0, 200));

/Penal Code section 459/.test(text)
  ? results.pass('CVB-03', 'The charged count is shown with its citation', 'PEN 459')
  : results.fail('CVB-03', 'The count is missing');

/element\(s\) with material/.test(text) && /with nothing in the record/.test(text)
  ? results.pass('CVB-04', 'Elements with material and elements without are both counted', 'both reported')
  : results.fail('CVB-04', 'The element breakdown is missing');

/does not decide whether an element is proved/i.test(text)
  ? results.pass('CVB-05', 'The page says plainly that it decides nothing', 'caveat shown')
  : results.fail('CVB-05', 'The page does not state its limits');

// Open an element and read the passages.
await page.locator('[data-testid="count-1"] li button').first().click().catch(() => {});
await page.waitForTimeout(800);
const opened = (await page.locator('[data-testid="count-1"]').textContent().catch(() => '')) ?? '';

/Burglary Report/i.test(opened)
  ? results.pass('CVB-06', 'Each element shows the document its material came from', 'source named')
  : results.fail('CVB-06', 'Elements carry no source', opened.slice(0, 200));

/Cuts the other way|In the record/i.test(opened)
  ? results.pass('CVB-07', 'Supporting and contrary material are shown separately', 'both sides labelled')
  : results.warn('CVB-07', 'The two sides are not separately labelled');

// Explain this.
await page.locator('[data-testid="explain-1"]').click().catch(() => {});
await page.locator('[data-testid="explanation"]').waitFor({ timeout: 30000 }).catch(() => {});
await page.waitForTimeout(700);
const explanation = (await page.locator('[data-testid="explanation"]').textContent().catch(() => '')) ?? '';
await page.screenshot({ path: path.join(SHOTS, 'explain_this.png'), fullPage: true });

explanation.length > 0
  ? results.pass('CVB-08', 'Explain This opens for a displayed item', 'panel opened')
  : results.fail('CVB-08', 'Explain This did not open');

/Why this is displayed/i.test(explanation) && /What produced it/i.test(explanation) && /Repository/i.test(explanation)
  ? results.pass('CVB-09', 'The explanation says why it is shown, what produced it and from which repository', 'all three answered')
  : results.fail('CVB-09', 'The explanation is incomplete', explanation.slice(0, 200));

/leginfo\.legislature\.ca\.gov|Penal Code section 459/.test(explanation)
  ? results.pass('CVB-10', 'The explanation links to the authority behind the item', 'authority shown')
  : results.fail('CVB-10', 'No authority in the explanation');

// A disclaimer contains the very words a conclusion would use — "does not
// decide whether an element is proved". Only an assertion counts, so a match
// preceded by a negation within the same clause is not a breach.
const CONCLUSORY = /\b(?:should be filed|likely to succeed|is guilty|element is proved|proven beyond)\b/gi;
const asserted = [];
for (const m of text.matchAll(CONCLUSORY)) {
  const before = text.slice(Math.max(0, m.index - 70), m.index);
  if (/\b(?:not|never|cannot|does not|do not|without|neither)\b[^.]*$/i.test(before)) continue;
  asserted.push(m[0]);
}
asserted.length === 0
  ? results.pass('CVB-11', 'Nothing on the page asserts a conclusion, and the disclaimers are not mistaken for one')
  : results.fail('CVB-11', 'Conclusory language appeared', asserted.join(', '));

pageErrors.length === 0
  ? results.pass('CVB-12', 'No uncaught JavaScript exceptions on the coverage page')
  : results.fail('CVB-12', 'Uncaught JavaScript exceptions occurred', pageErrors.slice(0, 2).join(' | '));

await browser.close();
await results.write({ caseId, base: BASE });
await prisma.$disconnect();
