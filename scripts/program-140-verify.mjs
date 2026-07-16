// ============================================================================
// Program 140 — API Command Center role verification.
// Confirms the Command Center renders for a super-admin and is blocked (Access
// Denied, no URL bypass) for a non-admin, capturing screenshots + console errors.
// ============================================================================

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.env.OUT || 'reports/screenshots/program-140';
mkdirSync(OUT, { recursive: true });
const PATH = '/dashboard/api-command-center';

const ROLES = [
  { label: 'admin', email: 'admin@courtaccess.test', password: 'TestPass123!', expect: 'granted' },
  { label: 'attorney', email: 'attorney2@courtaccess.test', password: 'TestPass123!', expect: 'denied' },
  { label: 'investigator', email: 'investigator2@courtaccess.test', password: 'TestPass123!', expect: 'denied' },
];

async function loginSeed(page, email, password) {
  const res = await page.request.post(`${BASE}/api/auth/login`, { data: { email, password }, headers: { 'Content-Type': 'application/json' } });
  if (!res.ok()) throw new Error(`login failed ${email}: ${res.status()}`);
  const auth = await res.json();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ auth }) => {
    localStorage.setItem('court-access-token', auth.accessToken);
    localStorage.setItem('court-access-refresh-token', auth.refreshToken);
    localStorage.setItem('court-access-auth', JSON.stringify({ state: { user: auth.user, isAuthenticated: true, subscriptionStatus: auth.user.subscriptionStatus || 'trial' }, version: 0 }));
  }, { auth });
  return auth;
}

async function run() {
  const browser = await chromium.launch();
  const report = [];
  for (const role of ROLES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await loginSeed(page, role.email, role.password);
    await page.goto(`${BASE}${PATH}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasCenter = /API Command Center/.test(bodyText) && /Provider Dashboard/.test(bodyText);
    const denied = /Access Denied/.test(bodyText);
    await page.screenshot({ path: join(OUT, `command-center-${role.label}.png`), fullPage: true });
    const outcome = hasCenter ? 'granted' : denied ? 'denied' : 'unknown';
    const pass = outcome === role.expect;
    report.push({ role: role.label, expected: role.expect, outcome, pass, consoleErrors: errors });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${role.label}: expected=${role.expect} outcome=${outcome} errors=${errors.length}`);
    await ctx.close();
  }
  writeFileSync(join(OUT, 'role-verification.json'), JSON.stringify({ base: BASE, path: PATH, generatedAt: new Date().toISOString(), results: report }, null, 2));
  await browser.close();
  const allPass = report.every((r) => r.pass && r.consoleErrors.length === 0);
  console.log(allPass ? 'ALL ROLE CHECKS PASSED (0 console errors)' : 'ROLE CHECKS FAILED');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
