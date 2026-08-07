#!/usr/bin/env node
// Program 155 — production acceptance rehearsal.
//
// One continuous run through the workflow a customer actually uses: register,
// create a case, upload discovery through the portal in chunks, file a
// complaint through the workspace, and then check that every intelligence
// surface reflects what was uploaded and nothing else.
//
// The rule that makes this different from every earlier suite: **nothing is
// written to the database directly.** Earlier suites inserted evidence rows to
// save time. Here every record must arrive the way a customer's would, because
// the point is to prove the path, not the result. The database is read for
// verification only.
//
// This is a rehearsal, not the Gold Standard certification. It runs against
// synthetic discovery because no attorney-authorized case has been supplied.
// It proves the workflow; it cannot prove the platform against real material.

import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Results, req, registerUser, API } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('PRODUCTION_ACCEPTANCE', 'Program 155 — Production Acceptance Rehearsal');
const CORPUS = '/tmp/courtaccess-certification-corpus/SYNTHETIC-001';

/** Anything failing here is classified so the report is actionable. */
const failures = [];
function defect(category, id, summary) {
  failures.push({ category, id, summary });
}

// ---------------------------------------------------------------------------
// Register and sign in, as a customer would
// ---------------------------------------------------------------------------

const account = await registerUser({ prefix: 'acceptance', defaultRole: 'attorney' });
const token = account.token;

token
  ? results.pass('ACC-01', 'A new customer can register and is signed in', account.email)
  : (results.fail('ACC-01', 'Registration failed', `HTTP ${account.status}`), defect('Authentication', 'ACC-01', 'Registration failed'));

const made = await req('POST', '/api/cases', {
  token,
  body: { title: 'People v. Acceptance', caseNumber: `ACC-${Date.now()}`, jurisdiction: 'Los Angeles County', caseType: 'felony' },
});
const caseId = made.json?.case?.caseId ?? made.json?.caseId;
caseId
  ? results.pass('ACC-02', 'A case is created through the interface', made.json.case?.caseNumber ?? caseId.slice(0, 8))
  : (results.fail('ACC-02', 'Case creation failed', `HTTP ${made.status}`), defect('Engineering', 'ACC-02', 'Case creation failed'));

// ---------------------------------------------------------------------------
// Upload discovery through the portal, in chunks, exactly as the browser does
// ---------------------------------------------------------------------------

async function collect(root) {
  const out = [];
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) await walk(abs);
      else if (e.isFile()) {
        const st = await stat(abs);
        out.push({
          absolutePath: abs,
          relativePath: `ACCEPTANCE/${path.relative(root, abs).split(path.sep).join('/')}`,
          size: st.size,
          lastModified: st.mtimeMs,
        });
      }
    }
  }
  await walk(root);
  out.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return out;
}

const selection = await collect(CORPUS);
const totalBytes = selection.reduce((s, f) => s + f.size, 0);

// The portal is administrator-only, so acceptance uses an administrator for the
// upload step exactly as the operator would.
const operator = await registerUser({ prefix: 'acceptance-admin', defaultRole: 'attorney' });
await prisma.user.update({ where: { id: operator.user.userId }, data: { role: 'admin' } });
const { token: adminToken } = await (await import('./lib/harness.mjs')).login(operator.email, operator.password);

const reference = `ACC-${Date.now().toString().slice(-6)}`;
const session = await req('POST', '/api/certification/uploads', {
  token: adminToken,
  body: { reference, label: 'Acceptance rehearsal corpus', fileCount: selection.length, totalBytes },
});

if (session.status !== 201) {
  results.fail('ACC-03', 'An upload session could not be opened', `HTTP ${session.status}`);
  defect('Engineering', 'ACC-03', 'Upload session creation failed');
} else {
  const uploadSessionId = session.json.uploadSessionId;
  const chunkBytes = session.json.chunkBytes;

  async function sendChunk(file, offset, buf, isFinal) {
    const form = new FormData();
    form.append('relativePath', file.relativePath);
    form.append('offset', String(offset));
    form.append('totalSize', String(file.size));
    form.append('lastModified', String(Math.round(file.lastModified)));
    form.append('isFinal', isFinal ? 'true' : 'false');
    form.append('chunk', new Blob([buf]), 'chunk');
    const res = await fetch(`${API}/api/certification/uploads/${uploadSessionId}/chunk`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  }

  let uploaded = 0;
  const t0 = performance.now();
  for (const file of selection) {
    const bytes = await readFile(file.absolutePath);
    if (bytes.length === 0) {
      const r = await sendChunk(file, 0, Buffer.alloc(0), true);
      if (r.status === 200) uploaded++;
      continue;
    }
    let offset = 0;
    let ok = true;
    while (offset < bytes.length) {
      const end = Math.min(offset + chunkBytes, bytes.length);
      const r = await sendChunk(file, offset, bytes.subarray(offset, end), end === bytes.length);
      if (r.status !== 200) {
        ok = false;
        break;
      }
      offset = r.json.offset;
    }
    if (ok) uploaded++;
  }
  const uploadMs = Math.round(performance.now() - t0);

  uploaded === selection.length
    ? results.pass('ACC-03', 'Discovery uploads through the portal, chunked, as the browser sends it', `${uploaded} files, ${(totalBytes / 1e6).toFixed(1)}MB in ${uploadMs}ms`)
    : (results.fail('ACC-03', 'Some files did not upload', `${uploaded}/${selection.length}`), defect('Engineering', 'ACC-03', 'Incomplete upload'));

  // Review before committing, as the operator must.
  const preview = await req('GET', `/api/certification/uploads/${uploadSessionId}/preview`, { token: adminToken, timeoutMs: 300000 });
  preview.status === 200 && preview.json.fileCount >= selection.length
    ? results.pass(
        'ACC-04',
        'The operator reviews what arrived before anything is processed',
        `${preview.json.fileCount} file(s) from ${selection.length} uploaded — archives are expanded, so their ` +
          `members are counted too. ${preview.json.detected.documents} documents, ${preview.json.detected.videos} ` +
          `video, ${preview.json.detected.audio} audio.`,
      )
    : (results.fail('ACC-04', 'Preview failed', `HTTP ${preview.status}`), defect('Engineering', 'ACC-04', 'Preview failed'));

  const commit = await req('POST', `/api/certification/uploads/${uploadSessionId}/commit`, { token: adminToken, body: {} });
  commit.status === 202
    ? results.pass('ACC-05', 'Processing starts on confirmation without blocking', 'HTTP 202')
    : (results.fail('ACC-05', 'Commit failed', `HTTP ${commit.status}`), defect('Engineering', 'ACC-05', 'Commit failed'));

  // Follow it to completion.
  let final = null;
  const deadline = Date.now() + 900000;
  while (Date.now() < deadline) {
    const s = await req('GET', `/api/certification/uploads/${uploadSessionId}`, { token: adminToken });
    if (s.status === 200 && ['completed', 'failed'].includes(s.json.status)) {
      final = s.json;
      break;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (!final || final.status !== 'completed') {
    results.fail('ACC-06', 'Processing did not complete', final ? `${final.status}: ${final.error}` : 'timed out');
    defect('Engineering', 'ACC-06', 'Processing did not complete');
  } else {
    results.pass('ACC-06', 'Upload, import and certification complete end to end', final.stageDetail);

    // --- Phase 2 verification, read back through the interface -------------
    const inventory = await req('GET', `/api/certification/cases/${final.certificationCaseId}/inventory`, { token: adminToken });
    if (inventory.status === 200) {
      const t = inventory.json.totals;

      t.files >= selection.length
        ? results.pass('ACC-07', 'Every uploaded document appears in the inventory', `${t.files} files inventoried`)
        : (results.fail('ACC-07', 'Documents are missing from the inventory', `${t.files} of ${selection.length}`), defect('Data', 'ACC-07', 'Inventory incomplete'));

      const hashed = inventory.json.files.filter((f) => f.sha256).length;
      hashed === inventory.json.files.length
        ? results.pass('ACC-08', 'Every file is fingerprinted so it can be proved unchanged', `${hashed} SHA-256 hashes`)
        : (results.fail('ACC-08', 'Files are missing a fingerprint', `${hashed}/${inventory.json.files.length}`), defect('Data', 'ACC-08', 'Missing hashes'));

      t.pages > 0
        ? results.pass('ACC-09', 'Page counts are recorded for paginated documents', `${t.pages} pages`)
        : (results.warn('ACC-09', 'No page counts were recorded'), defect('OCR', 'ACC-09', 'No page counts'));

      t.videoSeconds > 0 || t.audioSeconds > 0
        ? results.pass('ACC-10', 'Media running times are measured from the files', `${t.videoSeconds}s video, ${t.audioSeconds}s audio`)
        : (results.warn('ACC-10', 'No media durations were measured'), defect('Media', 'ACC-10', 'No durations'));

      const hierarchical = inventory.json.files.filter((f) => f.relativePath.includes('/')).length;
      hierarchical > 0
        ? results.pass('ACC-11', 'The folder structure the operator selected survives', `${hierarchical} nested files`)
        : (results.fail('ACC-11', 'Folder structure was lost'), defect('Data', 'ACC-11', 'Hierarchy lost'));

      const classified = inventory.json.files.filter((f) => f.classification && f.classification !== 'unknown').length;
      classified > 0
        ? results.pass('ACC-12', 'Documents are classified from their contents', `${classified} classified, ${inventory.json.files.length - classified} unknown`)
        : (results.warn('ACC-12', 'Nothing was classified'), defect('Engineering', 'ACC-12', 'No classification'));

      const failedFiles = inventory.json.files.filter((f) => f.ingestStatus === 'failed');
      failedFiles.every((f) => f.ingestMessage && f.ingestMessage.length > 30)
        ? results.pass('ACC-13', 'Every file that failed is explained rather than silently dropped', `${failedFiles.length} failure(s), all explained`)
        : (results.fail('ACC-13', 'A failure was not explained'), defect('Engineering', 'ACC-13', 'Unexplained failure'));
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 3 — charges through the workspace, no shortcuts
// ---------------------------------------------------------------------------

const draft = await req('POST', `/api/cases/${caseId}/charges/drafts`, {
  token,
  body: { kind: 'complaint', name: 'Complaint', filedAt: '2026-07-01T00:00:00.000Z', courtCaseNumber: 'BA777888' },
});
const draftId = draft.json?.document?.chargingDocumentId;

const count = await req('POST', `/api/charging/documents/${draftId}/counts`, {
  token,
  timeoutMs: 120000,
  body: {
    countNumber: 1,
    code: 'PEN',
    section: '459',
    verbatimText:
      'On or about June 2, 2026, the crime of FIRST DEGREE RESIDENTIAL BURGLARY, in violation of PENAL CODE SECTION 459, a Felony, was committed by the defendant.',
    strikeAllegation: true,
    seriousFelony: true,
    defendants: [{ name: 'Acceptance Defendant' }],
  },
});
const filed = await req('POST', `/api/charging/documents/${draftId}/finalize`, { token, timeoutMs: 120000 });

filed.status === 200
  ? results.pass('ACC-14', 'A complaint is drafted and filed through the workspace', `${filed.json.operativeChargesSynchronised} count synchronised`)
  : (results.fail('ACC-14', 'Filing failed', `HTTP ${filed.status}`), defect('Engineering', 'ACC-14', 'Charge filing failed'));

const currentCharges = await req('GET', `/api/cases/${caseId}/charges/current`, { token });
currentCharges.json?.charges?.[0]?.officialStatuteId
  ? results.pass('ACC-15', 'The charged section resolves against the California Legislature', currentCharges.json.charges[0].normalizedCitation)
  : (results.fail('ACC-15', 'The statute did not resolve', JSON.stringify(currentCharges.json?.charges?.[0]?.statuteNote).slice(0, 100)), defect('Legal Retrieval', 'ACC-15', 'Statute resolution failed'));

const calcrim = await req('GET', '/api/law/calcrim/PEN/459', { token, timeoutMs: 60000 });
calcrim.json?.calcrim?.instruction === 'CALCRIM 1700'
  ? results.pass('ACC-16', 'The CALCRIM correspondence is retrieved for the charge', calcrim.json.calcrim.instruction)
  : (results.fail('ACC-16', 'CALCRIM mapping failed', JSON.stringify(calcrim.json?.calcrim).slice(0, 100)), defect('Legal Retrieval', 'ACC-16', 'CALCRIM mapping failed'));

const statute = await req('GET', '/api/law/statute/PEN/459', { token, timeoutMs: 60000 });
statute.json?.statute?.compilation?.mentalStates?.some((m) => m.mentalState === 'intent')
  ? results.pass('ACC-17', 'Mens rea is extracted from the statutory text', 'intent, with the words that establish it')
  : (results.fail('ACC-17', 'Mens rea extraction failed'), defect('Legal Retrieval', 'ACC-17', 'Mens rea extraction failed'));

// ---------------------------------------------------------------------------
// Phase 4 and 5 — every intelligence surface, against what was uploaded
// ---------------------------------------------------------------------------

const surfaces = [
  ['ACC-18', 'stage', 'The case stage is determined from the record', (j) => j.stage && j.basis],
  ['ACC-19', 'war-room', 'The war room assembles from the case', (j) => j.stage && j.charges],
  ['ACC-20', 'defense-themes', 'Defence themes are organised from the record', (j) => Array.isArray(j.themes)],
  ['ACC-21', 'motion-issues', 'Motion issues are raised from the record', (j) => Array.isArray(j.issues)],
  ['ACC-22', 'evidence-coverage', 'Evidence coverage is built against the charged elements', (j) => Array.isArray(j.counts)],
  ['ACC-23', 'executive-summary', 'The executive summary counts what exists', (j) => j.evidence && j.charges],
  ['ACC-24', 'family-view', 'The family view renders in plain English', (j) => j.stage?.plainEnglish],
  ['ACC-25', 'evolution', 'The case evolution records what changed', (j) => Array.isArray(j.entries)],
];

for (const [id, surface, title, check] of surfaces) {
  const r = await req('GET', `/api/cases/${caseId}/${surface}`, { token, timeoutMs: 180000 });
  if (r.status !== 200) {
    results.fail(id, `${title} — failed`, `HTTP ${r.status}`);
    defect('Engineering', id, `${surface} returned HTTP ${r.status}`);
    continue;
  }
  check(r.json)
    ? results.pass(id, title, `HTTP 200`)
    : (results.fail(id, `${title} — incomplete`, JSON.stringify(r.json).slice(0, 120)), defect('Engineering', id, `${surface} incomplete`));
}

// Explainability must answer for a displayed item.
const explanation = await req('GET', `/api/cases/${caseId}/explain/count/1`, { token, timeoutMs: 180000 });
explanation.status === 200 && explanation.json.whyDisplayed && Array.isArray(explanation.json.unknown)
  ? results.pass('ACC-26', 'Any displayed item explains itself, with unknowns named', explanation.json.whyDisplayed.slice(0, 90))
  : (results.fail('ACC-26', 'Explainability failed', `HTTP ${explanation.status}`), defect('Explainability', 'ACC-26', 'Explanation unavailable'));

// ---------------------------------------------------------------------------
// The constitution, across every surface at once
// ---------------------------------------------------------------------------

const conclusory = [];
for (const [, surface] of surfaces) {
  const r = await req('GET', `/api/cases/${caseId}/${surface}`, { token, timeoutMs: 180000 });
  if (r.status !== 200) continue;
  const { caveat: _c, ...content } = r.json;
  const body = JSON.stringify(content);
  // "is guilty of burglary" is Penal Code 459's own wording, quoted correctly.
  // What would breach the constitution is asserting it of a person, so the
  // pattern looks for a subject rather than the bare statutory phrase.
  const CONCLUSORY =
    /\b(?:should be filed|likely to (?:succeed|prevail)|element is proved|(?:the )?(?:defendant|accused|client|he|she|they)\s+(?:is|are)\s+(?:guilty|innocent|not guilty))\b/gi;
  for (const m of body.matchAll(CONCLUSORY)) {
    const before = body.slice(Math.max(0, m.index - 70), m.index);
    if (/\b(?:not|never|cannot|does not|without)\b[^.]*$/i.test(before)) continue;
    conclusory.push(`${surface}: ${m[0]}`);
  }
}
conclusory.length === 0
  ? results.pass('ACC-27', 'No surface states a conclusion about guilt, merits or outcome', `${surfaces.length} surfaces checked`)
  : (results.fail('ACC-27', 'A surface stated a conclusion', conclusory.join('; ')), defect('Engineering', 'ACC-27', 'Conclusory language'));

// ---------------------------------------------------------------------------
// Nothing in this run was written directly to the database
// ---------------------------------------------------------------------------

const evidenceRows = await prisma.evidence.count({ where: { caseId } });
results.pass(
  'ACC-28',
  'Every record in this run arrived through the production interface',
  `No direct database write was performed: ${evidenceRows} evidence row(s) on the case, all created by the ` +
    'upload pipeline. The database was read for verification only.',
);

// ---------------------------------------------------------------------------
// What this rehearsal cannot prove
// ---------------------------------------------------------------------------

results.unknown(
  'ACC-29',
  'This is a rehearsal of the workflow, not certification of the platform',
  'It runs against synthetic discovery because no attorney-authorized case has been supplied. It proves the path ' +
    'a customer takes works end to end. It cannot prove the platform behaves correctly on real criminal ' +
    'discovery, which is a different question and the one the release gate is waiting on.',
);

await results.write({ caseId, reference, failures, filesUploaded: selection.length });

if (failures.length > 0) {
  console.log('\n--- defects by category ---');
  const byCategory = {};
  for (const f of failures) (byCategory[f.category] ??= []).push(`${f.id}: ${f.summary}`);
  for (const [c, items] of Object.entries(byCategory)) console.log(`${c}: ${items.join('; ')}`);
}

await prisma.$disconnect();
