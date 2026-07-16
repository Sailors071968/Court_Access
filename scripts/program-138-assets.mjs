// ============================================================================
// Program 138 — Social media asset library capture
// Captures the cinematic Attorney/Client Demonstration across scenes at 9:16
// (Instagram Reel / TikTok / YouTube Shorts) and 16:9 (hero / presentation).
// Every frame shows the permanent ILLUSTRATIVE DEMONSTRATION label. Screenshot-
// only; no console-error gate.
// ============================================================================

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.env.OUT || 'reports/screenshots/program-138-assets';
mkdirSync(OUT, { recursive: true });
const CREDS = {
  email: process.env.REVIEW_EMAIL || 'attorney2@courtaccess.test',
  password: process.env.REVIEW_PASSWORD || 'TestPass123!',
};
const PATH = '/dashboard/attorney-client-demo';

async function login(page) {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { email: CREDS.email, password: CREDS.password },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`);
  const auth = await res.json();
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

async function gotoScene(page, sceneIndex) {
  // Scene dots have aria-label "Scene N".
  try { await page.click(`button[aria-label="Scene ${sceneIndex + 1}"]`, { timeout: 2000 }); } catch { /* ignore */ }
  await page.waitForTimeout(500);
}

async function run() {
  const browser = await chromium.launch();
  try {
    // 9:16 vertical — Instagram Reel / TikTok / YouTube Shorts
    const vert = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
    const vp = await vert.newPage();
    await login(vp);
    await vp.goto(`${BASE}${PATH}`, { waitUntil: 'networkidle' });
    await vp.waitForTimeout(1000);
    await gotoScene(vp, 0);
    await vp.screenshot({ path: `${OUT}/instagram-reel-scene1-hook.png` });
    await gotoScene(vp, 2);
    await vp.screenshot({ path: `${OUT}/tiktok-scene3-opportunities.png` });
    await gotoScene(vp, 5);
    await vp.screenshot({ path: `${OUT}/youtube-shorts-scene6-closing.png` });
    // Expand a traceability card for a citation-focused frame.
    try { await vp.click('button:has-text("Trace evidence")', { timeout: 2000 }); } catch { /* ignore */ }
    await vp.waitForTimeout(400);
    await vp.screenshot({ path: `${OUT}/vertical-traceability.png` });
    await vert.close();

    // 16:9 — hero / presentation slide
    const wide = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
    const wp = await wide.newPage();
    await login(wp);
    await wp.goto(`${BASE}${PATH}`, { waitUntil: 'networkidle' });
    await wp.waitForTimeout(1000);
    await wp.screenshot({ path: `${OUT}/hero-16x9.png` });
    await wp.screenshot({ path: `${OUT}/presentation-full.png`, fullPage: true });
    await wide.close();

    console.log(`Social media assets written to ${OUT}`);
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
