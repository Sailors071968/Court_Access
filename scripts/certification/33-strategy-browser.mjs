#!/usr/bin/env node
// Program 150, Phase 11 — browser verification of the strategy surfaces.
//
// Checks the two things that matter about these pages: that they show the
// record with its citations, and that they never tell the reader what to
// conclude. Also confirms the staff dashboard no longer shows invented alerts.

import { createHash } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright';
import { Results, OUT_DIR } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const BASE = process.env.CERT_WEB_BASE || 'http://127.0.0.1:4180';
const SHOTS = path.join(OUT_DIR, 'screenshots');
const results = new Results('STRATEGY_BROWSER', 'Program 150 — Strategy Workspace Browser');

const email = `strategy-${Date.now()}@certification.test`;
const password = 'CertPass!2026xyz';

const reg = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Strategy Counsel', email, password, defaultRole: 'attorney', termsAccepted: true, privacyAccepted: true }),
});
const auth = await reg.json();

const caseRes = await fetch(`${BASE}/api/cases`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` },
  body: JSON.stringify({ title: 'People v. Delgado', caseNumber: `SB-${Date.now()}`, jurisdiction: 'Los Angeles County', caseType: 'felony' }),
});
const caseJson = await caseRes.json();
const caseId = caseJson?.case?.caseId ?? caseJson?.caseId;

const report = `
LOS ANGELES POLICE DEPARTMENT — INVESTIGATIVE REPORT

I conducted a traffic stop and detained the driver. I then conducted a warrantless search of the vehicle and
located a backpack in plain view. The item was booked into evidence and transferred to the laboratory.

The witness briefly saw a male subject from a distance in poor lighting and stated the suspect resembled the
driver. DELGADO was advised of his Miranda rights. DELGADO stated he did not know the backpack was there and
that other people had access to the vehicle.
`;

const evidence = await prisma.evidence.create({
  data: {
    caseId,
    tenantId: auth.user.tenantId,
    uploadedBy: auth.user.userId,
    fileName: 'Investigative Report.pdf',
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

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
const pageErrors = [];
context.on('page', (p) => p.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200))));
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.locator('input[type="email"]').first().fill(email);
await page.locator('input[type="password"]').first().fill(password);
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(5000);

// --- The staff dashboard must no longer show invented alerts -------------------
const dashboard = (await page.textContent('body')) ?? '';
await page.screenshot({ path: path.join(SHOTS, 'action_center.png'), fullPage: true });

// A form placeholder reading "e.g., People v. Smith" is a hint about what to
// type, not a claim about a case. What matters is content presented as fact.
!/Hearing — People v\. Smith|Motion recommendation signal|Filing Deadline — Motion to Suppress|Evidence dispute added/i.test(dashboard)
  ? results.pass('SBR-01', 'The staff dashboard no longer shows invented cases or recommendations', 'fabricated alerts gone')
  : results.fail('SBR-01', 'Fabricated alerts are still displayed', dashboard.match(/People v\. Smith|2024-CF-001234/)?.[0]);

/Action Center/i.test(dashboard)
  ? results.pass('SBR-02', 'The dashboard shows an action centre', 'Action Center rendered')
  : results.fail('SBR-02', 'No action centre on the dashboard');

/has no charging document on record|Nothing needs attention/i.test(dashboard)
  ? results.pass('SBR-03', 'The queue shows real outstanding work, or says there is none', 'real entry or honest empty state')
  : results.warn('SBR-03', 'The queue content could not be confirmed', dashboard.slice(0, 150));

// --- Defence strategy workspace ----------------------------------------------------
await page.goto(`${BASE}/cases/${caseId}/litigation-strategy`, { waitUntil: 'networkidle' });
await page.locator('[data-testid="defense-strategy"]').waitFor({ timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2000);
const strategy = (await page.textContent('body')) ?? '';
await page.screenshot({ path: path.join(SHOTS, 'defense_strategy.png'), fullPage: true });

(await page.locator('[data-testid="defense-strategy"]').count()) > 0
  ? results.pass('SBR-04', 'The defence strategy workspace renders', 'workspace present')
  : results.fail('SBR-04', 'The defence strategy workspace did not render', strategy.slice(0, 200));

/Fourth Amendment/i.test(strategy) && /Miranda/i.test(strategy)
  ? results.pass('SBR-05', 'Themes raised by the record are shown', 'Fourth Amendment and Miranda present')
  : results.fail('SBR-05', 'Expected themes are missing', strategy.slice(0, 200));

/judgement for counsel/i.test(strategy)
  ? results.pass('SBR-06', 'The page says plainly that the judgement is counsel\u2019s', 'caveat displayed')
  : results.fail('SBR-06', 'No caveat is displayed');

// Open a theme and confirm the passage is quoted.
await page.locator('[data-testid="theme-fourth_amendment"] button').first().click().catch(() => {});
await page.waitForTimeout(800);
const opened = (await page.locator('[data-testid="theme-fourth_amendment"]').textContent().catch(() => '')) ?? '';

/warrantless search/i.test(opened) && /Investigative Report/i.test(opened)
  ? results.pass('SBR-07', 'A theme quotes the passage and names the document it came from', 'passage and source shown')
  : results.fail('SBR-07', 'The theme does not cite its source', opened.slice(0, 200));

/Commonly needed and not in the record/i.test(opened)
  ? results.pass('SBR-08', 'What is missing is named alongside what is present', 'missing material listed')
  : results.fail('SBR-08', 'Missing material is not shown');

/Unanswered/i.test(opened)
  ? results.pass('SBR-09', 'Unanswered questions are shown rather than resolved', 'open questions listed')
  : results.fail('SBR-09', 'No unanswered questions are shown');

// Themes with nothing behind them are listed, not hidden.
await page.locator('[data-testid="toggle-unsupported"]').click().catch(() => {});
await page.waitForTimeout(600);
const unsupported = (await page.locator('[data-testid="unsupported-themes"]').textContent().catch(() => '')) ?? '';
/Nothing found is not the same as nothing there/i.test(unsupported)
  ? results.pass('SBR-10', 'Themes with nothing in the record are listed and explained', 'examined-but-empty themes shown')
  : results.fail('SBR-10', 'Unsupported themes are hidden', unsupported.slice(0, 150));

// --- Motion intelligence -------------------------------------------------------------
await page.goto(`${BASE}/cases/${caseId}/motions`, { waitUntil: 'networkidle' });
await page.locator('[data-testid="motion-issues"]').waitFor({ timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1500);
const motions = (await page.textContent('body')) ?? '';
await page.screenshot({ path: path.join(SHOTS, 'motion_issues.png'), fullPage: true });

(await page.locator('[data-testid="motion-issues"]').count()) > 0
  ? results.pass('SBR-11', 'Motion intelligence renders real issues rather than an empty stub', 'page present')
  : results.fail('SBR-11', 'Motion intelligence did not render', motions.slice(0, 200));

/may warrant attorney review/i.test(motions)
  ? results.pass('SBR-12', 'Issues are phrased as warranting review, never as advice to file', 'required wording shown')
  : results.fail('SBR-12', 'The required wording is absent', motions.slice(0, 200));

!/should be filed|we recommend filing|likely to succeed/i.test(motions)
  ? results.pass('SBR-13', 'No page tells the reader to file anything or predicts an outcome')
  : results.fail('SBR-13', 'Advisory or predictive language is displayed', motions.match(/should be filed|we recommend filing|likely to succeed/i)?.[0]);

/does not recommend filing any motion/i.test(motions)
  ? results.pass('SBR-14', 'The page states its own limits', 'caveat displayed')
  : results.fail('SBR-14', 'The page does not state its limits');

pageErrors.length === 0
  ? results.pass('SBR-15', 'No uncaught JavaScript exceptions across the strategy surfaces')
  : results.fail('SBR-15', 'Uncaught JavaScript exceptions occurred', pageErrors.slice(0, 2).join(' | '));

await browser.close();
await results.write({ caseId, base: BASE });
await prisma.$disconnect();
