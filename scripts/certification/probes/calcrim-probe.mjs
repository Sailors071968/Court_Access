#!/usr/bin/env node
// Examines what the CALCRIM and charge engines assert for a charged offence,
// and whether element satisfaction is claimed without supporting evidence.

import { readFile } from 'node:fs/promises';
import { req, registerUser, login, API, exercisedApiRoutes } from '../lib/harness.mjs';

const u = await registerUser({ prefix: 'calcrim', defaultRole: 'attorney' });
const s = await login(u.email, u.password);
const token = s.token;

async function mkCase(title) {
  const r = await req('POST', '/api/cases', {
    token,
    body: { title, caseNumber: `CAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, jurisdiction: 'Alameda County', caseType: 'felony' },
  });
  return r.json.case.caseId;
}

// Case A: a charge, but no evidence at all.
const bare = await mkCase('Charged, no evidence');
const chargeRes = await req('POST', '/api/charges', {
  token,
  body: { caseId: bare, code: 'PC', section: '245(a)(1)', title: 'Assault with a deadly weapon', victim: 'Unidentified male' },
});
console.log('charge created:', chargeRes.status);

const bareCalcrim = await req('GET', `/api/calcrim/analyze/${bare}`, { token, timeoutMs: 60000 });
console.log('\n================ CALCRIM on a charge with NO evidence');
console.log('HTTP', bareCalcrim.status);
console.log(JSON.stringify(bareCalcrim.json, null, 2).slice(0, 2600));

// Case B: same charge, with a police report.
const withEv = await mkCase('Charged, with a police report');
await req('POST', '/api/charges', {
  token,
  body: { caseId: withEv, code: 'PC', section: '245(a)(1)', title: 'Assault with a deadly weapon', victim: 'Unidentified male' },
});
const form = new FormData();
form.append('caseId', withEv);
form.append('evidenceType', 'police_report');
form.append('file', new Blob([await readFile('/tmp/courtaccess-fixtures/police-report.pdf')], { type: 'application/pdf' }), 'police-report.pdf');
exercisedApiRoutes.add('POST /api/evidence/upload');
await fetch(`${API}/api/evidence/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
await new Promise((r) => setTimeout(r, 4000));

const evCalcrim = await req('GET', `/api/calcrim/analyze/${withEv}`, { token, timeoutMs: 60000 });
console.log('\n================ CALCRIM with a police report');
console.log('HTTP', evCalcrim.status);
console.log(JSON.stringify(evCalcrim.json, null, 2).slice(0, 2600));
