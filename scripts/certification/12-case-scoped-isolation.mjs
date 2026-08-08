#!/usr/bin/env node
// Program 144 — case-scoped tenant isolation sweep.
//
// The Program 143 security suite checked isolation on the case, evidence,
// timeline, charge, contradiction and workbench routes. The fabrication audit
// then found /api/compliance/jury/:caseId answering for another firm's case,
// which means the check has to be applied to every case-scoped endpoint, not
// a chosen sample.
//
// Firm A owns a case with a document. Firm B, a completely separate tenant,
// asks every case-scoped endpoint about it. Anything other than a refusal is
// a leak. Each endpoint is also asked about a case id that does not exist.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Results, req, registerUser, API, OUT_DIR, exercisedApiRoutes } from './lib/harness.mjs';

const results = new Results('CASE_ISOLATION_SWEEP', 'Program 144 — Case-Scoped Isolation');

const inventory = JSON.parse(
  await readFile(path.join(OUT_DIR, 'FEATURE_INVENTORY.json'), 'utf8'),
);

// Every GET route that takes a case id, taken from the route table rather
// than a hand-written list so nothing is missed.
const caseRoutes = inventory.apiRoutes.filter(
  (r) => r.method === 'GET' && /:caseId/.test(r.url),
);

// Firm A: owns the case.
const firmA = await registerUser({ prefix: 'iso-a', defaultRole: 'attorney' });
const created = await req('POST', '/api/cases', {
  token: firmA.token,
  body: {
    title: 'People v. Confidential — isolation sweep',
    caseNumber: `ISO-${Date.now()}`,
    jurisdiction: 'Alameda County',
    caseType: 'felony',
  },
});
const caseId = created.json.case.caseId;

await req('POST', '/api/charges', {
  token: firmA.token,
  body: { caseId, code: 'PC', section: '245(a)(1)', title: 'Assault with a deadly weapon', victim: 'Unidentified male' },
});

const form = new FormData();
form.append('caseId', caseId);
form.append('evidenceType', 'police_report');
form.append('file', new Blob([await readFile('/tmp/courtaccess-fixtures/police-report.pdf')], { type: 'application/pdf' }), 'police-report.pdf');
exercisedApiRoutes.add('POST /api/evidence/upload');
await fetch(`${API}/api/evidence/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${firmA.token}` },
  body: form,
});
await new Promise((r) => setTimeout(r, 4000));

// Firm B: unrelated tenant, no relationship to the case whatsoever.
const firmB = await registerUser({ prefix: 'iso-b', defaultRole: 'attorney' });

console.log(`firm A tenant ${firmA.user.tenantId} owns case ${caseId}`);
console.log(`firm B tenant ${firmB.user.tenantId}`);
console.log(`\nprobing ${caseRoutes.length} case-scoped GET routes as firm B...\n`);

const SUBS = {
  caseId,
  evidenceId: '00000000-0000-4000-8000-000000000000',
  documentId: '00000000-0000-4000-8000-000000000000',
  packageType: 'attorney_report',
  eventType: 'use_of_force',
  agencyId: 'agency-1',
  noteId: '00000000-0000-4000-8000-000000000000',
  pinId: '00000000-0000-4000-8000-000000000000',
};
const fill = (url) => url.replace(/:([A-Za-z0-9_]+)/g, (_, n) => SUBS[n] ?? '00000000-0000-4000-8000-000000000000');

const leaks = [];
const refused = [];
const errors = [];

for (const route of caseRoutes) {
  const url = fill(route.url);
  const res = await req('GET', url, { token: firmB.token, timeoutMs: 45000 });

  if (res.status === 403 || res.status === 404 || res.status === 401) {
    refused.push({ route: route.url, status: res.status });
    continue;
  }
  // A validation rejection that names no case detail discloses nothing.
  if (res.status === 400 && !(res.text ?? '').includes(caseId)) {
    refused.push({ route: route.url, status: 400, note: 'rejected as a bad request, disclosed nothing' });
    continue;
  }
  if (res.status >= 500 || res.status === 0) {
    errors.push({ route: route.url, status: res.status, source: route.source });
    continue;
  }

  // A 200 is only acceptable if the body carries nothing about the case.
  const body = res.text ?? '';
  const mentionsCase = body.includes(caseId);
  const substantive = body.replace(/\s/g, '').length > 60;

  if (mentionsCase || substantive) {
    leaks.push({
      route: route.url,
      status: res.status,
      source: route.source,
      echoesCaseId: mentionsCase,
      preview: body.slice(0, 220),
    });
  } else {
    refused.push({ route: route.url, status: res.status, note: 'answered but disclosed nothing' });
  }
}

console.log(`refused: ${refused.length}   leaked: ${leaks.length}   errored: ${errors.length}\n`);

if (leaks.length === 0) {
  results.pass(
    'ISO-01',
    'No case-scoped endpoint answers an unrelated firm',
    `${caseRoutes.length} routes probed, ${refused.length} refused`,
    { probed: caseRoutes.length },
  );
} else {
  for (const l of leaks) {
    results.fail(
      'ISO-01',
      `TENANT ISOLATION: ${l.route} answered an unrelated firm`,
      `HTTP ${l.status}${l.echoesCaseId ? ', response names the case id' : ''} — ${l.source}`,
      l,
    );
  }
}

if (errors.length === 0) {
  results.pass('ISO-02', 'No case-scoped endpoint errored on a cross-tenant probe');
} else {
  for (const e of errors) {
    results.warn('ISO-02', `${e.route} returned HTTP ${e.status} on a cross-tenant probe`, e.source, e);
  }
}

// ---------------------------------------------------------------------------
// A case id that does not exist must be refused too
// ---------------------------------------------------------------------------

const GHOST = '11111111-1111-4111-8111-111111111111';
const ghostAnswers = [];
for (const route of caseRoutes) {
  const url = fill(route.url).replace(caseId, GHOST);
  const res = await req('GET', url, { token: firmA.token, timeoutMs: 45000 });
  if (res.status === 200) {
    const body = res.text ?? '';
    if (body.includes(GHOST) || body.replace(/\s/g, '').length > 60) {
      ghostAnswers.push({ route: route.url, source: route.source, preview: body.slice(0, 200) });
    }
  }
}

ghostAnswers.length === 0
  ? results.pass(
      'ISO-03',
      'No case-scoped endpoint answers for a case that does not exist',
      `${caseRoutes.length} routes probed with an unknown case id`,
    )
  : ghostAnswers.forEach((g) =>
      results.fail(
        'ISO-03',
        `${g.route} produced a response for a case that does not exist`,
        g.source,
        g,
      ),
    );

await results.write({
  caseId,
  routesProbed: caseRoutes.length,
  refused,
  leaks,
  errors,
  ghostAnswers,
});
