#!/usr/bin/env node
// Phase 6/11 — Stress and performance certification.
//
// Measures the platform under load rather than asserting that it scales:
// case volume from 1 to 5,000, concurrent authenticated users, simultaneous
// uploads, a large multi-page PDF, and sustained API traffic. Every number
// reported here is measured in this run.

import { readFile } from 'node:fs/promises';
import { Results, req, registerUser, API } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('STRESS_CERTIFICATION', 'Phase 6/11 — Stress and Performance');
const measurements = {};

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
function stats(samples) {
  const s = [...samples].sort((a, b) => a - b);
  return {
    count: s.length,
    minMs: s[0],
    p50Ms: pct(s, 50),
    p95Ms: pct(s, 95),
    p99Ms: pct(s, 99),
    maxMs: s[s.length - 1],
    meanMs: Math.round(s.reduce((a, b) => a + b, 0) / s.length),
  };
}

async function serverMemory() {
  const res = await req('GET', '/api/health');
  return res.status === 200;
}

// ---------------------------------------------------------------------------
// Case volume
// ---------------------------------------------------------------------------

const owner = await registerUser({ prefix: 'stress-owner', defaultRole: 'attorney' });
if (!owner.token) throw new Error(`registration failed: ${owner.status}`);
const tenantId = owner.user.tenantId;
const ownerId = owner.user.userId;

console.log('--- case volume ---');
const VOLUMES = [1, 10, 100, 500, 5000];
let createdSoFar = 0;
const volumeResults = [];

for (const target of VOLUMES) {
  const toCreate = target - createdSoFar;

  // The first ten go through the HTTP API so the measured path is the real
  // one; the bulk fill is seeded directly because the point of the larger
  // steps is to measure read performance at volume, not insert throughput.
  const apiSamples = [];
  if (createdSoFar === 0) {
    for (let i = 0; i < Math.min(toCreate, 10); i++) {
      const r = await req('POST', '/api/cases', {
        token: owner.token,
        body: {
          title: `Stress case ${createdSoFar + i}`,
          caseNumber: `STRESS-${Date.now()}-${createdSoFar + i}`,
          jurisdiction: 'Alameda County',
          caseType: 'felony',
        },
      });
      if (r.status === 201) apiSamples.push(r.ms);
    }
  }

  const remaining = target - createdSoFar - apiSamples.length;
  if (remaining > 0) {
    const rows = Array.from({ length: remaining }, (_, i) => ({
      tenantId,
      ownerId,
      title: `Stress case ${createdSoFar + apiSamples.length + i}`,
      caseNumber: `STRESS-SEED-${createdSoFar + apiSamples.length + i}-${Date.now()}`,
      jurisdiction: 'Alameda County',
      caseType: 'felony',
    }));
    for (let i = 0; i < rows.length; i += 500) {
      await prisma.criminalCase.createMany({ data: rows.slice(i, i + 500) });
    }
  }
  createdSoFar = target;

  const listSamples = [];
  for (let i = 0; i < 5; i++) {
    const r = await req('GET', '/api/cases', { token: owner.token, timeoutMs: 120000 });
    if (r.status !== 200) {
      results.fail(`STRESS-CASES-${target}`, `Case list failed at ${target} cases`, `HTTP ${r.status}`);
      break;
    }
    listSamples.push(r.ms);
  }

  if (listSamples.length) {
    const s = stats(listSamples);
    volumeResults.push({ cases: target, listStats: s, apiCreateStats: apiSamples.length ? stats(apiSamples) : null });
    console.log(`  ${String(target).padStart(5)} cases  list p50=${s.p50Ms}ms p95=${s.p95Ms}ms max=${s.maxMs}ms`);
    results.pass(
      `STRESS-CASES-${target}`,
      `Case list responds with ${target} cases in the tenant`,
      `p50 ${s.p50Ms}ms, p95 ${s.p95Ms}ms, max ${s.maxMs}ms`,
      s,
    );
  }
}
measurements.caseVolume = volumeResults;

const at5000 = volumeResults.find((v) => v.cases === 5000);
if (at5000) {
  at5000.listStats.p95Ms < 5000
    ? results.pass('STRESS-CASES-LATENCY', 'Case list stays under 5s at 5,000 cases', `p95 ${at5000.listStats.p95Ms}ms`)
    : results.fail(
        'STRESS-CASES-LATENCY',
        'Case list exceeds 5s at 5,000 cases',
        `p95 ${at5000.listStats.p95Ms}ms — the endpoint returns every case with no pagination`,
        at5000.listStats,
      );
}

// ---------------------------------------------------------------------------
// Concurrent users
// ---------------------------------------------------------------------------

console.log('\n--- concurrent users ---');
const CONCURRENT_USERS = 25;
const userTokens = [];
for (let i = 0; i < CONCURRENT_USERS; i++) {
  const u = await registerUser({ prefix: `stress-u${i}` });
  if (u.token) userTokens.push(u.token);
}
results.add(
  'STRESS-USERS-REG',
  `${CONCURRENT_USERS} accounts registered for the concurrency test`,
  userTokens.length === CONCURRENT_USERS ? 'PASS' : 'WARNING',
  `${userTokens.length}/${CONCURRENT_USERS} succeeded`,
);

const REQUESTS_PER_USER = 20;
const concurrentStart = performance.now();
const concurrentSamples = [];
let concurrentErrors = 0;

await Promise.all(
  userTokens.map(async (t) => {
    for (let i = 0; i < REQUESTS_PER_USER; i++) {
      const r = await req('GET', '/api/auth/me', { token: t, timeoutMs: 60000 });
      if (r.status === 200) concurrentSamples.push(r.ms);
      else concurrentErrors++;
    }
  }),
);
const concurrentMs = Math.round(performance.now() - concurrentStart);
const totalRequests = userTokens.length * REQUESTS_PER_USER;
const cs = stats(concurrentSamples);
measurements.concurrency = {
  users: userTokens.length,
  requestsPerUser: REQUESTS_PER_USER,
  totalRequests,
  wallClockMs: concurrentMs,
  throughputPerSecond: Math.round((totalRequests / concurrentMs) * 1000),
  errors: concurrentErrors,
  latency: cs,
};
console.log(
  `  ${userTokens.length} users x ${REQUESTS_PER_USER} req = ${totalRequests} in ${concurrentMs}ms ` +
    `(${measurements.concurrency.throughputPerSecond}/s), p95 ${cs.p95Ms}ms, ${concurrentErrors} errors`,
);
concurrentErrors === 0
  ? results.pass(
      'STRESS-CONCURRENCY',
      `${userTokens.length} concurrent users complete ${totalRequests} requests without error`,
      `${measurements.concurrency.throughputPerSecond} req/s, p95 ${cs.p95Ms}ms`,
      measurements.concurrency,
    )
  : results.fail(
      'STRESS-CONCURRENCY',
      'Errors under concurrent load',
      `${concurrentErrors}/${totalRequests} failed`,
      measurements.concurrency,
    );

// ---------------------------------------------------------------------------
// Simultaneous uploads
// ---------------------------------------------------------------------------

console.log('\n--- simultaneous uploads ---');
const uploadCase = await req('POST', '/api/cases', {
  token: owner.token,
  body: {
    title: 'Simultaneous upload target',
    caseNumber: `UP-${Date.now()}`,
    jurisdiction: 'Alameda County',
    caseType: 'felony',
  },
});
const uploadCaseId = uploadCase.json.case.caseId;
const reportBytes = await readFile('/tmp/courtaccess-fixtures/police-report.pdf');

const SIMULTANEOUS = 20;
const upStart = performance.now();
const upResults = await Promise.all(
  Array.from({ length: SIMULTANEOUS }, async (_, i) => {
    const form = new FormData();
    form.append('caseId', uploadCaseId);
    form.append('evidenceType', 'police_report');
    form.append('file', new Blob([reportBytes], { type: 'application/pdf' }), `concurrent-${i}.pdf`);
    const t0 = performance.now();
    const res = await fetch(`${API}/api/evidence/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.token}` },
      body: form,
    });
    return { status: res.status, ms: Math.round(performance.now() - t0) };
  }),
);
const upOk = upResults.filter((r) => r.status === 201);
const upStats = stats(upResults.map((r) => r.ms));
measurements.simultaneousUploads = {
  attempted: SIMULTANEOUS,
  accepted: upOk.length,
  wallClockMs: Math.round(performance.now() - upStart),
  latency: upStats,
  statusCounts: upResults.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {}),
};
console.log(
  `  ${upOk.length}/${SIMULTANEOUS} accepted in ${measurements.simultaneousUploads.wallClockMs}ms, p95 ${upStats.p95Ms}ms`,
);
upOk.length === SIMULTANEOUS
  ? results.pass(
      'STRESS-UPLOAD-CONCURRENT',
      `${SIMULTANEOUS} simultaneous uploads all accepted`,
      `p95 ${upStats.p95Ms}ms`,
      measurements.simultaneousUploads,
    )
  : results.fail(
      'STRESS-UPLOAD-CONCURRENT',
      'Simultaneous uploads were rejected',
      JSON.stringify(measurements.simultaneousUploads.statusCounts),
      measurements.simultaneousUploads,
    );

// Wait for the ingestion backlog to drain and time it.
const drainStart = performance.now();
let drained = false;
while (performance.now() - drainStart < 300000) {
  const pending = await prisma.evidence.count({
    where: { caseId: uploadCaseId, processingStatus: { in: ['ingesting', 'processing', 'pending'] } },
  });
  if (pending === 0) {
    drained = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 1000));
}
const drainMs = Math.round(performance.now() - drainStart);
measurements.ingestionDrainMs = drainMs;
drained
  ? results.pass(
      'STRESS-UPLOAD-DRAIN',
      `Ingestion backlog of ${upOk.length} documents cleared`,
      `${drainMs}ms (${Math.round(drainMs / Math.max(upOk.length, 1))}ms per document)`,
    )
  : results.fail('STRESS-UPLOAD-DRAIN', 'Ingestion backlog did not clear within 5 minutes', `${drainMs}ms elapsed`);

// ---------------------------------------------------------------------------
// Large document
// ---------------------------------------------------------------------------

console.log('\n--- large document ---');
const bigBytes = await readFile('/tmp/courtaccess-fixtures/large-2000-page.pdf');
const bigForm = new FormData();
bigForm.append('caseId', uploadCaseId);
bigForm.append('evidenceType', 'other_document');
bigForm.append('file', new Blob([bigBytes], { type: 'application/pdf' }), 'large-2000-page.pdf');
const bigT0 = performance.now();
const bigRes = await fetch(`${API}/api/evidence/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${owner.token}` },
  body: bigForm,
});
const bigJson = await bigRes.json().catch(() => ({}));
const bigUploadMs = Math.round(performance.now() - bigT0);

if (bigRes.status === 201) {
  const bigId = bigJson.evidence.evidenceId;
  const procStart = performance.now();
  let row = null;
  while (performance.now() - procStart < 600000) {
    row = await prisma.evidence.findUnique({ where: { evidenceId: bigId } });
    if (row && !['ingesting', 'processing', 'pending'].includes(row.processingStatus)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const procMs = Math.round(performance.now() - procStart);
  const chunks = await prisma.evidenceChunk.count({ where: { evidenceId: bigId } });
  measurements.largeDocument = {
    fileName: 'large-2000-page.pdf',
    pages: 2000,
    bytes: bigBytes.length,
    uploadMs: bigUploadMs,
    processingMs: procMs,
    chunks,
    finalStatus: row?.processingStatus,
  };
  console.log(`  2000 pages, ${(bigBytes.length / 1e6).toFixed(1)}MB: upload ${bigUploadMs}ms, extract ${procMs}ms, ${chunks} chunks`);
  row?.processingStatus === 'analyzed' && chunks > 0
    ? results.pass(
        'STRESS-LARGE-PDF',
        'A 2,000-page PDF uploads and is fully indexed',
        `upload ${bigUploadMs}ms, extraction ${procMs}ms, ${chunks} chunks`,
        measurements.largeDocument,
      )
    : results.fail(
        'STRESS-LARGE-PDF',
        'A 2,000-page PDF did not index',
        `status=${row?.processingStatus} chunks=${chunks} error=${row?.processingError}`,
        measurements.largeDocument,
      );
} else {
  results.fail('STRESS-LARGE-PDF', 'A 2,000-page PDF was rejected at upload', `HTTP ${bigRes.status}`);
}

// ---------------------------------------------------------------------------
// Sustained API load
// ---------------------------------------------------------------------------

console.log('\n--- sustained API load ---');
const LOAD_SECONDS = 20;
const PARALLEL = 12;
const loadSamples = [];
let loadErrors = 0;
const loadEnd = Date.now() + LOAD_SECONDS * 1000;

await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    while (Date.now() < loadEnd) {
      const r = await req('GET', `/api/cases/${uploadCaseId}`, { token: owner.token, timeoutMs: 60000 });
      if (r.status === 200) loadSamples.push(r.ms);
      else loadErrors++;
    }
  }),
);
const ls = stats(loadSamples);
measurements.sustainedLoad = {
  durationSeconds: LOAD_SECONDS,
  parallelClients: PARALLEL,
  requests: loadSamples.length,
  errors: loadErrors,
  throughputPerSecond: Math.round(loadSamples.length / LOAD_SECONDS),
  latency: ls,
};
console.log(
  `  ${loadSamples.length} requests in ${LOAD_SECONDS}s (${measurements.sustainedLoad.throughputPerSecond}/s), ` +
    `p50 ${ls.p50Ms}ms p95 ${ls.p95Ms}ms p99 ${ls.p99Ms}ms, ${loadErrors} errors`,
);
loadErrors === 0
  ? results.pass(
      'STRESS-API-LOAD',
      `Sustained load of ${PARALLEL} clients for ${LOAD_SECONDS}s completes without error`,
      `${measurements.sustainedLoad.throughputPerSecond} req/s, p95 ${ls.p95Ms}ms`,
      measurements.sustainedLoad,
    )
  : results.fail(
      'STRESS-API-LOAD',
      'Errors under sustained load',
      `${loadErrors} failures`,
      measurements.sustainedLoad,
    );

// ---------------------------------------------------------------------------
// Health after the run
// ---------------------------------------------------------------------------

const alive = await serverMemory();
alive
  ? results.pass('STRESS-SURVIVAL', 'The API is still healthy after the full stress run')
  : results.fail('STRESS-SURVIVAL', 'The API is not responding after the stress run');

const deep = await req('GET', '/api/health/deep', { token: owner.token, timeoutMs: 30000 });
if (deep.status === 200) {
  measurements.deepHealth = deep.json;
  results.pass('STRESS-HEALTH-DEEP', 'Deep health check passes after load', JSON.stringify(deep.json).slice(0, 160));
} else {
  results.warn('STRESS-HEALTH-DEEP', 'Deep health check unavailable', `HTTP ${deep.status}`);
}

await results.write({ measurements });
await prisma.$disconnect();
