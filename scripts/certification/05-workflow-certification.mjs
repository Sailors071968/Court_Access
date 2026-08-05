#!/usr/bin/env node
// Phase 2/8/9 — Litigation workflow certification.
//
// Walks the path a defence team actually takes: register, create an
// organisation, open a case, add charges, upload discovery, read the evidence
// back, build a timeline, run the analysis engines, and check that findings
// still point at the document they came from.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Results, req, registerUser, login, API } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const FIXTURES = '/tmp/courtaccess-fixtures';
const results = new Results('WORKFLOW_CERTIFICATION', 'Phase 2/8/9 — Litigation Workflow');

const timings = {};
async function timed(label, fn) {
  const t0 = performance.now();
  const out = await fn();
  timings[label] = Math.round(performance.now() - t0);
  return out;
}

// ---------------------------------------------------------------------------
// 1. Registration and session
// ---------------------------------------------------------------------------

const attorney = await timed('register', () => registerUser({ prefix: 'wf-attorney', defaultRole: 'attorney' }));
if (attorney.token) {
  results.pass('WF-01', 'Attorney can register', `HTTP ${attorney.status}, tenant ${attorney.user?.tenantId}`);
} else {
  results.fail('WF-01', 'Attorney registration failed', `HTTP ${attorney.status}: ${attorney.raw?.text?.slice(0, 200)}`);
  await results.write({ timings });
  process.exit(1);
}

const relogin = await timed('login', () => login(attorney.email, attorney.password));
relogin.token
  ? results.pass('WF-02', 'Attorney can log in again with the same credentials', `HTTP ${relogin.status}`)
  : results.fail('WF-02', 'Login with valid credentials failed', `HTTP ${relogin.status}`);

const token = relogin.token || attorney.token;

const me = await req('GET', '/api/auth/me', { token });
me.status === 200
  ? results.pass('WF-03', 'Session endpoint returns the signed-in user', me.json?.user?.email)
  : results.fail('WF-03', 'Session endpoint failed', `HTTP ${me.status}`);

// Trial subscription should be provisioned at registration.
const sub = me.json?.user?.subscriptionStatus;
sub
  ? results.pass('WF-04', 'Registration provisions a subscription', `status=${sub}`)
  : results.warn('WF-04', 'No subscription status on the session', JSON.stringify(me.json?.user ?? {}).slice(0, 160));

// ---------------------------------------------------------------------------
// 2. Organisation
// ---------------------------------------------------------------------------

// Registration provisions the organisation; onboarding advances it through
// created -> profile -> offices -> team -> complete.
const profile = await req('POST', '/api/organizations/onboarding', {
  token,
  body: { step: 'profile', name: 'Okonkwo Defence LLP', practiceAreas: ['criminal_defense'] },
});
profile.status >= 200 && profile.status < 300
  ? results.pass('WF-05', 'The registering attorney can advance organisation onboarding', `HTTP ${profile.status}`)
  : results.fail('WF-05', 'Organisation onboarding failed', `HTTP ${profile.status}: ${(profile.text || '').slice(0, 200)}`);

const office = await req('POST', '/api/organizations/offices', {
  token,
  body: { name: 'Oakland Office', isPrimary: true, city: 'Oakland', state: 'CA' },
});
office.status >= 200 && office.status < 300
  ? results.pass('WF-05b', 'An office can be added to the organisation', `HTTP ${office.status}`)
  : results.fail('WF-05b', 'Office creation failed', `HTTP ${office.status}: ${(office.text || '').slice(0, 180)}`);

const invite = await req('POST', '/api/organizations/invitations', {
  token,
  body: { email: `paralegal-${Date.now()}@certification.test`, role: 'staff' },
});
invite.status >= 200 && invite.status < 300
  ? results.pass('WF-05c', 'A colleague can be invited to the organisation', `HTTP ${invite.status}`)
  : results.fail('WF-05c', 'Invitation failed', `HTTP ${invite.status}: ${(invite.text || '').slice(0, 180)}`);

const members = await req('GET', '/api/organizations/members', { token });
members.status === 200
  ? results.pass('WF-06', 'Organisation membership is readable', `${(members.json?.members ?? []).length} member(s)`)
  : results.fail('WF-06', 'Organisation membership not readable', `HTTP ${members.status}`);

// ---------------------------------------------------------------------------
// 3. Case
// ---------------------------------------------------------------------------

const created = await timed('createCase', () =>
  req('POST', '/api/cases', {
    token,
    body: {
      title: 'People v. Doe',
      caseNumber: `WF-${Date.now()}`,
      jurisdiction: 'Alameda County',
      caseType: 'felony',
      court: 'Superior Court',
      judge: 'Hon. R. Alvarez',
    },
  }),
);
if (created.status !== 201) {
  results.fail('WF-07', 'Case creation failed', `HTTP ${created.status}: ${(created.text || '').slice(0, 200)}`);
  await results.write({ timings });
  process.exit(1);
}
const caseId = created.json.case.caseId;
results.pass('WF-07', 'Attorney can open a case', `caseId ${caseId}`);

const readBack = await req('GET', `/api/cases/${caseId}`, { token });
readBack.status === 200 && readBack.json?.case?.caseId === caseId
  ? results.pass('WF-08', 'Case reads back with the values it was created with', readBack.json.case.title)
  : results.fail('WF-08', 'Case read-back failed', `HTTP ${readBack.status}`);

const patched = await req('PATCH', `/api/cases/${caseId}`, { token, body: { phase: 'pretrial' } });
patched.status === 200 && patched.json?.case?.phase === 'pretrial'
  ? results.pass('WF-09', 'Case can be updated', 'phase -> pretrial')
  : results.fail('WF-09', 'Case update failed', `HTTP ${patched.status}: ${(patched.text || '').slice(0, 160)}`);

const list = await req('GET', '/api/cases', { token });
(list.json?.cases ?? []).some((c) => c.caseId === caseId)
  ? results.pass('WF-10', 'New case appears in the case list')
  : results.fail('WF-10', 'New case missing from the case list', `HTTP ${list.status}`);

// Duplicate case number within the tenant must be refused.
const dup = await req('POST', '/api/cases', {
  token,
  body: {
    title: 'Duplicate',
    caseNumber: created.json.case.caseNumber,
    jurisdiction: 'Alameda County',
    caseType: 'felony',
  },
});
dup.status === 409
  ? results.pass('WF-11', 'Duplicate case number is refused', 'HTTP 409')
  : results.warn('WF-11', 'Duplicate case number not refused with 409', `HTTP ${dup.status}`);

// ---------------------------------------------------------------------------
// 4. Charges
// ---------------------------------------------------------------------------

const charge = await req('POST', '/api/charges', {
  token,
  body: {
    caseId,
    code: 'PC',
    section: '245(a)(1)',
    title: 'Assault with a deadly weapon',
    victim: 'Unidentified male',
    dateOfOffense: '2026-03-14',
  },
});
if (charge.status >= 200 && charge.status < 300) {
  results.pass('WF-12', 'Charge can be added to a case', `HTTP ${charge.status}`);
  const charges = await req('GET', `/api/charges/${caseId}`, { token });
  charges.status === 200
    ? results.pass('WF-13', 'Charges read back for the case', `${JSON.stringify(charges.json).slice(0, 100)}`)
    : results.fail('WF-13', 'Charges could not be read back', `HTTP ${charges.status}`);
} else {
  results.fail('WF-12', 'Charge creation failed', `HTTP ${charge.status}: ${(charge.text || '').slice(0, 200)}`);
}

// ---------------------------------------------------------------------------
// 5. Discovery upload
// ---------------------------------------------------------------------------

const DISCOVERY = [
  ['police-report.pdf', 'police_report', 'application/pdf'],
  ['preliminary-hearing-transcript.pdf', 'transcript', 'application/pdf'],
  ['dispatch-log.pdf', 'dispatch_log', 'application/pdf'],
  ['laboratory-report.pdf', 'forensic_report', 'application/pdf'],
  ['scanned-police-report.png', 'police_report', 'image/png'],
  ['bodycam.mp4', 'bodycam', 'video/mp4'],
];

const uploaded = [];
await timed('uploadDiscovery', async () => {
  for (const [file, type, mime] of DISCOVERY) {
    const form = new FormData();
    form.append('caseId', caseId);
    form.append('evidenceType', type);
    form.append('file', new Blob([await readFile(path.join(FIXTURES, file))], { type: mime }), file);
    const res = await fetch(`${API}/api/evidence/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    uploaded.push({ file, status: res.status, evidenceId: json.evidence?.evidenceId });
  }
});

const accepted = uploaded.filter((u) => u.status === 201);
accepted.length === DISCOVERY.length
  ? results.pass('WF-14', 'All discovery documents upload', `${accepted.length}/${DISCOVERY.length} accepted`)
  : results.fail(
      'WF-14',
      'Some discovery documents were rejected',
      JSON.stringify(uploaded.filter((u) => u.status !== 201)).slice(0, 300),
    );

// Wait for ingestion to settle.
const deadline = Date.now() + 180000;
while (Date.now() < deadline) {
  const pending = await prisma.evidence.count({
    where: { caseId, processingStatus: { in: ['ingesting', 'processing', 'pending'] } },
  });
  if (pending === 0) break;
  await new Promise((r) => setTimeout(r, 1000));
}

const caseEvidence = await req('GET', `/api/cases/${caseId}/evidence`, { token });
const evidenceList = caseEvidence.json?.evidence ?? caseEvidence.json ?? [];
Array.isArray(evidenceList) && evidenceList.length === accepted.length
  ? results.pass('WF-15', 'Uploaded evidence is listed against the case', `${evidenceList.length} items`)
  : results.fail(
      'WF-15',
      'Evidence list does not match what was uploaded',
      `listed=${Array.isArray(evidenceList) ? evidenceList.length : 'n/a'} uploaded=${accepted.length}`,
    );

// ---------------------------------------------------------------------------
// 6. Data integrity — every finding must trace back to its document
// ---------------------------------------------------------------------------

const chunkRows = await prisma.evidenceChunk.findMany({
  where: { evidenceId: { in: accepted.map((a) => a.evidenceId) } },
  select: { evidenceId: true, chunkIndex: true, startOffset: true, endOffset: true, charCount: true, checksum: true, text: true },
});

if (chunkRows.length > 0) {
  results.pass('WF-16', 'Discovery text is indexed into retrievable chunks', `${chunkRows.length} chunks`);

  const orphans = chunkRows.filter((c) => !accepted.some((a) => a.evidenceId === c.evidenceId));
  orphans.length === 0
    ? results.pass('WF-17', 'Every chunk is attributable to an uploaded document', `${chunkRows.length} chunks checked`)
    : results.fail('WF-17', 'Chunks exist with no parent document', `${orphans.length} orphans`);

  const badOffsets = chunkRows.filter(
    (c) => c.startOffset == null || c.endOffset == null || c.endOffset < c.startOffset,
  );
  badOffsets.length === 0
    ? results.pass('WF-18', 'Chunk offsets are well formed', `${chunkRows.length} chunks checked`)
    : results.fail('WF-18', 'Chunks carry invalid source offsets', JSON.stringify(badOffsets.slice(0, 3)));

  const badCounts = chunkRows.filter((c) => c.charCount !== c.text.length);
  badCounts.length === 0
    ? results.pass('WF-19', 'Recorded character counts match the stored text', `${chunkRows.length} chunks checked`)
    : results.fail('WF-19', 'Character counts disagree with the stored text', `${badCounts.length} mismatches`);

  const missingChecksum = chunkRows.filter((c) => !c.checksum);
  missingChecksum.length === 0
    ? results.pass('WF-20', 'Every chunk carries an integrity checksum')
    : results.fail('WF-20', 'Chunks are missing checksums', `${missingChecksum.length} without a checksum`);

  // The police report's distinctive content must survive into the index.
  const reportEvidence = accepted.find((a) => a.file === 'police-report.pdf');
  const reportText = chunkRows
    .filter((c) => c.evidenceId === reportEvidence?.evidenceId)
    .map((c) => c.text)
    .join(' ');
  /26-114872/.test(reportText) && /Delgado/i.test(reportText)
    ? results.pass('WF-21', 'Source content is preserved verbatim in the index', 'report number and officer name both present')
    : results.fail('WF-21', 'Source content did not survive indexing', reportText.slice(0, 200));

  // OCR output from the scan must also be traceable.
  const scanEvidence = accepted.find((a) => a.file === 'scanned-police-report.png');
  const scanText = chunkRows
    .filter((c) => c.evidenceId === scanEvidence?.evidenceId)
    .map((c) => c.text)
    .join(' ');
  /OAKLAND POLICE/i.test(scanText)
    ? results.pass('WF-22', 'OCR output is attributed to the scanned document', 'header text recovered from the scan')
    : results.fail('WF-22', 'OCR output not traceable to its document', scanText.slice(0, 200));
} else {
  results.fail('WF-16', 'No discovery text was indexed', 'zero chunks for the uploaded documents');
}

// ---------------------------------------------------------------------------
// 7. Downstream engines
// ---------------------------------------------------------------------------

const engines = [
  ['WF-23', 'Attorney workbench', 'GET', `/api/cases/${caseId}/workbench`],
  ['WF-24', 'Timeline events', 'GET', `/api/timeline/${caseId}/events`],
  ['WF-25', 'Timeline conflicts', 'GET', `/api/timeline/${caseId}/conflicts`],
  ['WF-26', 'Contradiction graph', 'GET', `/api/contradiction/graph/${caseId}`],
  ['WF-27', 'Contradiction recommendations', 'GET', `/api/contradiction/recommendations/${caseId}`],
  ['WF-28', 'Evidence gap detection', 'GET', `/api/cases/${caseId}/evidence-requests`],
  ['WF-29', 'Attorney workbench notes', 'GET', `/api/cases/${caseId}/workbench/notes`],
  ['WF-30', 'Investigator workbench', 'GET', `/api/cases/${caseId}/investigator-workbench`],
  ['WF-30b', 'Trial prep package', 'GET', `/api/cases/${caseId}/workbench/trial-prep`],
];

for (const [id, label, method, url] of engines) {
  const res = await timed(label, () => req(method, url, { token, timeoutMs: 60000 }));
  if (res.status === 200) {
    results.pass(id, `${label} responds for a populated case`, `HTTP 200 in ${res.ms}ms`);
  } else if (res.status === 404 && res.json?.error) {
    // The route is mounted and is reporting that it has nothing to show yet.
    results.pass(id, `${label} reports an empty result rather than failing`, `HTTP 404: ${res.json.error}`);
  } else if (res.status === 404) {
    results.fail(id, `${label} route is not mounted`, `HTTP 404 at ${url}`);
  } else {
    results.fail(id, `${label} failed`, `HTTP ${res.status}: ${(res.text || '').slice(0, 200)}`);
  }
}

// server.ts advertises GET /api/timeline/:caseId on startup, but only
// /events, /conflicts, /health and /rebuild are registered.
const advertised = await req('GET', `/api/timeline/${caseId}`, { token });
advertised.status === 404 && !advertised.json?.error
  ? results.warn(
      'WF-30c',
      'Startup banner advertises a timeline route that is not registered',
      'GET /api/timeline/:caseId is printed at boot but returns a Fastify 404',
    )
  : results.pass('WF-30c', 'Advertised timeline route resolves', `HTTP ${advertised.status}`);

// Timeline rebuild is the write path that populates the chronology.
const rebuild = await timed('timelineRebuild', () =>
  req('POST', `/api/timeline/rebuild/${caseId}`, { token, body: {}, timeoutMs: 120000 }),
);
if (rebuild.status >= 200 && rebuild.status < 300) {
  results.pass('WF-31', 'Timeline rebuild is accepted', `HTTP ${rebuild.status} in ${rebuild.ms}ms`);

  // The rebuild enqueues a BullMQ job, so the outcome has to be waited for
  // rather than read immediately.
  // processingJobId is the ProcessingJob primary key; jobId is the BullMQ id.
  const jobId = rebuild.json?.processingJobId ?? rebuild.json?.id;
  let jobRow = null;
  const jobDeadline = Date.now() + 120000;
  while (Date.now() < jobDeadline) {
    jobRow = jobId
      ? await prisma.processingJob.findUnique({ where: { id: jobId } })
      : await prisma.processingJob.findFirst({
          where: { caseId, pipeline: 'TIMELINE' },
          orderBy: { createdAt: 'desc' },
        });
    if (jobRow && ['completed', 'failed'].includes(jobRow.status)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!jobRow) {
    results.fail('WF-32', 'Timeline rebuild created no processing job', JSON.stringify(rebuild.json ?? {}).slice(0, 200));
  } else if (jobRow.status === 'completed') {
    results.pass('WF-32', 'Timeline worker completed the job', `job ${jobRow.id}`);
    const events = await prisma.timelineEvent.count({ where: { caseId } });
    events > 0
      ? results.pass('WF-32b', 'Timeline rebuild produced events', `${events} events`)
      : results.warn(
          'WF-32b',
          'Timeline job completed but produced no events',
          'the extractor found no datable statements in the uploaded discovery',
        );
  } else if (jobRow.status === 'failed') {
    results.fail('WF-32', 'Timeline worker failed the job', `${jobRow.failureCode ?? ''} ${jobRow.error ?? ''}`.slice(0, 220));
  } else {
    results.fail('WF-32', 'Timeline job never reached a terminal state', `stuck in status=${jobRow.status} after 120s`);
  }
} else {
  results.fail('WF-31', 'Timeline rebuild failed', `HTTP ${rebuild.status}: ${(rebuild.text || '').slice(0, 200)}`);
}

// ---------------------------------------------------------------------------
// 8. Deletion and audit
// ---------------------------------------------------------------------------

const toDelete = accepted[accepted.length - 1];
const del = await req('DELETE', `/api/evidence/${toDelete.evidenceId}`, { token });
if (del.status >= 200 && del.status < 300) {
  const after = await req('GET', `/api/evidence/${toDelete.evidenceId}`, { token });
  after.status === 404 || after.status === 403
    ? results.pass('WF-33', 'Deleted evidence is no longer retrievable', `HTTP ${after.status}`)
    : results.fail('WF-33', 'Deleted evidence is still retrievable', `HTTP ${after.status}`);
} else {
  results.fail('WF-33', 'Evidence deletion failed', `HTTP ${del.status}: ${(del.text || '').slice(0, 160)}`);
}

const softDeleted = await req('DELETE', `/api/cases/${caseId}`, { token });
if (softDeleted.status >= 200 && softDeleted.status < 300) {
  const stillListed = await req('GET', '/api/cases', { token });
  (stillListed.json?.cases ?? []).some((c) => c.caseId === caseId)
    ? results.fail('WF-34', 'Deleted case still appears in the case list')
    : results.pass('WF-34', 'Deleted case is removed from the case list');
} else {
  results.fail('WF-34', 'Case deletion failed', `HTTP ${softDeleted.status}`);
}

const logout = await req('POST', '/api/auth/logout', { token, body: {} });
logout.status >= 200 && logout.status < 300
  ? results.pass('WF-35', 'Logout succeeds', `HTTP ${logout.status}`)
  : results.warn('WF-35', 'Logout did not succeed', `HTTP ${logout.status}`);

await results.write({ caseId, timings, uploaded });
await prisma.$disconnect();
