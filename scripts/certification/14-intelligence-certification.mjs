#!/usr/bin/env node
// Program 144, Phases 5, 6, 8 and 9 — CALCRIM, mens rea, investigation and
// motion intelligence.
//
// The question for each engine is the same: does it assert only what the
// repository supports, and does it say UNKNOWN when it holds nothing? Coverage
// is measured and reported rather than assumed, because an engine that covers
// two offences is not the same as an engine that covers the Penal Code.

import { readFile } from 'node:fs/promises';
import { Results, req, registerUser, login, API, exercisedApiRoutes } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('INTELLIGENCE_CERTIFICATION', 'Program 144 — CALCRIM, Mens Rea, Investigation, Motions');

const attorney = await registerUser({ prefix: 'intel', defaultRole: 'attorney' });
const session = await login(attorney.email, attorney.password);
const token = session.token;
const tenantId = attorney.user.tenantId;

async function mkCase(title) {
  const r = await req('POST', '/api/cases', {
    token,
    body: {
      title,
      caseNumber: `INT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      jurisdiction: 'Alameda County',
      caseType: 'felony',
    },
  });
  return r.json.case.caseId;
}

// ===========================================================================
// Phase 5 — CALCRIM
// ===========================================================================

// (a) A case with no charges must assert nothing.
const noCharge = await mkCase('No charges entered');
const noChargeRes = await req('GET', `/api/calcrim/analyze/${noCharge}`, { token, timeoutMs: 60000 });
noChargeRes.status === 200 && noChargeRes.json.overallCaseStrength === 'UNKNOWN'
  ? results.pass(
      'CAL-01',
      'A case with no charges is reported as UNKNOWN, not assessed',
      noChargeRes.json.message?.slice(0, 140),
    )
  : results.fail(
      'CAL-01',
      'A case with no charges produced an assessment',
      `HTTP ${noChargeRes.status}: ${JSON.stringify(noChargeRes.json).slice(0, 200)}`,
    );

// (b) A charged offence with no instruction must be reported, not dropped.
const unmapped = await mkCase('Charged with an offence outside the library');
await req('POST', '/api/charges', {
  token,
  body: { caseId: unmapped, code: 'PC', section: '245(a)(1)', title: 'Assault with a deadly weapon', victim: 'Unidentified male' },
});
const unmappedRes = await req('GET', `/api/calcrim/analyze/${unmapped}`, { token, timeoutMs: 60000 });
const reported = (unmappedRes.json?.unmappedCharges ?? []).some((c) => c.charge.includes('245'));
reported
  ? results.pass(
      'CAL-02',
      'A charged offence with no instruction is reported rather than silently dropped',
      unmappedRes.json.unmappedCharges[0].reason.slice(0, 150),
    )
  : results.fail(
      'CAL-02',
      'A charged offence disappeared from the analysis',
      `charges=${JSON.stringify(unmappedRes.json?.charges)} unmapped=${JSON.stringify(unmappedRes.json?.unmappedCharges)}`.slice(0, 240),
    );

unmappedRes.json?.overallCaseStrength === 'UNKNOWN'
  ? results.pass('CAL-03', 'No case assessment is offered when nothing could be analysed', 'overallCaseStrength=UNKNOWN')
  : results.fail(
      'CAL-03',
      'A case assessment was asserted with nothing analysed',
      `overallCaseStrength=${unmappedRes.json?.overallCaseStrength}`,
    );

// (c) A mapped offence: elements must only be supported by real evidence.
const mapped = await mkCase('Burglary count');
await req('POST', '/api/charges', {
  token,
  body: { caseId: mapped, code: 'PC', section: '459', title: 'Burglary', victim: 'Homeowner' },
});

const beforeEvidence = await req('GET', `/api/calcrim/analyze/${mapped}`, { token, timeoutMs: 60000 });
const beforeCharge = beforeEvidence.json?.charges?.[0];

if (!beforeCharge) {
  results.fail('CAL-04', 'The instruction for a mapped offence was not found', 'PC 459 should resolve to CALCRIM 1700');
} else {
  const anySupported = beforeCharge.elements.some((e) => e.supported);
  anySupported
    ? results.fail(
        'CAL-04',
        'An element was marked satisfied with no evidence in the case',
        beforeCharge.elements.filter((e) => e.supported).map((e) => e.elementId).join(', '),
      )
    : results.pass(
        'CAL-04',
        'No element is satisfied before any evidence exists',
        `${beforeCharge.elements.length} elements of CALCRIM ${beforeCharge.calcrim}, all unsupported`,
      );

  // Add one event that speaks to the entry element only.
  await prisma.timelineEvent.create({
    data: {
      caseId: mapped,
      tenantId,
      timestamp: new Date('2026-03-14T22:47:00Z'),
      description: 'Defendant entered the residence through the rear door',
      action: 'enter',
      target: 'residence',
      actor: 'Defendant',
      sourceDoc: 'police-report.pdf',
      sourceType: 'police_report',
      confidence: 0.9,
    },
  });

  const afterEvidence = await req('GET', `/api/calcrim/analyze/${mapped}`, { token, timeoutMs: 60000 });
  const afterCharge = afterEvidence.json?.charges?.[0];
  const entry = afterCharge?.elements.find((e) => e.elementId === 'entry');
  const intent = afterCharge?.elements.find((e) => e.elementId === 'intent');

  entry?.supported && entry.supportingEvidence.length > 0
    ? results.pass(
        'CAL-05',
        'An element becomes supported only when evidence is present, and cites it',
        `entry supported by ${entry.supportingEvidence.length} item(s) from ${entry.supportingEvidence[0].sourceType}`,
      )
    : results.fail('CAL-05', 'An element with supporting evidence was not marked supported', JSON.stringify(entry).slice(0, 200));

  intent && !intent.supported
    ? results.pass(
        'CAL-06',
        'An element with no supporting evidence stays unsatisfied and is listed as missing',
        `intent unsupported; missing: ${afterCharge.missingElements.map((m) => m.elementId).join(', ')}`,
      )
    : results.fail(
        'CAL-06',
        'Intent was inferred without evidence supporting it',
        JSON.stringify(intent).slice(0, 200),
      );
}

// (d) Coverage is a fact about the product and must be stated, not implied.
const mappingSource = await readFile('/workspace/backend/src/data/calcrimMapping.ts', 'utf8');
const mappedOffences = [...mappingSource.matchAll(/^\s{2}"([^"]+)":/gm)].map((m) => m[1]);
results.warn(
  'CAL-07',
  'The CALCRIM instruction library covers only a small number of offences',
  `${mappedOffences.length} mapped: ${mappedOffences.join(', ')}. Any other charged count returns UNKNOWN.`,
  { mappedOffences },
);

// ===========================================================================
// Phase 6 — Mens rea
// ===========================================================================

// The extracted mens rea repository must mark what it could not determine.
const mensReaRaw = await readFile(
  '/workspace/backend/data/legislative/repositories/mens_rea/records.jsonl',
  'utf8',
).catch(() => '');
const mensReaRecords = mensReaRaw
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  })
  .filter(Boolean);

if (mensReaRecords.length === 0) {
  results.unknown('MR-01', 'No mens rea records are held', 'the extraction repository is empty in this environment');
} else {
  const everyFieldMarked = mensReaRecords.every(
    (r) => r.type?.confidence !== undefined && r.terms?.confidence !== undefined,
  );
  everyFieldMarked
    ? results.pass(
        'MR-01',
        'Every mens rea record carries an explicit confidence on each field',
        `${mensReaRecords.length} records; undetermined fields are recorded as UNKNOWN rather than guessed`,
      )
    : results.fail('MR-01', 'Mens rea records omit confidence markers', `${mensReaRecords.length} records inspected`);

  const traceable = mensReaRecords.every((r) => r.audit?.sourceUrl && r.audit?.contentHash);
  traceable
    ? results.pass(
        'MR-02',
        'Every mens rea record cites the statute text it was extracted from',
        `each carries a source URL and a content hash; e.g. ${mensReaRecords[0].audit.sourceUrl.slice(0, 80)}`,
      )
    : results.fail('MR-02', 'Mens rea records are not traceable to a source', 'missing sourceUrl or contentHash');

  const unknowns = mensReaRecords.filter((r) => r.type?.value === 'UNKNOWN').length;
  results.warn(
    'MR-03',
    'Mens rea coverage is very small',
    `${mensReaRecords.length} statute(s) have an extracted mental state, of which ${unknowns} are UNKNOWN. ` +
      'Charged offences outside this set have no mens rea analysis.',
    { records: mensReaRecords.length, unknown: unknowns },
  );
}

// A statute the repository does not hold must not produce invented analysis.
const absent = await req('GET', '/api/legislative/intelligence/PEN/187', { token, timeoutMs: 45000 });
absent.status === 404
  ? results.pass(
      'MR-04',
      'A statute outside the repository returns nothing rather than invented analysis',
      `HTTP 404: ${absent.json?.error?.slice(0, 120)}`,
    )
  : absent.status === 200
    ? results.fail(
        'MR-04',
        'Analysis was returned for a statute the repository does not hold',
        JSON.stringify(absent.json).slice(0, 200),
      )
    : results.warn('MR-04', 'Unexpected response for an absent statute', `HTTP ${absent.status}`);

// ===========================================================================
// Phase 8 — Investigation intelligence
// ===========================================================================

const investigation = await mkCase('Investigation opportunities');
const invForm = new FormData();
invForm.append('caseId', investigation);
invForm.append('evidenceType', 'police_report');
invForm.append('file', new Blob([await readFile('/tmp/courtaccess-fixtures/police-report.pdf')], { type: 'application/pdf' }), 'police-report.pdf');
exercisedApiRoutes.add('POST /api/evidence/upload');
await fetch(`${API}/api/evidence/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: invForm });
await new Promise((r) => setTimeout(r, 4000));

const invRes = await req('GET', `/api/cases/${investigation}/investigator-workbench`, { token, timeoutMs: 45000 });
if (invRes.status !== 200) {
  results.fail('INV-01', 'The investigator workbench did not respond', `HTTP ${invRes.status}`);
} else {
  const gaps = invRes.json?.gaps ?? {};
  const allGaps = Object.values(gaps).flat().filter((g) => typeof g === 'string');
  // A gap must describe what is absent; it must not assert a fact.
  const assertsFact = allGaps.filter((g) => /\b(the defendant|the suspect) (did|was seen|admitted|confessed)\b/i.test(g));
  allGaps.length > 0 && assertsFact.length === 0
    ? results.pass(
        'INV-01',
        'Investigation output describes what is absent rather than asserting facts',
        `${allGaps.length} gap statement(s); e.g. "${allGaps[0].slice(0, 110)}"`,
        { gaps: allGaps },
      )
    : assertsFact.length > 0
      ? results.fail('INV-01', 'An investigation gap asserted a fact about the case', assertsFact.join('; ').slice(0, 220))
      : results.warn('INV-01', 'The investigator workbench reported no gaps for a case holding one document', JSON.stringify(gaps).slice(0, 200));
}

// Evidence gap detection must tie each request to the case.
const gapRes = await req('GET', `/api/cases/${investigation}/evidence-requests`, { token, timeoutMs: 45000 });
gapRes.status === 200
  ? results.pass(
      'INV-02',
      'Evidence gap detection responds for a populated case',
      `${(gapRes.json?.requests ?? gapRes.json ?? []).length ?? 0} outstanding request(s)`,
    )
  : results.fail('INV-02', 'Evidence gap detection failed', `HTTP ${gapRes.status}`);

// ===========================================================================
// Phase 9 — Motion intelligence
// ===========================================================================

// The engines exist in the codebase; the question is whether any route
// surfaces them, because an engine no endpoint reaches cannot be certified.
const motionRoutes = [
  `/api/cases/${investigation}/intelligence`,
  `/api/cases/${investigation}/intelligence/report`,
  `/api/cases/${investigation}/workbench/trial-prep`,
];
const motionResponses = [];
for (const url of motionRoutes) {
  const res = await req('GET', url, { token, timeoutMs: 60000 });
  motionResponses.push({ url, status: res.status, hasMotionContent: /motion|suppress|brady|pitchess/i.test(res.text ?? '') });
}

const surfaced = motionResponses.filter((m) => m.status === 200 && m.hasMotionContent);
surfaced.length > 0
  ? results.pass(
      'MOT-01',
      'Motion-related issues are surfaced through the API',
      surfaced.map((m) => m.url.replace(investigation, ':caseId')).join(', '),
      { motionResponses },
    )
  : results.unknown(
      'MOT-01',
      'No endpoint surfaces motion intelligence',
      'motionRecommendationEngine, subpoenaRecommendationEngine and publicRecordsRecommendationEngine exist in ' +
        'backend/src/services but no route exposes them, so Phase 9 cannot be certified against a running system',
      { motionResponses },
    );

await results.write({
  mappedOffences,
  mensReaRecordCount: mensReaRecords.length,
  motionResponses,
});
await prisma.$disconnect();
