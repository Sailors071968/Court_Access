#!/usr/bin/env node
// Program 144, anti-fabrication audit.
//
// The engineering constitution says: no citation means no evidence, no
// evidence means no finding, and no finding means UNKNOWN. That is directly
// testable without any real discovery.
//
// A case is created and left completely empty — no evidence, no charges, no
// documents. Every case-scoped intelligence endpoint is then asked for its
// analysis. Any substantive finding returned for that case is fabricated by
// definition, because there is nothing in the repository to support it.
//
// The audit then repeats against a case holding one document, to confirm the
// engines are not simply inert, and checks that findings name their source.

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Results, req, registerUser, login, API, OUT_DIR, exercisedApiRoutes } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('FABRICATION_AUDIT', 'Program 144 — Anti-Fabrication Audit');

// ---------------------------------------------------------------------------
// What counts as a "finding"
//
// A finding is any assertion about the case: an event, a contradiction, a
// claim, a satisfied element, a recommendation, an investigative task. Status
// fields, counters that are zero, empty collections and configuration are not
// findings.
// ---------------------------------------------------------------------------

const FINDING_KEYS = new Set([
  'events', 'timeline', 'contradictions', 'claims', 'impeachment', 'findings',
  'recommendations', 'observations', 'tasks', 'leads', 'exhibits', 'elements',
  'arguments', 'argumentInteractions', 'failureRankings', 'crossExamination',
  'requests', 'alerts', 'issues', 'opportunities', 'witnesses',
  'nodes', 'edges', 'relationships', 'entities', 'charges', 'notes', 'pins',
]);

// A gap is a statement that something is *absent* from the repository. That is
// the opposite of a fabricated finding — the constitution asks for exactly
// this — so gap collections are inspected separately and are never counted as
// assertions about the case.
const ABSENCE_KEYS = new Set(['gaps', 'missing', 'unknowns', 'notInterviewed', 'notObtained']);

// Narrative fields that assert something about the case in prose.
const PROSE_KEYS = new Set([
  'verdict', 'defenseArgument', 'juryNarrative', 'explanation', 'summary',
  'keyFailure', 'burdenMet', 'conclusion', 'analysis', 'narrative',
]);

/**
 * Walk a response body and collect anything that looks like an assertion
 * about the case. Returns a list of { path, kind, sample }.
 */
function collectFindings(body, atPath = '$', out = [], depth = 0) {
  if (depth > 8 || body == null) return out;

  if (Array.isArray(body)) {
    body.forEach((v, i) => collectFindings(v, `${atPath}[${i}]`, out, depth + 1));
    return out;
  }
  if (typeof body !== 'object') return out;

  for (const [key, value] of Object.entries(body)) {
    const here = `${atPath}.${key}`;

    // Statements of absence are not assertions about the case.
    if (ABSENCE_KEYS.has(key)) continue;

    if (FINDING_KEYS.has(key) && Array.isArray(value) && value.length > 0) {
      out.push({ path: here, kind: 'collection', count: value.length, sample: JSON.stringify(value[0]).slice(0, 240) });
    }

    if (PROSE_KEYS.has(key) && typeof value === 'string' && value.trim().length > 0) {
      // Explicit "nothing to report" answers are the correct behaviour.
      if (!/^(unknown|none|n\/a|not (available|proven|determined)|no .{0,40})$/i.test(value.trim())) {
        out.push({ path: here, kind: 'prose', sample: value.slice(0, 240) });
      }
    }

    collectFindings(value, here, out, depth + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Setup: one empty case, one case with a single known document
// ---------------------------------------------------------------------------

const attorney = await registerUser({ prefix: 'fab-audit', defaultRole: 'attorney' });
await prisma.user.update({ where: { id: attorney.user.userId }, data: { role: 'admin' } });
const session = await login(attorney.email, attorney.password);
const token = session.token;

async function makeCase(title) {
  const r = await req('POST', '/api/cases', {
    token,
    body: {
      title,
      caseNumber: `FAB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      jurisdiction: 'Alameda County',
      caseType: 'felony',
    },
  });
  if (r.status !== 201) throw new Error(`case creation failed: ${r.status} ${r.text}`);
  return r.json.case.caseId;
}

const emptyCaseId = await makeCase('Empty case — no evidence of any kind');
const populatedCaseId = await makeCase('Populated case — one police report');

// The populated case gets exactly one document whose content is known.
const reportBytes = await readFile('/tmp/courtaccess-fixtures/police-report.pdf');
{
  const form = new FormData();
  form.append('caseId', populatedCaseId);
  form.append('evidenceType', 'police_report');
  form.append('file', new Blob([reportBytes], { type: 'application/pdf' }), 'police-report.pdf');
  exercisedApiRoutes.add('POST /api/evidence/upload');
  await fetch(`${API}/api/evidence/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}
await new Promise((r) => setTimeout(r, 4000));

console.log(`empty case     ${emptyCaseId}`);
console.log(`populated case ${populatedCaseId}\n`);

// ---------------------------------------------------------------------------
// The endpoints that assert things about a case
// ---------------------------------------------------------------------------

const CASE_ENDPOINTS = [
  ['Timeline events', 'GET', (c) => `/api/timeline/${c}/events`],
  ['Timeline conflicts', 'GET', (c) => `/api/timeline/${c}/conflicts`],
  ['Contradiction graph', 'GET', (c) => `/api/contradiction/graph/${c}`],
  ['Contradiction recommendations', 'GET', (c) => `/api/contradiction/recommendations/${c}`],
  ['Contradiction events', 'GET', (c) => `/api/contradiction/events/${c}`],
  ['CALCRIM analysis', 'GET', (c) => `/api/calcrim/analyze/${c}`],
  ['Charges', 'GET', (c) => `/api/charges/${c}`],
  ['Case intelligence', 'GET', (c) => `/api/cases/${c}/intelligence`],
  ['Case intelligence report', 'GET', (c) => `/api/cases/${c}/intelligence/report`],
  ['Narrative claims', 'GET', (c) => `/api/narrative/${c}/claims`],
  ['Narrative contradictions', 'GET', (c) => `/api/narrative/${c}/contradictions`],
  ['Narrative impeachment', 'GET', (c) => `/api/narrative/${c}/impeachment`],
  ['Attorney workbench', 'GET', (c) => `/api/cases/${c}/workbench`],
  ['Workbench command center', 'GET', (c) => `/api/cases/${c}/workbench/command-center`],
  ['Workbench trial prep', 'GET', (c) => `/api/cases/${c}/workbench/trial-prep`],
  ['Investigator workbench', 'GET', (c) => `/api/cases/${c}/investigator-workbench`],
  ['Evidence gap detection', 'GET', (c) => `/api/cases/${c}/evidence-requests`],
  ['Compliance findings', 'GET', (c) => `/api/compliance/findings/${c}`],
  ['Compliance timeline', 'GET', (c) => `/api/compliance/timeline/${c}`],
  ['Compliance events', 'GET', (c) => `/api/compliance/events/${c}`],
  ['Compliance audit', 'GET', (c) => `/api/compliance/audit/${c}`],
  ['Compliance expert package', 'GET', (c) => `/api/compliance/expert/${c}`],
  ['Compliance jury package', 'GET', (c) => `/api/compliance/jury/${c}`],
  ['Compliance exhibits', 'GET', (c) => `/api/compliance/exhibits/${c}`],
  ['Forensic timeline', 'GET', (c) => `/api/forensic/timeline/${c}`],
  ['Forensic evidence graph', 'GET', (c) => `/api/forensic/evidence-graph/${c}`],
  ['Forensic vision analysis', 'GET', (c) => `/api/forensic/vision/${c}`],
  ['Forensic critical vision', 'GET', (c) => `/api/forensic/vision/${c}/critical`],
  ['Forensic trajectory', 'GET', (c) => `/api/forensic/trajectory/${c}`],
  ['Forensic visibility', 'GET', (c) => `/api/forensic/visibility/${c}`],
  ['Forensic line of sight', 'GET', (c) => `/api/forensic/line-of-sight/${c}`],
  ['Forensic camera sync', 'GET', (c) => `/api/forensic/camera-sync/${c}`],
  ['Forensic scene', 'GET', (c) => `/api/forensic/scene/${c}`],
  ['Forensic expert package', 'GET', (c) => `/api/forensic/expert-package/${c}`],
  ['Forensic jury view', 'GET', (c) => `/api/forensic/jury-view/${c}`],
];

async function probe(caseId) {
  const rows = [];
  for (const [label, method, build] of CASE_ENDPOINTS) {
    const url = build(caseId);
    const res = await req(method, url, { token, timeoutMs: 60000 });
    const findings = res.status === 200 && res.json ? collectFindings(res.json) : [];
    rows.push({ label, url, status: res.status, findings });
  }
  return rows;
}

console.log('--- probing the empty case ---');
const emptyRows = await probe(emptyCaseId);
console.log('--- probing the populated case ---');
const populatedRows = await probe(populatedCaseId);

// ---------------------------------------------------------------------------
// Assertion 1 — an empty case must produce no findings
// ---------------------------------------------------------------------------

const fabricating = emptyRows.filter((r) => r.findings.length > 0);

if (fabricating.length === 0) {
  results.pass(
    'FAB-01',
    'No intelligence endpoint asserts anything about a case with no evidence',
    `${emptyRows.length} endpoints probed against an empty case`,
    { endpointsProbed: emptyRows.length },
  );
} else {
  for (const r of fabricating) {
    results.fail(
      'FAB-01',
      `FABRICATION: ${r.label} returned findings for a case with no evidence`,
      r.findings.map((f) => `${f.path} → ${f.sample}`).join(' | ').slice(0, 300),
      { url: r.url, findings: r.findings },
    );
  }
}

// ---------------------------------------------------------------------------
// Assertion 2 — the engines are not simply inert
//
// If nothing responds even with a document present, assertion 1 is vacuous.
// ---------------------------------------------------------------------------

const respondedEmpty = emptyRows.filter((r) => r.status === 200).length;
const respondedPopulated = populatedRows.filter((r) => r.status === 200).length;
respondedPopulated > 0
  ? results.pass(
      'FAB-02',
      'The intelligence endpoints are reachable, so the empty-case result is meaningful',
      `${respondedPopulated}/${populatedRows.length} answered for the populated case (${respondedEmpty} for the empty one)`,
    )
  : results.fail('FAB-02', 'No intelligence endpoint answered at all', 'the empty-case result proves nothing');

// ---------------------------------------------------------------------------
// Assertion 3 — every finding on the populated case must name a source
// ---------------------------------------------------------------------------

const SOURCE_KEYS = [
  'sourceDoc', 'sourceEvidence', 'sourceType', 'evidenceId', 'documentId',
  'citation', 'citations', 'source', 'sources', 'rawText', 'page', 'pageNumber',
  'sourceEventIds', 'reference', 'exhibitId',
];

// Graph nodes carry their provenance as the identifier itself: the node id is
// the record it stands for. An id plus a label is traceable, so it counts.
const IDENTITY_KEYS = ['"id"', '"nodeId"', '"eventId"'];

function hasSource(sampleJson) {
  if (SOURCE_KEYS.some((k) => sampleJson.includes(`"${k}"`))) return true;
  return IDENTITY_KEYS.some((k) => sampleJson.includes(k)) && sampleJson.includes('"label"');
}

const populatedFindings = populatedRows.flatMap((r) =>
  r.findings.filter((f) => f.kind === 'collection').map((f) => ({ ...f, label: r.label, url: r.url })),
);

if (populatedFindings.length === 0) {
  results.unknown(
    'FAB-03',
    'Traceability of findings could not be assessed',
    'the populated case produced no findings to inspect; a single police report is not enough input for these engines',
  );
} else {
  const untraceable = populatedFindings.filter((f) => !hasSource(f.sample));
  untraceable.length === 0
    ? results.pass(
        'FAB-03',
        'Every finding on the populated case names a source',
        `${populatedFindings.length} finding collections inspected`,
        { inspected: populatedFindings.length },
      )
    : results.fail(
        'FAB-03',
        'Findings were returned with no source attribution',
        untraceable.map((f) => `${f.label} ${f.path}`).join(', ').slice(0, 300),
        { untraceable: untraceable.slice(0, 10) },
      );
}

// ---------------------------------------------------------------------------
// Assertion 4 — a case that does not exist must not yield findings either
// ---------------------------------------------------------------------------

const ghostId = '00000000-0000-4000-8000-000000000000';
const ghostRows = await probe(ghostId);
const ghostFindings = ghostRows.filter((r) => r.findings.length > 0);

ghostFindings.length === 0
  ? results.pass(
      'FAB-04',
      'No endpoint asserts anything about a case that does not exist',
      `${ghostRows.length} endpoints probed with a non-existent case id`,
    )
  : results.fail(
      'FAB-04',
      'FABRICATION: findings returned for a case that does not exist',
      ghostFindings.map((r) => `${r.label}: ${r.findings[0]?.sample}`).join(' | ').slice(0, 300),
      { rows: ghostFindings.slice(0, 8) },
    );

// ---------------------------------------------------------------------------
// Assertion 5 — endpoints must not answer with another tenant's analysis
// ---------------------------------------------------------------------------

const outsider = await registerUser({ prefix: 'fab-outsider', defaultRole: 'attorney' });
const leaked = [];
for (const [label, method, build] of CASE_ENDPOINTS) {
  const res = await req(method, build(populatedCaseId), { token: outsider.token, timeoutMs: 30000 });
  if (res.status === 200 && res.json && collectFindings(res.json).length > 0) {
    leaked.push({ label, url: build(populatedCaseId) });
  }
}
leaked.length === 0
  ? results.pass(
      'FAB-05',
      "Intelligence endpoints do not serve another firm's analysis",
      `${CASE_ENDPOINTS.length} endpoints probed as an unrelated attorney`,
    )
  : results.fail(
      'FAB-05',
      "Another firm's case analysis was returned",
      leaked.map((l) => l.label).join(', ').slice(0, 300),
      { leaked },
    );

await results.write({
  emptyCaseId,
  populatedCaseId,
  endpointsProbed: CASE_ENDPOINTS.length,
  emptyCaseResponses: emptyRows.map((r) => ({ label: r.label, status: r.status, findingCount: r.findings.length })),
  populatedCaseResponses: populatedRows.map((r) => ({ label: r.label, status: r.status, findingCount: r.findings.length })),
  emptyCaseFindings: fabricating,
});
await prisma.$disconnect();
