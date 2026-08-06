#!/usr/bin/env node
// Demonstrates whether the unscoped compliance endpoints return another firm's
// privileged content, rather than inferring it from the query shape.
//
// Firm A's case is given extracted events carrying verbatim text from its
// police report. Firm B then asks the compliance endpoints for that case id.

import { req, registerUser } from '../lib/harness.mjs';
import { PrismaClient } from '../../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();

const firmA = await registerUser({ prefix: 'leak-a', defaultRole: 'attorney' });
const firmB = await registerUser({ prefix: 'leak-b', defaultRole: 'attorney' });

const created = await req('POST', '/api/cases', {
  token: firmA.token,
  body: {
    title: 'People v. Privileged',
    caseNumber: `LEAK-${Date.now()}`,
    jurisdiction: 'Alameda County',
    caseType: 'felony',
  },
});
const caseId = created.json.case.caseId;

// A privileged sentence that must never reach firm B.
const SECRET = 'PRIVILEGED-WORK-PRODUCT-Sgt-Delgado-recovered-a-folding-knife-item-3';

await prisma.evidenceEvent.create({
  data: {
    caseId,
    timestamp: '22:52:00',
    eventType: 'suspect_restrained',
    confidence: 0.91,
    sourceEvidence: 'evidence-1',
    sourceType: 'police_report',
    description: 'Subject detained',
    rawText: SECRET,
  },
});

console.log(`firm A tenant ${firmA.user.tenantId} case ${caseId}`);
console.log(`firm B tenant ${firmB.user.tenantId}`);
console.log(`secret planted in firm A's evidence events\n`);

const ENDPOINTS = [
  `/api/compliance/events/${caseId}`,
  `/api/compliance/events/${caseId}/stats`,
  `/api/compliance/timeline/${caseId}`,
  `/api/compliance/expert/${caseId}`,
  `/api/compliance/jury/${caseId}`,
  `/api/forensic/timeline/${caseId}`,
  `/api/contradiction/events/${caseId}`,
];

// Any of these reaching firm B is a disclosure: the verbatim text, the event
// description, its timestamp, or the fact that an event of this type exists.
const MARKERS = [
  ['verbatim work product', SECRET],
  ['event description', 'Subject detained'],
  ['event timestamp', '22:52:00'],
  ['event type', 'suspect_restrained'],
];

let leaks = 0;
for (const url of ENDPOINTS) {
  const res = await req('GET', url, { token: firmB.token, timeoutMs: 30000 });
  const body = res.text ?? '';
  const found = MARKERS.filter(([, m]) => body.includes(m)).map(([label]) => label);
  if (found.length) leaks++;
  console.log(
    `${found.length ? 'LEAKED  ' : 'refused '} HTTP ${String(res.status).padEnd(3)} ${url.replace(caseId, ':caseId')}` +
      (found.length ? `  → ${found.join(', ')}` : ''),
  );
}

console.log(`\n${leaks} of ${ENDPOINTS.length} endpoints disclosed something about firm A's case to firm B`);
await prisma.$disconnect();
process.exit(leaks > 0 ? 1 : 0);
