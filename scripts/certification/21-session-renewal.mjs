#!/usr/bin/env node
// Program 145 — session renewal certification.
//
// Access tokens last fifteen minutes. Rather than idling for a quarter of an
// hour, the browser's stored token is replaced with a genuinely expired one
// signed with the server's own key, which is exactly what the client would be
// holding after sitting idle. Everything after that is the real code path.

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import jwt from '../../backend/node_modules/jsonwebtoken/index.js';
import { Results, OUT_DIR } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const BASE = process.env.CERT_WEB_BASE || 'http://127.0.0.1:4180';
const SHOTS = path.join(OUT_DIR, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = new Results('SESSION_RENEWAL', 'Program 145 — Session Renewal');

const env = fs.readFileSync('/workspace/backend/.env.certification', 'utf8');
const JWT_SECRET = env.match(/JWT_SECRET=(.*)/)?.[1]?.trim();

const email = `session-${Date.now()}@certification.test`;
const password = 'CertPass!2026xyz';

// --- An administrator account -----------------------------------------------
await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Session Operator', email, password, defaultRole: 'attorney', termsAccepted: true, privacyAccepted: true }),
});
await prisma.user.update({ where: { email }, data: { role: 'admin', emailVerifiedAt: new Date() } });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const pageErrors = [];
context.on('page', (p) => p.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200))));
const page = await context.newPage();

/** Sign in through the form, as a person would. */
async function signIn() {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(4000);
}

const tokenOf = () => page.evaluate(() => localStorage.getItem('court-access-token'));
const expOf = (t) => (t ? JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString()).exp : null);

// --- Fresh login --------------------------------------------------------------
await signIn();
const firstToken = await tokenOf();
const refreshToken = await page.evaluate(() => localStorage.getItem('court-access-refresh-token'));

firstToken && page.url().includes('/dashboard')
  ? results.pass('SES-01', 'A fresh login signs in and stores an access token', `expires ${new Date(expOf(firstToken) * 1000).toISOString()}`)
  : results.fail('SES-01', 'Fresh login did not establish a session', page.url());

refreshToken
  ? results.pass('SES-02', 'A refresh token is stored alongside the access token', 'available for renewal')
  : results.fail('SES-02', 'No refresh token was stored, so renewal is impossible');

// --- Reaching the module normally ---------------------------------------------
await page.goto(`${BASE}/admin/gold-standard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
let text = (await page.textContent('body')) ?? '';
!/jwt expired|That did not work/i.test(text) && /Gold Standard Certification/i.test(text)
  ? results.pass('SES-03', 'The Gold Standard page loads on a valid session', 'no error banner')
  : results.fail('SES-03', 'The Gold Standard page errored on a valid session', text.slice(0, 200));

// --- The token expires while the user is sitting on the page -------------------
// Replace the stored token with one the server will genuinely reject.
const decoded = JSON.parse(Buffer.from(firstToken.split('.')[1], 'base64').toString());
const expiredToken = jwt.sign(
  { userId: decoded.userId, tenantId: decoded.tenantId, role: decoded.role, email: decoded.email },
  JWT_SECRET,
  { expiresIn: '-10m' },
);
await page.evaluate((t) => localStorage.setItem('court-access-token', t), expiredToken);

const storedExpiry = expOf(expiredToken);
results.pass(
  'SES-04',
  'The browser is now holding a genuinely expired token',
  `expired at ${new Date(storedExpiry * 1000).toISOString()}, ${Math.round((Date.now() / 1000 - storedExpiry) / 60)} minutes ago`,
);

// Navigate within the app, which is what the operator was doing.
await page.goto(`${BASE}/admin/gold-standard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
text = (await page.textContent('body')) ?? '';
const tokenAfter = await tokenOf();
await page.screenshot({ path: path.join(SHOTS, 'session_after_expiry.png') });

!/jwt expired/i.test(text)
  ? results.pass('SES-05', 'The raw backend wording "jwt expired" is never shown to the operator')
  : results.fail('SES-05', 'The raw backend error is still displayed', text.slice(0, 250));

tokenAfter && tokenAfter !== expiredToken && expOf(tokenAfter) > Date.now() / 1000
  ? results.pass(
      'SES-06',
      'An expired token is renewed automatically without the operator signing in again',
      `new token valid to ${new Date(expOf(tokenAfter) * 1000).toISOString()}`,
    )
  : results.fail('SES-06', 'The expired token was not renewed', `token changed: ${tokenAfter !== expiredToken}`);

page.url().includes('/admin/gold-standard') && /Gold Standard Certification/i.test(text)
  ? results.pass('SES-07', 'The operator stays on the page they were using', page.url())
  : results.fail('SES-07', 'The operator was thrown off the page', page.url());

/Gold Standard Certification/i.test(text) && !/That did not work/i.test(text)
  ? results.pass('SES-08', 'Certification corpora load after the renewal', 'no error banner after renewal')
  : results.fail('SES-08', 'The page still failed to load its data', text.slice(0, 250));

// --- The import page too --------------------------------------------------------
await page.locator('button:has-text("Import")').first().click().catch(() => {});
await page.waitForTimeout(1500);
(await page.locator('[data-testid="upload-dropzone"]').count()) > 0
  ? results.pass('SES-09', 'The import page works after a renewal', 'upload portal rendered')
  : results.fail('SES-09', 'The import page did not render after a renewal');

// --- Browser refresh ------------------------------------------------------------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
text = (await page.textContent('body')) ?? '';
/Gold Standard Certification/i.test(text) && !/jwt expired/i.test(text)
  ? results.pass('SES-10', 'A browser refresh keeps the session', 'page reloaded signed in')
  : results.fail('SES-10', 'A browser refresh broke the session', text.slice(0, 200));

// --- Navigation between pages ----------------------------------------------------
let navOk = true;
for (const route of ['/dashboard', '/cases', '/admin', '/admin/gold-standard']) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const t = (await page.textContent('body')) ?? '';
  if (/jwt expired/i.test(t) || page.url().includes('/login')) navOk = false;
}
navOk
  ? results.pass('SES-11', 'Navigating between pages keeps the session', '4 routes visited')
  : results.fail('SES-11', 'Navigation broke the session');

// --- Renewal that cannot succeed ---------------------------------------------------
// Expired access token and a refresh token the server will not honour: the
// only correct outcome is a clean return to sign-in with a readable reason.
await page.evaluate((t) => {
  localStorage.setItem('court-access-token', t);
  localStorage.setItem('court-access-refresh-token', 'not-a-valid-refresh-token');
}, expiredToken);

await page.goto(`${BASE}/admin/gold-standard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
text = (await page.textContent('body')) ?? '';
await page.screenshot({ path: path.join(SHOTS, 'session_renewal_failed.png') });

page.url().includes('/login')
  ? results.pass('SES-12', 'When renewal cannot succeed the operator is returned to sign-in', page.url())
  : results.fail('SES-12', 'A failed renewal did not return the operator to sign-in', page.url());

/Your session has expired\. Please sign in again\./i.test(text)
  ? results.pass('SES-13', 'The sign-in page explains why the operator is there', 'session expiry message shown')
  : results.fail('SES-13', 'No explanation was given for the return to sign-in', text.slice(0, 250));

!/jwt expired/i.test(text)
  ? results.pass('SES-14', 'No raw backend error reaches the operator on a failed renewal')
  : results.fail('SES-14', 'Raw backend wording leaked on a failed renewal', text.slice(0, 200));

// --- Sign in again ------------------------------------------------------------------
await signIn();
await page.goto(`${BASE}/admin/gold-standard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
text = (await page.textContent('body')) ?? '';
/Gold Standard Certification/i.test(text) && !/jwt expired/i.test(text)
  ? results.pass('SES-15', 'Signing in again restores full access to the module', 'module loaded')
  : results.fail('SES-15', 'Signing in again did not restore access', text.slice(0, 200));

// --- Logout -------------------------------------------------------------------------
await page.locator('button:has-text("Logout"), a:has-text("Logout")').first().click().catch(() => {});
await page.waitForTimeout(2500);
const clearedToken = await tokenOf();
!clearedToken
  ? results.pass('SES-16', 'Logout clears the stored session', 'no access token remains')
  : results.warn('SES-16', 'A token remained after logout', String(clearedToken).slice(0, 24));

pageErrors.length === 0
  ? results.pass('SES-17', 'No uncaught JavaScript exceptions across the session workflow')
  : results.fail('SES-17', 'Uncaught JavaScript exceptions occurred', pageErrors.slice(0, 3).join(' | '));

await browser.close();
await results.write({ base: BASE, accessTokenLifetimeMinutes: 15, refreshTokenLifetimeDays: 7 });
await prisma.$disconnect();
