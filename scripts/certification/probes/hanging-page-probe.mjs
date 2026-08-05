#!/usr/bin/env node
// Three case workspace tabs never reach network idle. Records what they are
// requesting so the loop can be identified.

import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4180';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

// Sign in.
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
const email = `hang-${Date.now()}@certification.test`;
await page.locator('input[name="name"], input#name').first().fill('Hang Probe');
await page.locator('input[type="email"]').first().fill(email);
const pw = page.locator('input[type="password"]');
for (let i = 0; i < (await pw.count()); i++) await pw.nth(i).fill('CertPass!2026xyz');
const boxes = page.locator('input[type="checkbox"]');
for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check().catch(() => {});
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(4000);

const caseId = await page.evaluate(async () => {
  const res = await fetch('/api/cases', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('court-access-token')}`,
    },
    body: JSON.stringify({
      title: 'Hang probe',
      caseNumber: `HANG-${Date.now()}`,
      jurisdiction: 'Alameda County',
      caseType: 'felony',
    }),
  });
  return (await res.json()).case?.caseId;
});

for (const tab of ['documents', 'trial-exhibits', 'litigation-strategy', 'evidence']) {
  const timeline = [];
  const t0 = Date.now();
  page.on('request', (r) => timeline.push([Date.now() - t0, 'req', r.resourceType(), r.url().slice(0, 90)]));
  page.on('websocket', (ws) => timeline.push([Date.now() - t0, 'ws', 'websocket', ws.url().slice(0, 90)]));

  await page.goto(`${BASE}/cases/${caseId}/${tab}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(10000);

  page.removeAllListeners('request');
  page.removeAllListeners('websocket');

  console.log(`\n/cases/:id/${tab} — ${timeline.length} network events in 10s`);
  for (const [t, kind, type, url] of timeline.slice(-12)) console.log(`    ${String(t).padStart(6)}ms ${kind} ${type} ${url}`);

  const idle = await page
    .waitForLoadState('networkidle', { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  console.log(`  reached network idle: ${idle}`);
}

await browser.close();
