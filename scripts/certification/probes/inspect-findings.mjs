#!/usr/bin/env node
// Prints the raw payloads behind the fabrication-audit failures so each can be
// judged on its contents rather than on a heuristic.

import { readFile } from 'node:fs/promises';
import { req, registerUser, login, API, exercisedApiRoutes } from '../lib/harness.mjs';
import { PrismaClient } from '../../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const u = await registerUser({ prefix: 'inspect', defaultRole: 'attorney' });
await prisma.user.update({ where: { id: u.user.userId }, data: { role: 'admin' } });
const s = await login(u.email, u.password);
const token = s.token;

const mk = async (title) => {
  const r = await req('POST', '/api/cases', {
    token,
    body: { title, caseNumber: `INS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, jurisdiction: 'Alameda County', caseType: 'felony' },
  });
  return r.json.case.caseId;
};

const emptyCase = await mk('Inspect — empty');
const fullCase = await mk('Inspect — populated');

const form = new FormData();
form.append('caseId', fullCase);
form.append('evidenceType', 'police_report');
form.append('file', new Blob([await readFile('/tmp/courtaccess-fixtures/police-report.pdf')], { type: 'application/pdf' }), 'police-report.pdf');
exercisedApiRoutes.add('POST /api/evidence/upload');
await fetch(`${API}/api/evidence/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
await new Promise((r) => setTimeout(r, 4000));

const show = async (label, url, pick) => {
  const r = await req('GET', url, { token, timeoutMs: 45000 });
  console.log(`\n================ ${label}`);
  console.log(`${url}  ->  HTTP ${r.status}`);
  if (r.status !== 200) {
    console.log((r.text || '').slice(0, 300));
    return;
  }
  const body = pick ? pick(r.json) : r.json;
  console.log(JSON.stringify(body, null, 2).slice(0, 2200));
};

await show('compliance/jury on EMPTY case', `/api/compliance/jury/${emptyCase}`);
await show('compliance/jury on NON-EXISTENT case', '/api/compliance/jury/00000000-0000-4000-8000-000000000000');
await show('attorney workbench graph nodes (populated)', `/api/cases/${fullCase}/workbench`, (j) => j?.evidenceWorkbench?.graph);
await show('investigator workbench gaps (populated)', `/api/cases/${fullCase}/investigator-workbench`, (j) => j?.gaps);

await prisma.$disconnect();
