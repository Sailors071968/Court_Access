#!/usr/bin/env node
// Confirms the three views whose backends are not implemented now say so
// instead of rendering a normal-looking empty workspace.

import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4180';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await page.locator('input[name="name"], input#name').first().fill('Notice Probe');
await page.locator('input[type="email"]').first().fill(`notice-${Date.now()}@certification.test`);
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
      title: 'Notice probe',
      caseNumber: `NOTICE-${Date.now()}`,
      jurisdiction: 'Alameda County',
      caseType: 'felony',
    }),
  });
  return (await res.json()).case?.caseId;
});

for (const tab of ['documents', 'trial-exhibits', 'litigation-strategy']) {
  await page.goto(`${BASE}/cases/${caseId}/${tab}`, { waitUntil: 'networkidle' });
  const text = (await page.textContent('body')).replace(/\s+/g, ' ').trim();
  const notice = /could not be loaded|not available for this case yet|still being rolled out/i.test(text);
  console.log(`\n/cases/:id/${tab}`);
  console.log(`  honest notice shown: ${notice}`);
  const match = text.match(/[^.]*(?:could not be loaded|not available for this case yet)[^.]*\./i);
  if (match) console.log(`  message: ${match[0].trim()}`);
}

await browser.close();
