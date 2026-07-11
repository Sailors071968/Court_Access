#!/usr/bin/env node
/**
 * Phase 1 — Local UI screenshots (pre-production / staging verification)
 * Captures public pages + auth forms from vite preview.
 * Dashboard screenshots require authenticated session (post-deploy).
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { setTimeout as sleep } from 'timers/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VITE_BIN = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.join(ROOT, 'reports/screenshots/phase-01');

const ROUTES = [
  { path: '/', name: 'landing' },
  { path: '/pricing', name: 'pricing' },
  { path: '/register', name: 'signup' },
  { path: '/login', name: 'login' },
  { path: '/features', name: 'features' },
  { path: '/attorney', name: 'attorneys' },
  { path: '/investigator', name: 'investigators' },
  { path: '/defendant', name: 'defendants' },
  { path: '/onboarding', name: 'onboarding' },
];

async function startPreview() {
  const proc = spawn(process.execPath, [VITE_BIN, 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const res = await fetch(BASE);
      if (res.ok) return proc;
    } catch { /* retry */ }
  }
  proc.kill();
  throw new Error('Preview server failed to start');
}

const server = await startPreview();
mkdirSync(OUT_DIR, { recursive: true });
const screenshots = [];
const errors = [];

try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  for (const { path, name } of ROUTES) {
    try {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
      if (!res || res.status() >= 400) {
        errors.push(`${path} returned ${res?.status()}`);
        continue;
      }
      const file = `${OUT_DIR}/${name}-desktop.png`;
      await page.screenshot({ path: file, fullPage: true });
      screenshots.push(file);
    } catch (e) {
      errors.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await browser.close();
} finally {
  server.kill();
}

const report = {
  phase: 'PHASE-01',
  name: 'Production Website Screenshots (local)',
  verifiedAt: new Date().toISOString(),
  screenshots,
  routesCaptured: screenshots.length,
  errors,
  status: errors.length === 0 ? 'PASS' : 'PARTIAL',
  note: 'Dashboard screenshots (attorney/investigator/defendant/admin) require post-deploy authenticated flows.',
};

writeFileSync(path.join(ROOT, 'reports/PHASE_01_SCREENSHOTS.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(errors.length === 0 ? 0 : 1);
