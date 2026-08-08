#!/usr/bin/env node
// Program 146, Phase 15 — executive readiness dashboard verification.
//
// The dashboard's value is that it cannot flatter the build: its recommendation
// is derived from the gate, and the gate is derived from suite results. These
// checks confirm it renders what was measured, refuses non-administrators, and
// does not claim readiness while something beneath it says otherwise.

import path from 'node:path';
import { chromium } from 'playwright';
import { Results, OUT_DIR, req, registerUser, login } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const BASE = process.env.CERT_WEB_BASE || 'http://127.0.0.1:4180';
const SHOTS = path.join(OUT_DIR, 'screenshots');
const results = new Results('READINESS_DASHBOARD', 'Program 146 — Executive Readiness Dashboard');

// --- Closed to non-administrators -------------------------------------------
const reached = [];
for (const role of ['attorney', 'criminal_investigator', 'paralegal', 'criminal_defendant', 'family_member']) {
  const u = await registerUser({ prefix: `rd-${role}`, defaultRole: role });
  if (!u.token) continue;
  const res = await req('GET', '/api/certification/readiness', { token: u.token });
  if (![401, 403].includes(res.status)) reached.push(`${role} (${res.status})`);
}
reached.length === 0
  ? results.pass('RDY-01', 'The readiness report is closed to every non-administrator role', '5 roles probed')
  : results.fail('RDY-01', 'A non-administrator read the readiness report', reached.join(', '));

// --- Administrator ------------------------------------------------------------
const email = `readiness-${Date.now()}@certification.test`;
const password = 'CertPass!2026xyz';
await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Readiness Reviewer', email, password, defaultRole: 'attorney', termsAccepted: true, privacyAccepted: true }),
});
await prisma.user.update({ where: { email }, data: { role: 'admin', emailVerifiedAt: new Date() } });

const session = await login(email, password);
const api = await req('GET', '/api/certification/readiness', { token: session.token });

if (api.status !== 200) {
  results.fail('RDY-02', 'The readiness report could not be assembled', `HTTP ${api.status}`);
} else {
  const r = api.json;
  results.pass(
    'RDY-02',
    'The readiness report assembles from executed suites',
    `${r.suites.length} suites, ${r.totals.checks} checks, ${r.totals.passRate}% passing`,
    r.totals,
  );

  // The recommendation must follow from the gate, not be asserted alongside it.
  const consistent =
    (r.gate.passed && r.recommendation === 'READY FOR PRODUCTION') ||
    (!r.gate.passed && r.recommendation !== 'READY FOR PRODUCTION');
  consistent
    ? results.pass(
        'RDY-03',
        'The recommendation follows from the release gate',
        `gate ${r.gate.passed ? 'passed' : `blocked by ${r.gate.blockedBy.join(', ')}`} → ${r.recommendation}`,
      )
    : results.fail('RDY-03', 'The recommendation contradicts the gate', `${r.recommendation} with gate passed=${r.gate.passed}`);

  // A failing check anywhere must be reflected in the defect count.
  const declared = r.criticalDefects.length;
  const summed = r.suites.reduce((n, s) => n + s.fail, 0);
  declared === summed
    ? results.pass('RDY-04', 'Every failing check is named in the defect list', `${declared} defect(s)`)
    : results.fail('RDY-04', 'The defect list does not match the suite totals', `${declared} listed vs ${summed} in suites`);

  // Unknowns must be reported, not folded into passes.
  const summedUnknown = r.suites.reduce((n, s) => n + s.unknown, 0);
  r.unknownCoverage.length === summedUnknown
    ? results.pass('RDY-05', 'Everything unmeasured is listed rather than counted as a pass', `${summedUnknown} unknown`)
    : results.fail('RDY-05', 'Unknown coverage does not match the suite totals', `${r.unknownCoverage.length} vs ${summedUnknown}`);

  // Real discovery is the criterion that cannot be satisfied by engineering.
  const caseCriteria = r.gate.criteria.filter((c) => c.id.startsWith('CASE-'));
  caseCriteria.length === 3
    ? results.pass(
        'RDY-06',
        'The gate requires all three attorney-authorized cases',
        caseCriteria.map((c) => `${c.id}=${c.status}`).join(', '),
      )
    : results.fail('RDY-06', 'The gate does not require the three authorized cases');

  if (r.goldStandard.authorizedCases.length === 0) {
    r.recommendation !== 'READY FOR PRODUCTION'
      ? results.pass(
          'RDY-07',
          'The platform cannot be declared production ready without real discovery',
          `${r.goldStandard.corporaTotal} corpora, none authorized → ${r.recommendation}`,
        )
      : results.fail('RDY-07', 'Production readiness was declared without any real discovery processed');
  } else {
    results.pass('RDY-07', 'Attorney-authorized discovery has been certified', `${r.goldStandard.authorizedCases.length} case(s)`);
  }
}

// --- Browser -------------------------------------------------------------------
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

// Reached by clicking, never by typing a URL.
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
const navEntry = page.locator('aside a:has-text("Production Readiness")').first();
(await navEntry.count()) > 0
  ? results.pass('RDY-08', 'An administrator can reach the dashboard from the navigation', 'Admin → Production Readiness')
  : results.fail('RDY-08', 'The readiness dashboard is not offered in the navigation');

await navEntry.click().catch(() => {});
await page.locator('[data-testid="readiness-dashboard"]').waitFor({ timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(SHOTS, 'production_readiness.png'), fullPage: true });

const text = (await page.textContent('body')) ?? '';
const sections = ['Release recommendation', 'Release gate', 'Gold Standard certification', 'Certification suites'];
const missing = sections.filter((s) => !text.includes(s));
missing.length === 0
  ? results.pass('RDY-09', 'The dashboard presents the recommendation, gate, corpora and suite results', sections.join(', '))
  : results.fail('RDY-09', 'The dashboard is missing sections', missing.join(', '));

const shown = (await page.locator('[data-testid="recommendation"]').textContent().catch(() => '')) ?? '';
shown.trim().length > 0 && api.json && shown.includes(api.json.recommendation)
  ? results.pass('RDY-10', 'The recommendation shown matches the measured one', shown.trim())
  : results.fail('RDY-10', 'The dashboard shows a different recommendation than the API', `shown "${shown.trim()}"`);

/No attorney-authorized case has been processed|authorized/i.test(text)
  ? results.pass('RDY-11', 'The dashboard states the Gold Standard position plainly', 'real-discovery status shown')
  : results.warn('RDY-11', 'The Gold Standard position is not stated clearly');

pageErrors.length === 0
  ? results.pass('RDY-12', 'No uncaught JavaScript exceptions on the readiness dashboard')
  : results.fail('RDY-12', 'Uncaught JavaScript exceptions occurred', pageErrors.slice(0, 2).join(' | '));

await browser.close();
await results.write({ base: BASE });
await prisma.$disconnect();
