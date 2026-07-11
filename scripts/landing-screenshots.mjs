#!/usr/bin/env node
/**
 * Capture landing page screenshots for regression recovery documentation.
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;

async function startPreview() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const res = await fetch(BASE);
      if (res.ok) return proc;
    } catch {
      /* retry */
    }
  }
  proc.kill();
  throw new Error('Preview server failed to start');
}

async function capture(label, outDir) {
  const server = await startPreview();
  const browser = await chromium.launch({ headless: true });
  const contexts = {
    desktop: { viewport: { width: 1440, height: 900 } },
    tablet: { viewport: { width: 768, height: 1024 } },
    mobile: { viewport: { width: 390, height: 844 } },
  };

  const results = { links: [], errors: [] };

  for (const [device, opts] of Object.entries(contexts)) {
    const page = await browser.newPage(opts);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: `${outDir}/${label}-${device}.png`,
      fullPage: true,
    });
    await page.close();
  }

  // Verify key routes from restored landing page
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const routes = ['/', '/login', '/register', '/pricing', '/privacy', '/terms', '/legal-disclaimer'];
  for (const route of routes) {
    const res = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    results.links.push({ route, status: res?.status() ?? 0 });
    if (!res || res.status() >= 400) {
      results.errors.push(`Route ${route} returned ${res?.status()}`);
    }
  }

  // Check hero CTA and nav anchors exist
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const heroText = await page.textContent('h1');
  results.heroText = heroText?.trim().slice(0, 120) ?? '';
  const registerLinks = await page.locator('a[href="/register"], a[href*="register"]').count();
  results.registerCtaCount = registerLinks;

  await browser.close();
  server.kill();
  return results;
}

const label = process.argv[2] || 'after';
const outDir = process.argv[3] || resolve(repoRoot, 'reports/screenshots/landing-recovery');

const results = await capture(label, outDir);
console.log(JSON.stringify(results, null, 2));
