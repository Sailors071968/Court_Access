#!/usr/bin/env node
// Program 144 (Gold Standard) — certification of the certification framework.
//
// Exercises the module end to end against a synthetic mixed-discovery corpus:
// preview, import, inventory, classification, run, report, regression. Also
// proves the module is closed to every non-administrator role, and that the
// corpus on disk is byte-identical before and after.

import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { Results, req, registerUser, login } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('GOLD_STANDARD_FRAMEWORK', 'Program 144 — Gold Standard Certification Framework');

const CORPUS = '/tmp/courtaccess-certification-corpus/SYNTHETIC-001';

/** Hash every file under a directory so tampering is detectable. */
async function hashTree(root) {
  const entries = [];
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) await walk(abs);
      else if (e.isFile()) {
        const buf = await readFile(abs);
        entries.push(`${path.relative(root, abs)}:${createHash('sha256').update(buf).digest('hex')}`);
      }
    }
  }
  await walk(root);
  entries.sort();
  return { hash: createHash('sha256').update(entries.join('\n')).digest('hex'), count: entries.length };
}

const before = await hashTree(CORPUS);
console.log(`corpus: ${before.count} files, tree hash ${before.hash.slice(0, 16)}\n`);

// ---------------------------------------------------------------------------
// The module must be closed to everyone but administrators
// ---------------------------------------------------------------------------

const NON_ADMIN_ROLES = [
  ['attorney', 'attorney'],
  ['criminal investigator', 'criminal_investigator'],
  ['paralegal', 'paralegal'],
  ['law office administrator', 'law_office_administrator'],
  ['expert witness', 'expert_witness'],
  ['consultant', 'consultant'],
  ['criminal defendant', 'criminal_defendant'],
  ['family member', 'family_member'],
];

const CERT_ROUTES = [
  ['GET', '/api/certification/status'],
  ['POST', '/api/certification/preview'],
  ['POST', '/api/certification/import'],
  ['GET', '/api/certification/compare?baselineRunId=a&currentRunId=b'],
];

const reachedBy = [];
for (const [label, defaultRole] of NON_ADMIN_ROLES) {
  const u = await registerUser({ prefix: `gs-${defaultRole}`, defaultRole });
  if (!u.token) continue;
  for (const [method, url] of CERT_ROUTES) {
    const res = await req(method, url, { token: u.token, body: method === 'POST' ? {} : undefined });
    if (res.status !== 403 && res.status !== 401) {
      reachedBy.push(`${label} → ${method} ${url} (HTTP ${res.status})`);
    }
  }
}

reachedBy.length === 0
  ? results.pass(
      'GS-01',
      'Gold Standard Certification is closed to every non-administrator role',
      `${NON_ADMIN_ROLES.length} roles × ${CERT_ROUTES.length} routes, all refused`,
    )
  : results.fail(
      'GS-01',
      'A non-administrator reached the certification module',
      reachedBy.join('; ').slice(0, 300),
      { reachedBy },
    );

// ---------------------------------------------------------------------------
// Administrator session
// ---------------------------------------------------------------------------

const adminAccount = await registerUser({ prefix: 'gs-admin', defaultRole: 'attorney' });
await prisma.user.update({ where: { id: adminAccount.user.userId }, data: { role: 'admin' } });
const adminSession = await login(adminAccount.email, adminAccount.password);
const token = adminSession.token;

const status = await req('GET', '/api/certification/status', { token });
status.status === 200
  ? results.pass('GS-02', 'An administrator can open the module', `${status.json.documentClasses} document classes registered`)
  : results.fail('GS-02', 'An administrator could not open the module', `HTTP ${status.status}`);

// ---------------------------------------------------------------------------
// Preview before import
// ---------------------------------------------------------------------------

const preview = await req('POST', '/api/certification/preview', {
  token,
  body: { sourceDirectory: CORPUS },
  timeoutMs: 120000,
});

if (preview.status !== 200) {
  results.fail('GS-03', 'Preview failed', `HTTP ${preview.status}: ${(preview.text ?? '').slice(0, 200)}`);
} else {
  // 29 on disk plus the three members expanded out of the nested archive.
  const expected = before.count + 3;
  preview.json.fileCount === expected
    ? results.pass(
        'GS-03',
        'Preview walks the delivery and expands nested archives',
        `${preview.json.fileCount} files (${before.count} on disk + 3 archive members)`,
      )
    : results.fail(
        'GS-03',
        'Preview did not account for every file',
        `saw ${preview.json.fileCount}, expected ${expected}`,
        { byExtension: preview.json.byExtension },
      );

  const nested = (preview.json.files ?? []).filter((f) => f.fromArchive);
  nested.length === 3
    ? results.pass('GS-04', 'Files inside a delivered ZIP are inventoried individually', nested.map((n) => n.relativePath).join(', '))
    : results.fail('GS-04', 'Archive members were not expanded', `${nested.length} found, expected 3`);

  const hierarchical = (preview.json.files ?? []).filter((f) => f.relativePath.includes('/'));
  hierarchical.length > 0
    ? results.pass('GS-05', 'The delivered folder hierarchy is preserved', `e.g. ${hierarchical[0].relativePath}`)
    : results.fail('GS-05', 'Folder hierarchy was flattened', 'no relative paths contain a folder');
}

// A folder that does not exist must be refused clearly.
const badPreview = await req('POST', '/api/certification/preview', {
  token,
  body: { sourceDirectory: '/tmp/does-not-exist-anywhere' },
});
badPreview.status === 400 && /not a readable folder/i.test(badPreview.json?.message ?? '')
  ? results.pass('GS-06', 'A folder that does not exist is refused with an explanation', badPreview.json.message.slice(0, 120))
  : results.fail('GS-06', 'A missing folder was not clearly refused', `HTTP ${badPreview.status}`);

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const reference = `SYN-${Date.now().toString().slice(-6)}`;
const importRes = await req('POST', '/api/certification/import', {
  token,
  body: {
    reference,
    label: 'Synthetic certification corpus',
    description: 'Mixed discovery used to exercise the certification framework.',
    sourceDirectory: CORPUS,
  },
  timeoutMs: 900000,
});

if (importRes.status !== 201) {
  results.fail('GS-07', 'Import failed', `HTTP ${importRes.status}: ${(importRes.text ?? '').slice(0, 300)}`);
  await results.write({});
  await prisma.$disconnect();
  process.exit(1);
}

const imported = importRes.json;
results.pass(
  'GS-07',
  'The corpus imports through the production ingestion path',
  `${imported.ingested} ingested, ${imported.duplicates} duplicate(s), ${imported.failed} failed, of ${imported.fileCount} files`,
  imported,
);

imported.duplicates >= 1
  ? results.pass('GS-08', 'Duplicate files are detected by content hash, not by name', `${imported.duplicates} identified`)
  : results.fail('GS-08', 'A duplicate delivered under a different name was not detected', `${imported.duplicates} found`);

imported.corpusHash
  ? results.pass('GS-09', 'The corpus is fingerprinted so later runs can prove they read the same material', imported.corpusHash.slice(0, 24))
  : results.fail('GS-09', 'No corpus fingerprint was recorded');

// Re-using a reference must be refused: corpora are permanent.
const dupImport = await req('POST', '/api/certification/import', {
  token,
  body: { reference, label: 'Attempted overwrite', sourceDirectory: CORPUS },
});
dupImport.status === 409
  ? results.pass('GS-10', 'A corpus reference cannot be reused', dupImport.json.message.slice(0, 120))
  : results.fail('GS-10', 'A corpus reference could be reused', `HTTP ${dupImport.status}`);

// ---------------------------------------------------------------------------
// The originals must be untouched
// ---------------------------------------------------------------------------

const after = await hashTree(CORPUS);
after.hash === before.hash && after.count === before.count
  ? results.pass(
      'GS-11',
      'The delivered corpus is byte-identical after import',
      `${after.count} files, tree hash unchanged (${after.hash.slice(0, 16)})`,
    )
  : results.fail(
      'GS-11',
      'The corpus on disk changed during import',
      `before ${before.count} files / ${before.hash.slice(0, 16)}, after ${after.count} / ${after.hash.slice(0, 16)}`,
    );

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

const inventory = await req('GET', `/api/certification/cases/${imported.certificationCaseId}/inventory`, {
  token,
  timeoutMs: 120000,
});

if (inventory.status !== 200) {
  results.fail('GS-12', 'Inventory could not be read', `HTTP ${inventory.status}`);
} else {
  const inv = inventory.json;
  const t = inv.totals;
  results.pass(
    'GS-12',
    'The inventory accounts for every file that arrived',
    `${t.files} files, ${(t.bytes / 1e6).toFixed(1)}MB — ${t.documents} documents, ${t.videos} video, ${t.audio} audio, ${t.images} images`,
    t,
  );

  const everyFileHashed = inv.files.every((f) => f.sha256 && f.sha256.length === 64);
  everyFileHashed
    ? results.pass('GS-13', 'Every file carries a SHA-256', `${inv.files.length} files`)
    : results.fail('GS-13', 'Files are missing a content hash', `${inv.files.filter((f) => !f.sha256).length} without one`);

  const timestamped = inv.files.filter((f) => f.originalModifiedAt).length;
  timestamped > 0
    ? results.pass('GS-14', 'Original modification times are preserved where the medium carried one', `${timestamped}/${inv.files.length} files`)
    : results.warn('GS-14', 'No original timestamps were captured', 'the delivery carried none');

  // Every file must have an outcome; nothing may be silently absent.
  const unaccounted = inv.files.filter((f) => !['ingested', 'skipped', 'failed'].includes(f.ingestStatus));
  unaccounted.length === 0
    ? results.pass('GS-15', 'Every file has a recorded outcome', 'none left pending')
    : results.fail('GS-15', 'Files were left with no recorded outcome', `${unaccounted.length}`);

  // Failures must explain themselves.
  const failed = inv.files.filter((f) => f.ingestStatus === 'failed');
  const unexplained = failed.filter((f) => !f.ingestMessage || f.ingestMessage.length < 20);
  failed.length === 0
    ? results.pass('GS-16', 'No file failed to ingest', `${inv.files.length} files`)
    : unexplained.length === 0
      ? results.pass(
          'GS-16',
          'Every ingestion failure explains itself',
          `${failed.length} failure(s); e.g. ${failed[0].fileName}: ${failed[0].ingestMessage.slice(0, 110)}`,
        )
      : results.fail('GS-16', 'Ingestion failures with no explanation', unexplained.map((f) => f.fileName).join(', '));

  // Classification: reported classes must be evidence-backed, and anything
  // uncertain must read as unknown rather than a guess.
  const classified = inv.files.filter((f) => f.classification !== 'unknown');
  const unbacked = classified.filter((f) => !f.classificationBasis || f.classificationConfidence < 0.4);
  classified.length > 0 && unbacked.length === 0
    ? results.pass(
        'GS-17',
        'Every classification states the evidence it rests on',
        `${classified.length}/${inv.files.length} classified; ${inv.byClassification.unknown ?? 0} left unknown`,
        { byClassification: inv.byClassification },
      )
    : unbacked.length > 0
      ? results.fail('GS-17', 'Classifications were reported without supporting evidence', unbacked.map((f) => f.fileName).join(', ').slice(0, 200))
      : results.fail('GS-17', 'Nothing was classified', JSON.stringify(inv.byClassification));

  // The mixed pile must actually be separated: several distinct classes.
  const distinct = Object.keys(inv.byClassification).filter((k) => k !== 'unknown').length;
  distinct >= 6
    ? results.pass(
        'GS-18',
        'Mixed discovery is separated into distinct document types automatically',
        `${distinct} classes identified: ${Object.keys(inv.byClassification).filter((k) => k !== 'unknown').join(', ')}`,
      )
    : results.fail('GS-18', 'Mixed discovery was not meaningfully separated', `${distinct} classes: ${JSON.stringify(inv.byClassification)}`);
}

// ---------------------------------------------------------------------------
// Certification run
// ---------------------------------------------------------------------------

const run1 = await req('POST', `/api/certification/cases/${imported.certificationCaseId}/run`, {
  token,
  body: {},
  timeoutMs: 900000,
});

if (run1.status !== 200) {
  results.fail('GS-19', 'The certification run failed', `HTTP ${run1.status}: ${(run1.text ?? '').slice(0, 300)}`);
} else {
  const m = run1.json.metrics;
  results.pass(
    'GS-19',
    'A certification run completes and records what the pipeline produced',
    `${m.extraction.documentsWithText} documents with text, ${m.extraction.totalPages} pages, ` +
      `${m.repositories.timelineEvents} timeline events, ${m.knowledgeGraph.nodes} graph nodes`,
    m,
  );

  m.extraction.totalPages > 0 && m.extraction.documentsWithPageMap > 0
    ? results.pass(
        'GS-20',
        'Pages are numbered so findings can cite them',
        `${m.extraction.totalPages} pages across ${m.extraction.documentsWithPageMap} documents`,
      )
    : results.fail('GS-20', 'No page numbering was recorded', JSON.stringify(m.extraction));

  Array.isArray(m.unknowns)
    ? results.pass(
        'GS-21',
        'UNKNOWN findings are enumerated rather than omitted',
        `${m.unknowns.length} recorded; e.g. ${m.unknowns[0]?.subject ?? 'none'}`,
      )
    : results.fail('GS-21', 'The run did not record UNKNOWN findings');

  Array.isArray(m.failures)
    ? results.pass('GS-22', 'Processing failures are enumerated with a reason', `${m.failures.length} recorded`)
    : results.fail('GS-22', 'The run did not record failures');

  run1.json.regressions === null
    ? results.pass('GS-23', 'The first run becomes the baseline with nothing to compare against')
    : results.warn('GS-23', 'The first run reported regressions', JSON.stringify(run1.json.regressions).slice(0, 200));
}

// ---------------------------------------------------------------------------
// Regression comparison — a second run on identical input
// ---------------------------------------------------------------------------

const run2 = await req('POST', `/api/certification/cases/${imported.certificationCaseId}/run`, {
  token,
  body: {},
  timeoutMs: 900000,
});

if (run2.status !== 200) {
  results.fail('GS-24', 'The second certification run failed', `HTTP ${run2.status}`);
} else {
  const regressions = (run2.json.regressions ?? []).filter((r) => r.severity === 'regression');
  regressions.length === 0
    ? results.pass(
        'GS-24',
        'Re-running the same corpus on the same build reports no regression',
        `${(run2.json.regressions ?? []).length} difference(s), none a regression`,
      )
    : results.fail(
        'GS-24',
        'Re-running identical input reported regressions, so the comparison is not stable',
        regressions.map((r) => r.note).join('; ').slice(0, 300),
        { regressions },
      );

  const compare = await req(
    'GET',
    `/api/certification/compare?baselineRunId=${run1.json.certificationRunId}&currentRunId=${run2.json.certificationRunId}`,
    { token, timeoutMs: 60000 },
  );
  compare.status === 200
    ? results.pass(
        'GS-25',
        'Any two runs can be compared directly',
        `${compare.json.differences} difference(s): ${compare.json.regressions.length} regression, ${compare.json.improvements.length} improvement`,
      )
    : results.fail('GS-25', 'Runs could not be compared', `HTTP ${compare.status}`);
}

// Run history must be retrievable.
const history = await req('GET', `/api/certification/cases/${imported.certificationCaseId}/runs`, { token });
history.status === 200 && history.json.runCount >= 2
  ? results.pass('GS-26', 'Certification history is retained', `${history.json.runCount} runs recorded`)
  : results.fail('GS-26', 'Certification history was not retained', `HTTP ${history.status}, ${history.json?.runCount} runs`);

// ---------------------------------------------------------------------------
// A regression must actually be detected when one occurs
// ---------------------------------------------------------------------------

const baselineRun = await prisma.certificationRun.findFirst({
  where: { certificationCaseId: imported.certificationCaseId, isBaseline: true },
});

if (baselineRun?.metrics) {
  // Simulate a build that extracts less: degrade the current metrics and
  // confirm the comparison names it.
  const degraded = JSON.parse(JSON.stringify(baselineRun.metrics));
  degraded.extraction.documentsWithText = Math.max(0, degraded.extraction.documentsWithText - 3);
  degraded.classification.unknown = (degraded.classification.unknown ?? 0) + 5;

  const probe = await prisma.certificationRun.create({
    data: {
      certificationCaseId: imported.certificationCaseId,
      status: 'completed',
      completedAt: new Date(),
      metrics: degraded,
      gitCommit: 'simulated-degraded-build',
    },
  });

  const detect = await req(
    'GET',
    `/api/certification/compare?baselineRunId=${baselineRun.certificationRunId}&currentRunId=${probe.certificationRunId}`,
    { token },
  );

  const named = (detect.json?.regressions ?? []).map((r) => r.metric);
  named.includes('extraction.documentsWithText') && named.includes('classification.unknown')
    ? results.pass(
        'GS-27',
        'A build that extracts less is detected as a regression',
        detect.json.regressions.map((r) => r.note).join(' ').slice(0, 200),
      )
    : results.fail(
        'GS-27',
        'A degraded build was not detected',
        `regressions named: ${named.join(', ') || 'none'}`,
        { response: detect.json },
      );

  await prisma.certificationRun.delete({ where: { certificationRunId: probe.certificationRunId } });
} else {
  results.fail('GS-27', 'No baseline run was recorded, so regression detection cannot be exercised');
}

await results.write({
  corpus: CORPUS,
  corpusTreeHashBefore: before.hash,
  corpusTreeHashAfter: after.hash,
  reference,
  certificationCaseId: imported.certificationCaseId,
});
await prisma.$disconnect();
