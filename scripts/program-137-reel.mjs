// ============================================================================
// Program 136 — Instagram Reel / hero screenshot capture (9:16 + hero)
// Captures the marketing Demonstration Mode at vertical (1080x1920) reel
// dimensions plus a wide hero shot. Logs in with the staging reviewer, then
// visits /dashboard/guided-demo (ILLUSTRATIVE DEMONSTRATION). No console-error
// gate here — this is a screenshot-only marketing capture.
// ============================================================================

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.env.OUT || 'reports/screenshots/program-137-reel';
mkdirSync(OUT, { recursive: true });
const CREDS = {
  email: process.env.REVIEW_EMAIL || 'attorney2@courtaccess.test',
  password: process.env.REVIEW_PASSWORD || 'TestPass123!',
};

async function login(page) {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { email: CREDS.email, password: CREDS.password },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`);
  const auth = await res.json();
  // Seed the same localStorage keys the app expects (zustand persist + tokens).
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ auth }) => {
    localStorage.setItem('court-access-token', auth.accessToken);
    localStorage.setItem('court-access-refresh-token', auth.refreshToken);
    localStorage.setItem('court-access-auth', JSON.stringify({
      state: { user: auth.user, isAuthenticated: true, subscriptionStatus: auth.user.subscriptionStatus || 'trial' },
      version: 0,
    }));
  }, { auth });
  return auth;
}

async function run() {
  const browser = await chromium.launch();
  try {
    // Reel (vertical 9:16)
    const reel = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
    const rp = await reel.newPage();
    await login(rp);
    await rp.goto(`${BASE}/dashboard/guided-demo`, { waitUntil: 'networkidle' });
    await rp.waitForTimeout(1200);
    await rp.screenshot({ path: `${OUT}/reel-01-hero.png` });
    // Scroll to first opportunity detail
    await rp.mouse.wheel(0, 700); await rp.waitForTimeout(600);
    await rp.screenshot({ path: `${OUT}/reel-02-opportunities.png` });
    await rp.mouse.wheel(0, 900); await rp.waitForTimeout(600);
    await rp.screenshot({ path: `${OUT}/reel-03-citations.png` });
    await reel.close();

    // Wide hero (16:9)
    const wide = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
    const wp = await wide.newPage();
    await login(wp);
    await wp.goto(`${BASE}/dashboard/guided-demo`, { waitUntil: 'networkidle' });
    await wp.waitForTimeout(1200);
    await wp.screenshot({ path: `${OUT}/hero-wide.png` });
    await wp.screenshot({ path: `${OUT}/hero-full.png`, fullPage: true });
    await wide.close();

    console.log(`Reel + hero screenshots written to ${OUT}`);
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
