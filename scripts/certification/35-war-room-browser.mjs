#!/usr/bin/env node
// Program 151, Phase 14 — browser verification of the war room.
//
// Confirms an attorney can reach the war room by clicking, that it shows the
// stage, the operative charges, the issues the record raises with their
// citations, and what has changed — and that it tells nobody what to conclude.

import { createHash } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright';
import { Results, OUT_DIR } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const BASE = process.env.CERT_WEB_BASE || 'http://127.0.0.1:4180';
const SHOTS = path.join(OUT_DIR, 'screenshots');
const results = new Results('WAR_ROOM_BROWSER', 'Program 151 — War Room Browser');

const email = `warroom-${Date.now()}@certification.test`;
const password = 'CertPass!2026xyz';
const reg = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'War Room Counsel', email, password, defaultRole: 'attorney', termsAccepted: true, privacyAccepted: true }),
});
const auth = await reg.json();

const api = (method, url, body) =>
  fetch(`${BASE}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));

const created = await api('POST', '/api/cases', {
  title: 'People v. Castellanos',
  caseNumber: `WR-${Date.now()}`,
  jurisdiction: 'Los Angeles County',
  caseType: 'felony',
});
const caseId = created.json?.case?.caseId ?? created.json?.caseId;

const report = `
LOS ANGELES POLICE DEPARTMENT — INVESTIGATIVE REPORT
I detained the driver and conducted a warrantless search of the vehicle. The item was booked into evidence and
transferred to the laboratory. CASTELLANOS was advised of his Miranda rights and stated he did not know the
backpack was there and that other people had access to the vehicle.
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

await api('POST', `/api/cases/${caseId}/charges/documents`, {
  kind: 'complaint',
  name: 'Complaint',
  filedAt: '2026-05-01T00:00:00.000Z',
  charges: [
    {
      countNumber: 1,
      code: 'HSC',
      section: '11378',
      verbatimText:
        'On or about April 20, 2026, the crime of POSSESSION FOR SALE OF A CONTROLLED SUBSTANCE, in violation of HEALTH AND SAFETY CODE SECTION 11378, was committed by RAUL CASTELLANOS.',
      defendants: [{ name: 'Raul Castellanos' }],
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

// Reached by clicking, not by URL.
await page.goto(`${BASE}/cases/${caseId}/overview`, { waitUntil: 'networkidle' });
const tab = page.locator('a:has-text("War Room"), button:has-text("War Room")').first();
(await tab.count()) > 0
  ? results.pass('WRB-01', 'The war room is offered as a case tab', 'War Room tab present')
  : results.fail('WRB-01', 'There is no way to reach the war room by clicking');

await tab.click().catch(() => {});
await page.locator('[data-testid="war-room"]').waitFor({ timeout: 90000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(SHOTS, 'war_room.png'), fullPage: true });
const text = (await page.textContent('body')) ?? '';

(await page.locator('[data-testid="war-room"]').count()) > 0
  ? results.pass('WRB-02', 'The war room renders', 'panel present')
  : results.fail('WRB-02', 'The war room did not render', text.slice(0, 200));

/Discovery/i.test(await page.locator('[data-testid="war-room-stage"]').textContent().catch(() => ''))
  ? results.pass('WRB-03', 'The current stage is shown', 'Discovery')
  : results.fail('WRB-03', 'The stage is missing or wrong', await page.locator('[data-testid="war-room-stage"]').textContent().catch(() => ''));

/Worked out from what is on the record/i.test(text)
  ? results.pass('WRB-04', 'The page says how the stage was determined', 'inference explained')
  : results.fail('WRB-04', 'The stage is asserted without saying how it was reached');

/Health and Safety Code section 11378/.test(text)
  ? results.pass('WRB-05', 'The operative charges are shown', 'HSC 11378')
  : results.fail('WRB-05', 'The charges are missing');

/may warrant attorney review/i.test(text)
  ? results.pass('WRB-06', 'Issues appear with the required wording', 'required phrasing shown')
  : results.fail('WRB-06', 'The required wording is absent');

const issues = (await page.locator('[data-testid="war-room-issues"]').textContent().catch(() => '')) ?? '';
/Investigative Report/i.test(issues)
  ? results.pass('WRB-07', 'Each issue cites the document that raised it', 'source named')
  : results.fail('WRB-07', 'Issues carry no citation', issues.slice(0, 150));

(await page.locator('[data-testid="war-room-missing"]').count()) > 0
  ? results.pass('WRB-08', 'What is not in the record is shown alongside what is', 'missing material listed')
  : results.warn('WRB-08', 'Nothing is reported as missing');

(await page.locator('[data-testid="war-room-activity"]').count()) > 0
  ? results.pass('WRB-09', 'What has changed on the case is shown', 'recent activity listed')
  : results.fail('WRB-09', 'No recent activity is shown');

!/should be filed|we recommend|likely to succeed|is guilty|is innocent/i.test(text)
  ? results.pass('WRB-10', 'The war room tells nobody what to conclude')
  : results.fail('WRB-10', 'Conclusory language appeared', text.match(/should be filed|we recommend|likely to succeed/i)?.[0]);

pageErrors.length === 0
  ? results.pass('WRB-11', 'No uncaught JavaScript exceptions on the war room')
  : results.fail('WRB-11', 'Uncaught JavaScript exceptions occurred', pageErrors.slice(0, 2).join(' | '));

await browser.close();
await results.write({ caseId, base: BASE });
await prisma.$disconnect();
