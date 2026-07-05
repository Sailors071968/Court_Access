#!/usr/bin/env node
/**
 * Program 0 — Production Website Verification
 * Routes, responsive screenshots, landing headline assertion
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { setTimeout as sleep } from 'timers/promises';

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_DIR = '/workspace/reports/screenshots/program-00';

const PROGRAM_00_ROUTES = [
  '/',
  '/pricing',
  '/about',
  '/features',
  '/faq',
  '/contact',
  '/login',
  '/register',
  '/forgot-password',
  '/verify-email',
  '/privacy',
  '/terms',
  '/legal-disclaimer',
];

async function startPreview() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: '/workspace',
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

const server = await startPreview();
const browser = await chromium.launch({ headless: true });
const results = {
  routes: [],
  headlineCheck: false,
  screenshots: [],
  errors: [],
};

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  for (const route of PROGRAM_00_ROUTES) {
    const res = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    const status = res?.status() ?? 0;
    const ok = status >= 200 && status < 400;
    results.routes.push({ route, status, ok });
    if (!ok) results.errors.push(`Route ${route} returned ${status}`);
  }

  await page.goto(BASE, { waitUntil: 'networkidle' });
  const bodyText = await page.textContent('body');
  results.headlineCheck = bodyText?.includes('Criminal Case Intelligence Platform') ||
    bodyText?.includes('Criminal Case May Have Defenses') || false;
  if (!results.headlineCheck) {
    results.errors.push('Landing page missing expected production headline/branding');
  }

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    const vpPage = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await vpPage.goto(BASE, { waitUntil: 'networkidle' });
    const path = `${OUT_DIR}/landing-${vp.name}.png`;
    await vpPage.screenshot({ path, fullPage: true });
    results.screenshots.push(path);
    await vpPage.close();
  }

  // Key pages screenshots
  for (const route of ['/about', '/features', '/faq', '/privacy']) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    const slug = route.slice(1);
    const path = `${OUT_DIR}/${slug}-desktop.png`;
    await page.screenshot({ path, fullPage: true });
    results.screenshots.push(path);
  }
} finally {
  await browser.close();
  server.kill();
}

const landingSource = readFileSync('/workspace/src/pages/LandingPage.tsx', 'utf8');
const buildOk = landingSource.includes('Criminal Case Intelligence Platform');

const report = {
  program: 'PROGRAM-00',
  name: 'Production Website',
  verifiedAt: new Date().toISOString(),
  routesTotal: PROGRAM_00_ROUTES.length,
  routesPass: results.routes.filter((r) => r.ok).length,
  headlineCheck: results.headlineCheck,
  buildSourceCheck: buildOk,
  screenshots: results.screenshots,
  routes: results.routes,
  errors: results.errors,
  status: results.errors.length === 0 && buildOk ? 'PASS' : 'FAIL',
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.status === 'PASS' ? 0 : 1);
