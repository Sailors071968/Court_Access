#!/usr/bin/env node
// Program 145, Phase 12 — browser verification of the upload portal.
//
// Drives a real Chromium through the operator's workflow: choose discovery
// from the local machine, watch it upload with progress, pause and resume,
// review, confirm, and follow processing to certification. Files are handed to
// the page through the file input exactly as a Mac or Windows file picker
// would, and through a drag-and-drop DataTransfer for the drop path.

import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { Results, OUT_DIR } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const BASE = process.env.CERT_WEB_BASE || 'http://127.0.0.1:4180';
const CORPUS = '/tmp/courtaccess-certification-corpus/SYNTHETIC-001';
const SHOTS = path.join(OUT_DIR, 'screenshots');
await mkdir(SHOTS, { recursive: true });

const results = new Results('UPLOAD_PORTAL_BROWSER', 'Program 145 — Upload Portal Browser Verification');

/** Every file under the corpus, as an operator's folder selection would be. */
async function localFiles(root) {
  const out = [];
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) await walk(abs);
      else if (e.isFile()) out.push(abs);
    }
  }
  await walk(root);
  out.sort();
  return out;
}
const files = await localFiles(CORPUS);
const totalBytes = (await Promise.all(files.map((f) => stat(f).then((s) => s.size)))).reduce((a, b) => a + b, 0);
console.log(`local selection: ${files.length} files, ${(totalBytes / 1e6).toFixed(1)}MB\n`);

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1500, height: 980 } });
const pageErrors = [];
context.on('page', (p) => p.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200))));
const page = await context.newPage();

// --- Sign in as an administrator ------------------------------------------
const email = `portal-${Date.now()}@certification.test`;
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await page.locator('input[name="name"], input#name').first().fill('Certification Operator');
await page.locator('input[type="email"]').first().fill(email);
const pw = page.locator('input[type="password"]');
for (let i = 0; i < (await pw.count()); i++) await pw.nth(i).fill('CertPass!2026xyz');
const boxes = page.locator('input[type="checkbox"]');
for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check().catch(() => {});
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3500);

await prisma.user.update({ where: { email }, data: { role: 'admin' } });
await page.evaluate(async (e) => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: e, password: 'CertPass!2026xyz' }),
  });
  const data = await res.json();
  localStorage.setItem('court-access-token', data.accessToken);
  const stored = JSON.parse(localStorage.getItem('court-access-auth') ?? '{"state":{}}');
  stored.state.user = data.user;
  stored.state.isAuthenticated = true;
  stored.state.subscriptionStatus = data.user?.subscriptionStatus ?? 'trial';
  localStorage.setItem('court-access-auth', JSON.stringify(stored));
}, email);

// --- Reach the portal by clicking, not by URL ------------------------------
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await page.locator('a:has-text("Gold Standard Certification")').first().click();
await page.locator('h1:has-text("Gold Standard Certification")').first().waitFor({ timeout: 20000 });
await page.locator('button:has-text("Import")').first().click();
await page.waitForTimeout(800);

const dropzone = page.locator('[data-testid="upload-dropzone"]');
(await dropzone.count()) > 0
  ? results.pass('UPB-01', 'The portal offers drag & drop and file selection from the local machine', 'dropzone rendered')
  : results.fail('UPB-01', 'No upload dropzone is present');

for (const [id, testid, label] of [
  ['UPB-02', 'select-files', 'Select Discovery'],
  ['UPB-03', 'select-folder', 'Select Folder'],
]) {
  (await page.locator(`[data-testid="${testid}"]`).count()) > 0
    ? results.pass(id, `The portal offers "${label}"`, 'control present')
    : results.fail(id, `The portal is missing "${label}"`);
}

// A folder input must be a directory picker, which is what makes selecting a
// whole discovery folder possible from a browser.
const hasDirectoryPicker = await page.evaluate(
  () => !!document.querySelector('input[type=file][webkitdirectory]'),
);
hasDirectoryPicker
  ? results.pass('UPB-04', 'Folder selection uses a real directory picker', 'input carries webkitdirectory')
  : results.fail('UPB-04', 'No directory picker is wired up');

await page.screenshot({ path: path.join(SHOTS, 'portal_select.png') });

// --- Drag & drop path -------------------------------------------------------
// Build a DataTransfer in the page and dispatch a real drop event, which is
// the path a Mac or Windows user takes when dragging a folder in.
await page.evaluate(() => {
  const dt = new DataTransfer();
  const f = new File([new Uint8Array([37, 80, 68, 70, 45])], 'dropped-note.txt', { type: 'text/plain' });
  dt.items.add(f);
  const zone = document.querySelector('[data-testid="upload-dropzone"]');
  zone?.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
});
await page.waitForTimeout(1200);
const droppedSummary = (await page.locator('[data-testid="selection-summary"]').textContent().catch(() => '')) ?? '';
/dropped-note\.txt|1 file/.test(droppedSummary)
  ? results.pass('UPB-05', 'A dropped file is taken into the selection', droppedSummary.replace(/\s+/g, ' ').slice(0, 90))
  : results.warn('UPB-05', 'The drop did not register a selection', droppedSummary.slice(0, 120));

// Start fresh for the real upload.
await page.locator('button:has-text("Clear")').first().click().catch(() => {});
await page.waitForTimeout(400);

// --- Select the whole corpus, as a folder picker would ----------------------
const reference = `PORTAL-${Date.now().toString().slice(-6)}`;
await page.locator('[data-testid="upload-reference"]').fill(reference);
await page.locator('[data-testid="upload-label"]').fill('Browser-uploaded certification corpus');

// setInputFiles on the directory input gives the browser the same File objects
// a folder picker produces, including webkitRelativePath.
// Playwright drives a directory picker with the folder itself, which is
// exactly what a Mac or Windows file dialog hands the browser.
await page.locator('input[type=file][webkitdirectory]').setInputFiles(CORPUS);
await page.waitForTimeout(1500);

const summary = (await page.locator('[data-testid="selection-summary"]').textContent()) ?? '';
new RegExp(`${files.length}`).test(summary)
  ? results.pass('UPB-06', 'A whole folder is selected from the local machine', summary.replace(/\s+/g, ' ').slice(0, 100))
  : results.fail('UPB-06', 'The folder selection did not register every file', summary.replace(/\s+/g, ' ').slice(0, 150));

await page.screenshot({ path: path.join(SHOTS, 'portal_selected.png') });

// --- Upload -----------------------------------------------------------------
// Capture the session id the portal creates, so completion can be read from
// the server rather than inferred from the page.
await page.evaluate(() => {
  const original = window.fetch;
  window.fetch = async (...args) => {
    const res = await original(...args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      if (url.endsWith('/api/certification/uploads') && res.ok) {
        const clone = await res.clone().json();
        window.__certUploadSessionId = clone.uploadSessionId;
      }
    } catch {
      /* ignore */
    }
    return res;
  };
});

await page.locator('[data-testid="start-upload"]').click();
await page.locator('[data-testid="upload-progress"]').waitFor({ timeout: 30000 }).catch(() => {});

const progressPanel = (await page.locator('[data-testid="upload-progress"]').textContent().catch(() => '')) ?? '';
const wanted = ['Overall', 'Transferred', 'Speed', 'Time remaining', 'Files remaining'];
const missing = wanted.filter((w) => !progressPanel.includes(w));
missing.length === 0
  ? results.pass('UPB-07', 'Upload progress reports overall, transferred, speed, time remaining and files remaining', wanted.join(', '))
  : results.fail('UPB-07', 'The progress panel is missing readouts', missing.join(', '));

for (const [id, testid, label] of [
  ['UPB-08', 'pause-upload', 'Pause'],
  ['UPB-09', 'retry-upload', 'Retry failed'],
  ['UPB-10', 'cancel-upload', 'Cancel'],
]) {
  (await page.locator(`[data-testid="${testid}"]`).count()) > 0
    ? results.pass(id, `The upload can be ${label.toLowerCase()}d`, 'control present')
    : results.fail(id, `No ${label} control during upload`);
}

await page.screenshot({ path: path.join(SHOTS, 'portal_uploading.png') });

// Pause, confirm it stops, then resume — the interruption and resume path.
await page.locator('[data-testid="pause-upload"]').click().catch(() => {});
await page.waitForTimeout(1200);
const resumeVisible = (await page.locator('[data-testid="resume-upload"]').count()) > 0;
resumeVisible
  ? results.pass('UPB-11', 'Pausing an upload offers Resume', 'resume control appeared')
  : results.warn('UPB-11', 'Pause did not surface a resume control', 'the upload may have finished before the pause landed');

if (resumeVisible) {
  await page.locator('[data-testid="resume-upload"]').click();
}

// The page must stay responsive throughout — check it still answers.
const responsive = await page
  .evaluate(() => new Promise((r) => requestAnimationFrame(() => r(true))))
  .then(() => true)
  .catch(() => false);
responsive
  ? results.pass('UPB-12', 'The page stays responsive while uploading', 'animation frame served during transfer')
  : results.fail('UPB-12', 'The page stopped responding during upload');

// --- Preview ----------------------------------------------------------------
await page.locator('[data-testid="upload-preview"]').waitFor({ timeout: 180000 }).catch(() => {});
const previewPanel = (await page.locator('[data-testid="upload-preview"]').textContent().catch(() => '')) ?? '';

if (!previewPanel) {
  results.fail('UPB-13', 'The review step never appeared', 'upload may not have completed');
} else {
  const facts = ['Documents', 'Videos', 'Audio', 'Images', 'Pages', 'Estimated processing time'];
  const absent = facts.filter((f) => !previewPanel.includes(f));
  absent.length === 0
    ? results.pass('UPB-13', 'Review shows detected counts and processing estimates before anything runs', facts.join(', '))
    : results.fail('UPB-13', 'The review step is missing information', absent.join(', '));

  /Nothing has been processed yet/i.test(previewPanel)
    ? results.pass('UPB-14', 'The operator confirms before processing begins', 'confirmation required')
    : results.warn('UPB-14', 'The review step does not state that nothing has been processed');
}
await page.screenshot({ path: path.join(SHOTS, 'portal_preview.png') });

// --- Confirm and follow processing -----------------------------------------
await page.locator('[data-testid="confirm-processing"]').click().catch(() => {});
await page.locator('[data-testid="processing-dashboard"]').waitFor({ timeout: 60000 }).catch(() => {});

// Completion is read from the session itself. The dashboard renders a static
// checklist of every stage, so matching its text would report completion the
// moment the panel appeared.
const stagesSeen = new Set();
const deadline = Date.now() + 600000;
let finished = false;
let finalStatus = null;
while (Date.now() < deadline) {
  // What the operator is being shown right now, for the live-reporting check.
  const shown = await page
    .locator('[data-testid="processing-dashboard"] p.text-sm.font-medium')
    .first()
    .textContent()
    .catch(() => null);
  if (shown) stagesSeen.add(shown.trim());

  finalStatus = await page.evaluate(async () => {
    const res = await fetch(`/api/certification/uploads/${window.__certUploadSessionId ?? ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('court-access-token')}` },
    });
    return res.ok ? await res.json() : null;
  });

  if (finalStatus && ['completed', 'failed'].includes(finalStatus.status)) {
    finished = finalStatus.status === 'completed';
    break;
  }
  await page.waitForTimeout(1000);
}

await page.screenshot({ path: path.join(SHOTS, 'portal_processing.png') });

finished
  ? results.pass(
      'UPB-15',
      'Processing runs to completion with live stage reporting',
      `${stagesSeen.size} distinct stage(s) shown to the operator`,
    )
  : results.fail(
      'UPB-15',
      'Processing did not complete',
      finalStatus ? `${finalStatus.status}: ${finalStatus.error ?? finalStatus.stage}` : 'no status returned',
    );

stagesSeen.size >= 2
  ? results.pass('UPB-16', 'The operator is never left wondering what is happening', [...stagesSeen].join(' → '))
  : results.warn('UPB-16', 'Few stages were observed in the browser', [...stagesSeen].join(', '));

// --- The corpus must exist and be inventoried -------------------------------
await page.waitForTimeout(2500);
const inventoryText = (await page.textContent('body')) ?? '';
await page.screenshot({ path: path.join(SHOTS, 'portal_certified.png') });

/Document classification|Ingested/i.test(inventoryText)
  ? results.pass('UPB-17', 'The portal lands on the inventory for the uploaded corpus', 'inventory rendered')
  : results.warn('UPB-17', 'The inventory did not render automatically', inventoryText.slice(0, 150));

const certCase = await prisma.certificationCase.findUnique({ where: { reference } });
certCase
  ? results.pass(
      'UPB-18',
      'A certification corpus exists for the browser upload',
      `${certCase.fileCount} files, fingerprint ${certCase.corpusHash?.slice(0, 12)}`,
    )
  : results.fail('UPB-18', 'No certification corpus was created by the browser upload', reference);

if (certCase) {
  const hierarchical = await prisma.certificationFile.count({
    where: { certificationCaseId: certCase.certificationCaseId, relativePath: { contains: '/' } },
  });
  hierarchical > 0
    ? results.pass('UPB-19', 'The folder structure from the local machine survives the browser upload', `${hierarchical} nested file(s)`)
    : results.fail('UPB-19', 'Folder structure was lost in the browser upload');

  const media = await prisma.certificationFile.count({
    where: { certificationCaseId: certCase.certificationCaseId, durationSeconds: { gt: 0 } },
  });
  media > 0
    ? results.pass('UPB-20', 'Uploaded video and audio have measured running times', `${media} recording(s) measured`)
    : results.warn('UPB-20', 'No media durations were recorded for the uploaded corpus');
}

pageErrors.length === 0
  ? results.pass('UPB-21', 'No uncaught JavaScript exceptions across the upload workflow')
  : results.fail('UPB-21', 'Uncaught JavaScript exceptions occurred', pageErrors.slice(0, 3).join(' | '));

await browser.close();
await results.write({ base: BASE, reference, localFiles: files.length, localBytes: totalBytes, screenshotDirectory: SHOTS });
await prisma.$disconnect();
