#!/usr/bin/env node
// ============================================================================
// Functional smoke test — exercises the running application, not the build.
//
// Run under the pinned interpreter against the isolated port, before nginx is
// touched. If any check fails, cut-over must not begin.
//
//   "$NODE22" deploy/stages/smoke-test.mjs http://127.0.0.1:3100
//
// Creates a test user, case and evidence file in the greenfield database.
// Prints the identifiers so they can be removed afterwards. Uploads nothing
// larger than a few kilobytes.
// ============================================================================

const BASE = process.argv[2] || 'http://127.0.0.1:3100';
const TAG = `smoke-${Date.now()}`;
const results = [];
let token = null;

const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`    [${pass ? ' OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

async function req(path, { method = 'GET', body, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body && !raw) h['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: raw ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120_000),
  });
  let json = null;
  const text = await res.text().catch(() => '');
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

/** A minimal but genuinely valid single-page PDF containing extractable text. */
function tinyPdf(message) {
  const content = `BT /F1 24 Tf 72 700 Td (${message}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

(async () => {
  console.log(`\n=== FUNCTIONAL SMOKE TEST — ${BASE} ===`);

  // -- 1. Liveness and readiness ---------------------------------------------
  const health = await req('/api/health');
  record('GET /api/health returns 200', health.status === 200, `status ${health.status}`);
  record('health reports a commit', Boolean(health.json?.commit), health.json?.commit || 'absent');
  const ready = await req('/api/health/ready');
  record('GET /api/health/ready is healthy', ready.status === 200 && ready.json?.status !== 'unhealthy',
    `${ready.status} / ${ready.json?.status}`);
  const deep = await req('/api/health/deep');
  record('GET /api/health/deep returns 200', deep.status === 200, `status ${deep.status}`);

  // -- 2. Authentication -----------------------------------------------------
  const badLogin = await req('/api/auth/login', {
    method: 'POST', body: { email: 'nobody@example.com', password: 'wrong' },
  });
  record('login with bad credentials returns 401 (404 = wrong app)', badLogin.status === 401,
    `status ${badLogin.status}`);

  const email = `${TAG}@smoke.local`;
  const password = 'SmokeTest!2026x';
  const reg = await req('/api/auth/register', {
    method: 'POST',
    body: { email, password, name: 'Smoke Test', tenantId: TAG, termsAccepted: true, privacyAccepted: true },
  });
  record('registration succeeds', reg.status === 200 || reg.status === 201, `status ${reg.status}`);
  token = reg.json?.accessToken || reg.json?.token || null;

  if (!token) {
    const login = await req('/api/auth/login', { method: 'POST', body: { email, password } });
    token = login.json?.accessToken || login.json?.token || null;
    record('login returns a token', Boolean(token), `status ${login.status}`);
  } else {
    record('registration returns a token', true, 'issued');
  }

  const me = await req('/api/auth/me');
  record('GET /api/auth/me accepts the token', me.status === 200, `status ${me.status}`);

  if (!token) {
    console.log('\n    Cannot continue without a token.');
    return summarise();
  }

  // -- 3. Case ---------------------------------------------------------------
  // caseRoutes.ts:71 requires all four of these; caseType must be one of
  // felony | misdemeanor | infraction | federal.
  const mkCase = await req('/api/cases', {
    method: 'POST',
    body: {
      caseNumber: `SMOKE-${Date.now()}`,
      title: 'Smoke Test Case',
      jurisdiction: 'Smoke County Superior Court',
      caseType: 'felony',
    },
  });
  const caseId = mkCase.json?.caseId || mkCase.json?.case?.caseId || mkCase.json?.data?.caseId || null;
  record('case creation succeeds', Boolean(caseId), caseId ? `caseId ${caseId}` : `status ${mkCase.status}`);

  // -- 4. Evidence upload, hashing, extraction -------------------------------
  if (caseId) {
    const pdf = tinyPdf('CourtAccess deployment smoke test document');
    const form = new FormData();
    form.append('caseId', caseId);
    form.append('evidenceType', 'other_document');
    form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'smoke-test.pdf');

    const up = await fetch(`${BASE}/api/evidence/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
    const upBody = await up.json().catch(() => null);
    record('evidence upload accepted', up.status === 200 || up.status === 201, `status ${up.status}`);

    // serialiseEvidence (evidenceDirectUpload.ts:574) does not include sha256,
    // so the hash cannot be asserted over HTTP. It IS computed and stored —
    // verified directly in the database during smoke-test development. What
    // the API can prove is that the upload was accepted and given an id.
    const ev = upBody?.evidence || upBody?.data?.evidence || upBody;
    record('upload returns an evidence record', Boolean(ev?.evidenceId),
      ev?.evidenceId ? String(ev.evidenceId) : 'no evidenceId in the response');
    if (!ev?.sha256) {
      console.log('    [note] the API does not expose sha256; confirm in the database with:');
      console.log('           psql "$PGURL" -tAc "select \\"fileName\\", sha256 from evidence order by \\"createdAt\\" desc limit 1;"');
    }

    // Give background processing a moment, then read the stored record back.
    await new Promise((r) => setTimeout(r, 8000));
    const list = await req(`/api/cases/${caseId}/evidence`);
    const rows = list.json?.evidence || list.json?.data || (Array.isArray(list.json) ? list.json : []);
    const row = Array.isArray(rows) ? rows.find((r) => r.fileName === 'smoke-test.pdf') : null;
    record('evidence persisted and retrievable', Boolean(row),
      row ? `status ${row.processingStatus}` : `list status ${list.status}`);
    if (row) {
      record('text extraction did not fail', row.processingStatus !== 'failed',
        `processingStatus=${row.processingStatus}${row.processingError ? ' — ' + String(row.processingError).slice(0, 80) : ''}`);
    }

    // -- 5. Legal intelligence ----------------------------------------------
    const calcrim = await req(`/api/calcrim/analyze/${caseId}`);
    record('CALCRIM analysis responds', calcrim.status === 200, `status ${calcrim.status}`);

    const contra = await req(`/api/contradiction/events/${caseId}`);
    record('contradiction engine responds', contra.status === 200, `status ${contra.status}`);
  }

  // -- 6. Statutory retrieval (live leginfo) ---------------------------------
  const codes = await req('/api/charging/codes');
  record('California code list available', codes.status === 200, `status ${codes.status}`);

  const statute = await req('/api/law/calcrim/PEN/459');
  record('statute lookup responds', statute.status === 200 || statute.status === 404,
    `status ${statute.status}${statute.status === 404 ? ' (404 acceptable: no mapping)' : ''}`);

  console.log(`\n    Test data tagged "${TAG}" — remove from the greenfield database when convenient.`);
  summarise();
})().catch((err) => {
  console.error(`\n    [FAIL] smoke test threw: ${err?.message || err}`);
  process.exit(1);
});

function summarise() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n    ${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('    FAILED:');
    failed.forEach((f) => console.log(`      - ${f.name}${f.detail ? ' — ' + f.detail : ''}`));
    process.exit(1);
  }
  process.exit(0);
}
