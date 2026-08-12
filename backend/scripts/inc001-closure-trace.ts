#!/usr/bin/env tsx
/**
 * INC-001 closure evidence collector (production only).
 *
 * Usage:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... \
 *   INC001_PDF=/path/to/SACJAILSCAN08-12-2026.pdf \
 *   npx tsx scripts/inc001-closure-trace.ts
 *
 * Does not mark the incident resolved. Writes a JSON ledger under
 * reports/niis-reliability/production/ for human sign-off on Tests 1–10.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const BASE = process.env.PRODUCTION_URL ?? 'https://courtaccess.net';
const EXPECTED_SHA = '1b4a8e346f55249b54a7c0c67901594346fef3a1d6f3b95eb6822d3c4eb299e8';
const EXPECTED_SIZE = 14_815_141;

async function login(): Promise<string> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD required');
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

async function api(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* html reports */ }
  return { status: res.status, json, text };
}

async function main() {
  const pdfPath = process.env.INC001_PDF ? resolve(process.env.INC001_PDF) : '';
  const token = await login();
  const health = await api(token, '/api/health');
  const ledger: Record<string, unknown> = {
    incident: 'INC-001',
    generatedAt: new Date().toISOString(),
    target: BASE,
    health: health.json,
    status: 'OPEN',
    tests: {} as Record<string, unknown>,
  };

  if (!pdfPath || !existsSync(pdfPath)) {
    ledger.blocker = 'INC001_PDF missing — cannot run Test 1';
    writeLedger(ledger);
    console.error(JSON.stringify({ ok: false, blocker: ledger.blocker }, null, 2));
    process.exit(2);
  }

  const bytes = readFileSync(pdfPath);
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== EXPECTED_SHA || bytes.length !== EXPECTED_SIZE) {
    ledger.blocker = {
      message: 'PDF fingerprint mismatch — refuse to close against wrong file',
      sha,
      size: bytes.length,
      expectedSha: EXPECTED_SHA,
      expectedSize: EXPECTED_SIZE,
    };
    writeLedger(ledger);
    console.error(JSON.stringify(ledger.blocker, null, 2));
    process.exit(3);
  }

  const created = await api(token, '/api/admin/intelligence/import-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      facility: 'sacramento',
      rosterDate: '2026-08-12',
      label: 'INC-001 closure SACJAIL 08-12',
      autoProcess: true,
      files: [{ name: basename(pdfPath), sizeBytes: bytes.length, sha256: sha }],
    }),
  });
  const createdBody = created.json as {
    job: { jobId: string };
    decisions: { jobFileId: string; action: string }[];
  };
  const jobId = createdBody.job.jobId;
  const jobFileId = createdBody.decisions[0]?.jobFileId;
  ledger.create = { status: created.status, jobId, jobFileId };

  const form = new FormData();
  form.append('batchIndex', '0');
  form.append('jobFileId', jobFileId);
  form.append('files', new Blob([bytes], { type: 'application/pdf' }), basename(pdfPath));

  const uploadStarted = Date.now();
  const uploadRes = await fetch(`${BASE}/api/admin/intelligence/import-jobs/${jobId}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const uploadJson = await uploadRes.json() as {
    accepted: unknown[];
    autoProcessStarted: boolean;
    job: {
      uploadedBytes: number;
      uploadStartedAt: string | null;
      uploadFinishedAt: string | null;
      status: string;
      processStartedAt: string | null;
    };
  };
  ledger.upload = {
    httpStatus: uploadRes.status,
    durationMs: Date.now() - uploadStarted,
    autoProcessStarted: uploadJson.autoProcessStarted,
    job: uploadJson.job,
  };

  // Poll job/files briefly for parser start
  let jobAfter = uploadJson.job;
  let filesAfter: unknown = null;
  for (let i = 0; i < 60; i++) {
    const j = await api(token, `/api/admin/intelligence/import-jobs/${jobId}`);
    jobAfter = j.json as typeof jobAfter;
    const f = await api(token, `/api/admin/intelligence/import-jobs/${jobId}/files`);
    filesAfter = f.json;
    if (jobAfter.processStartedAt || ['processing', 'completed', 'queued'].includes(jobAfter.status)) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  ledger.jobAfter = jobAfter;
  ledger.filesAfter = filesAfter;

  const morning = await api(token, '/api/admin/intelligence/morning');
  const newInmates = await api(token, '/api/admin/intelligence/new-inmates?limit=20');
  const report = await api(token, '/api/admin/intelligence/reports/new-inmates');

  const tests = {
    t1_uploadedBytes: { pass: (jobAfter.uploadedBytes ?? 0) > 0, uploadedBytes: jobAfter.uploadedBytes },
    t2_timestamps: {
      pass: Boolean(jobAfter.uploadStartedAt && jobAfter.uploadFinishedAt),
      uploadStartedAt: jobAfter.uploadStartedAt,
      uploadFinishedAt: jobAfter.uploadFinishedAt,
    },
    t3_jobFileUploaded: {
      pass: JSON.stringify(filesAfter).includes('"status":"uploaded"')
        || JSON.stringify(filesAfter).includes('"status":"queued"')
        || JSON.stringify(filesAfter).includes('"status":"processing"')
        || JSON.stringify(filesAfter).includes('"status":"completed"'),
      files: filesAfter,
    },
    t4_parserAutoStarted: {
      pass: Boolean(uploadJson.autoProcessStarted || jobAfter.processStartedAt),
      autoProcessStarted: uploadJson.autoProcessStarted,
      processStartedAt: jobAfter.processStartedAt,
    },
    t5_canonicalRoster: { pass: null, note: 'Inspect batch/roster rows after processing settles' },
    t6_comparison: { pass: null, note: 'Inspect comparison batch for rosterDate 2026-08-12' },
    t7_morningOps: { pass: null, morning: morning.json },
    t8_newInmates: { pass: null, newInmates: newInmates.json },
    t9_report: { pass: report.status === 200 && report.text.includes('New inmate'), bytes: report.text.length },
    t10_evidencePreserved: {
      pass: Boolean(jobId && jobFileId && (jobAfter.uploadedBytes ?? 0) > 0),
      jobId,
      jobFileId,
    },
  };
  ledger.tests = tests;

  const hardPass = Boolean(
    tests.t1_uploadedBytes.pass
    && tests.t2_timestamps.pass
    && tests.t3_jobFileUploaded.pass
    && tests.t4_parserAutoStarted.pass
    && tests.t10_evidencePreserved.pass,
  );
  ledger.status = hardPass ? 'PARTIAL_PASS_BYTES_AND_PARSER' : 'FAIL';
  ledger.resolved = false;
  ledger.note = 'INC-001 RESOLVED only when Tests 1–10 are all PASS with production evidence.';

  writeLedger(ledger);
  console.log(JSON.stringify({ status: ledger.status, tests }, null, 2));
  process.exit(hardPass ? 0 : 1);
}

function writeLedger(ledger: Record<string, unknown>) {
  const dir = resolve(process.cwd(), '../reports/niis-reliability/production');
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, 'INC001_CLOSURE_EVIDENCE.json');
  writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`);
  console.error(`wrote ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
