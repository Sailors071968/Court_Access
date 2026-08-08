#!/usr/bin/env node
// Characterises what the timeline extractor can and cannot build a chronology
// from. Uploads two reports to the same case: one written in general narrative
// terms, one describing a use-of-force sequence in the vocabulary the keyword
// table recognises.

import { req, registerUser, API } from '../lib/harness.mjs';
import { PrismaClient } from '../../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();

const GENERAL_NARRATIVE = `OAKLAND POLICE DEPARTMENT - INCIDENT REPORT
Report Number: 26-114872   Date: 03/14/2026

22:47 I arrived at 1450 Foothill Boulevard.
22:48 I observed the suspect near the northeast corner of the parking lot.
22:52 The suspect complied after the third instruction and was detained.
23:05 The suspect was transported to North County Jail.
`;

const USE_OF_FORCE = `OAKLAND POLICE DEPARTMENT - USE OF FORCE SUPPLEMENT
Report Number: 26-114872   Date: 03/14/2026

22:47 Officers approached the subject on foot.
22:48 I gave the verbal command "show me your hands" twice.
22:49 Subject fled and a foot pursuit began westbound.
22:50 I drew my weapon and issued a last warning before deploying the taser.
22:51 The taser was deployed and the subject was taken to the ground.
22:52 A control hold was applied and the subject was handcuffed.
22:55 I read the Miranda warning to the subject.
`;

const user = await registerUser({ prefix: 'tl-probe' });
const c = await req('POST', '/api/cases', {
  token: user.token,
  body: {
    title: 'Timeline extraction probe',
    caseNumber: `TL-${Date.now()}`,
    jurisdiction: 'Alameda County',
    caseType: 'felony',
  },
});
const caseId = c.json.case.caseId;

// A charge is required before some pipelines will run.
await req('POST', '/api/charges', {
  token: user.token,
  body: { caseId, code: 'PC', section: '245(a)(1)', title: 'ADW', victim: 'Unknown' },
});

async function upload(name, text) {
  const form = new FormData();
  form.append('caseId', caseId);
  form.append('evidenceType', 'police_report');
  form.append('file', new Blob([Buffer.from(text)], { type: 'text/plain' }), name);
  const res = await fetch(`${API}/api/evidence/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}` },
    body: form,
  });
  return (await res.json()).evidence?.evidenceId;
}

async function rebuildAndCount(label) {
  const r = await req('POST', `/api/timeline/rebuild/${caseId}`, { token: user.token, body: {} });
  const jobId = r.json?.processingJobId;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const job = await prisma.processingJob.findUnique({ where: { id: jobId } });
    if (job && ['completed', 'failed'].includes(job.status)) break;
    await new Promise((x) => setTimeout(x, 750));
  }
  const evidenceEvents = await prisma.evidenceEvent.count({ where: { caseId } });
  const timelineEvents = await prisma.timelineEvent.count({ where: { caseId } });
  const sample = await prisma.evidenceEvent.findMany({
    where: { caseId },
    take: 6,
    select: { eventType: true, timestamp: true, rawText: true },
  });
  console.log(`\n${label}`);
  console.log(`  evidenceEvent rows : ${evidenceEvents}`);
  console.log(`  timelineEvent rows : ${timelineEvents}`);
  for (const s of sample) {
    console.log(`    ${String(s.timestamp).padEnd(10)} ${s.eventType.padEnd(20)} ${s.rawText.slice(0, 60)}`);
  }
}

await upload('general-narrative.txt', GENERAL_NARRATIVE);
await new Promise((r) => setTimeout(r, 2500));
await rebuildAndCount('after uploading a general narrative police report');

await upload('use-of-force-supplement.txt', USE_OF_FORCE);
await new Promise((r) => setTimeout(r, 2500));
await rebuildAndCount('after adding a use-of-force supplement');

await prisma.$disconnect();
