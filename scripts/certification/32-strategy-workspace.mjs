#!/usr/bin/env node
// Program 150 — defence strategy, motion intelligence and the action centre.
//
// The point of these surfaces is that they organise the record without
// concluding anything from it. Most of what is checked here is therefore about
// restraint: that a theme cites the passage that raised it, that a theme with
// nothing behind it says so rather than disappearing, and that nothing
// anywhere tells a lawyer to file a motion or how a case will end.

import { createHash } from 'node:crypto';
import { Results, req, registerUser } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('STRATEGY_WORKSPACE', 'Program 150 — Defence Strategy and Motion Intelligence');

const account = await registerUser({ prefix: 'strategy-atty', defaultRole: 'attorney' });
const token = account.token;

const created = await req('POST', '/api/cases', {
  token,
  body: { title: 'People v. Reyes', caseNumber: `STRAT-${Date.now()}`, jurisdiction: 'Los Angeles County', caseType: 'felony' },
});
const caseId = created.json?.case?.caseId ?? created.json?.caseId;

// ---------------------------------------------------------------------------
// An empty case must say the record is empty, not that the themes were rejected
// ---------------------------------------------------------------------------

const empty = await req('GET', `/api/cases/${caseId}/defense-themes`, { token, timeoutMs: 120000 });
if (empty.status !== 200) {
  results.fail('STR-01', 'The defence workspace could not be read', `HTTP ${empty.status}`);
} else {
  empty.json.themes.length > 25
    ? results.pass('STR-01', 'Every defence theme is examined, not a chosen few', `${empty.json.themes.length} themes`)
    : results.fail('STR-01', 'Too few themes are examined', String(empty.json.themes.length));

  empty.json.themes.every((t) => t.status === 'unsupported')
    ? results.pass('STR-02', 'With no evidence in the case every theme is unsupported', 'nothing claimed from an empty record')
    : results.fail('STR-02', 'A theme was supported with no evidence in the case');

  /record is empty, not because the themes were considered and rejected/i.test(empty.json.message ?? '')
    ? results.pass(
        'STR-03',
        'An empty record is distinguished from themes that were examined and found wanting',
        empty.json.message.slice(0, 110),
      )
    : results.fail('STR-03', 'An empty record is not explained', String(empty.json.message).slice(0, 140));
}

// ---------------------------------------------------------------------------
// Put a real police report into the record
// ---------------------------------------------------------------------------

const report = `
LOS ANGELES POLICE DEPARTMENT — INVESTIGATIVE REPORT

On April 2, 2026 at approximately 21:40 hours I conducted a traffic stop on a vehicle driven by MARCO REYES.
I detained the driver and conducted a pat-down for weapons. I then conducted a warrantless search of the
passenger compartment and located a black backpack in plain view behind the driver seat.

The backpack contained a crystalline substance. A presumptive test was conducted in the field. The item was
booked into evidence under tag 26-114872 and transferred to the laboratory for confirmatory analysis.

Witness JANE SOTO stated she briefly saw a male subject from a distance in poor lighting and stated the
suspect resembled the driver. A show-up identification was conducted at the scene.

REYES was advised of his Miranda rights at the scene. REYES stated he did not know the backpack was in the
vehicle and that other people had access to the vehicle that evening.

Body-worn camera was not activated during the initial contact.
`;

const evidenceCreated = await prisma.evidence.create({
  data: {
    caseId,
    tenantId: account.user.tenantId,
    uploadedBy: account.user.userId,
    fileName: 'Investigative Report 26-114872.pdf',
    size: BigInt(report.length),
    mimeType: 'application/pdf',
    evidenceType: 'police_report',
    processingStatus: 'completed',
  },
});
await prisma.evidenceChunk.create({
  data: {
    evidenceId: evidenceCreated.evidenceId,
    tenantId: account.user.tenantId,
    chunkIndex: 0,
    text: report,
    startOffset: 0,
    endOffset: report.length,
    charCount: report.length,
    checksum: createHash('sha256').update(report).digest('hex').slice(0, 16),
  },
});

// ---------------------------------------------------------------------------
// Themes must surface from what the document says, with the passage quoted
// ---------------------------------------------------------------------------

const themes = await req('GET', `/api/cases/${caseId}/defense-themes`, { token, timeoutMs: 120000 });
const supported = (themes.json?.themes ?? []).filter((t) => t.status === 'supported');
const byId = Object.fromEntries((themes.json?.themes ?? []).map((t) => [t.id, t]));

supported.length > 0
  ? results.pass('STR-04', 'Themes surface from the language of the record', `${supported.length} supported: ${supported.map((t) => t.label).join(', ')}`)
  : results.fail('STR-04', 'No theme surfaced from a report full of relevant material');

byId.fourth_amendment?.status === 'supported'
  ? results.pass('STR-05', 'A warrantless search in the report raises the Fourth Amendment', byId.fourth_amendment.citations[0]?.matchedOn)
  : results.fail('STR-05', 'The Fourth Amendment theme did not surface');

byId.miranda?.status === 'supported'
  ? results.pass('STR-06', 'A Miranda advisement in the report raises Miranda', byId.miranda.citations[0]?.matchedOn)
  : results.fail('STR-06', 'The Miranda theme did not surface');

byId.possession?.status === 'supported'
  ? results.pass('STR-07', 'Shared access to a vehicle raises constructive possession', byId.possession.citations[0]?.matchedOn)
  : results.fail('STR-07', 'The possession theme did not surface');

byId.mistaken_identification?.status === 'supported'
  ? results.pass('STR-08', 'A distant sighting in poor lighting raises mistaken identification', byId.mistaken_identification.citations[0]?.matchedOn)
  : results.fail('STR-08', 'The mistaken identification theme did not surface');

byId.chain_of_custody?.status === 'supported'
  ? results.pass('STR-09', 'Booking and transfer language raises chain of custody', byId.chain_of_custody.citations[0]?.matchedOn)
  : results.fail('STR-09', 'The chain of custody theme did not surface');

// Every citation must be a passage that is genuinely in the document.
const allCitations = supported.flatMap((t) => t.citations);
const fabricated = allCitations.filter((c) => {
  const core = c.excerpt.replace(/^…|…$/g, '').slice(0, 60).trim();
  return core.length > 20 && !report.replace(/\s+/g, ' ').includes(core.replace(/\s+/g, ' '));
});
fabricated.length === 0
  ? results.pass('STR-10', 'Every quoted passage appears in the document it is attributed to', `${allCitations.length} passages checked against the source`)
  : results.fail('STR-10', 'A quoted passage is not in the document', fabricated[0].excerpt.slice(0, 120));

allCitations.every((c) => c.fileName && c.evidenceId)
  ? results.pass('STR-11', 'Every passage names the document it came from', allCitations[0]?.fileName)
  : results.fail('STR-11', 'A passage has no source document');

// A theme with nothing behind it is reported, not omitted.
const unsupported = (themes.json?.themes ?? []).filter((t) => t.status === 'unsupported');
unsupported.length > 0 && unsupported.every((t) => /not a conclusion that the theme is unavailable/i.test(t.basis))
  ? results.pass(
      'STR-12',
      'A theme with nothing in the record is reported as such, not as unavailable',
      unsupported[0].basis.slice(0, 120),
    )
  : results.fail('STR-12', 'Unsupported themes are omitted or overstated', String(unsupported[0]?.basis).slice(0, 140));

// What is missing must be named where a theme is live.
byId.fourth_amendment?.missing?.length > 0
  ? results.pass('STR-13', 'What is commonly needed and absent is named', byId.fourth_amendment.missing.join('; ').slice(0, 120))
  : results.fail('STR-13', 'Missing material is not identified');

byId.fourth_amendment?.openQuestions?.length > 0
  ? results.pass('STR-14', 'Unanswered questions are stated rather than resolved', byId.fourth_amendment.openQuestions[0])
  : results.fail('STR-14', 'No open questions are raised');

// ---------------------------------------------------------------------------
// The constitution: organise, never conclude
// ---------------------------------------------------------------------------

const wholeBody = JSON.stringify(themes.json);
const forbidden = [
  /\bshould (?:file|be filed)\b/i,
  /\bwe recommend (?:filing|that you)\b/i,
  /\blikely to (?:succeed|prevail|win)\b/i,
  /\bis (?:guilty|innocent|not guilty)\b/i,
  /\bwill be acquitted\b/i,
  /\baccept the plea\b/i,
  /\bstrong defen[cs]e\b/i,
];
const violations = forbidden.filter((p) => p.test(wholeBody));
violations.length === 0
  ? results.pass(
      'STR-15',
      'The workspace states no conclusion about guilt, merits or outcome',
      'no advisory or predictive language in the response',
    )
  : results.fail('STR-15', 'The workspace stated a conclusion', violations.map((v) => v.source).join(', '));

/organise[s]? what is in the record/i.test(themes.json?.caveat ?? '') && /judgement for counsel/i.test(themes.json?.caveat ?? '')
  ? results.pass('STR-16', 'The workspace says plainly that the judgement is counsel\u2019s', themes.json.caveat.slice(0, 110))
  : results.fail('STR-16', 'The workspace does not disclaim the judgement', String(themes.json?.caveat).slice(0, 140));

// ---------------------------------------------------------------------------
// Motion intelligence
// ---------------------------------------------------------------------------

const motions = await req('GET', `/api/cases/${caseId}/motion-issues`, { token, timeoutMs: 120000 });
if (motions.status !== 200) {
  results.fail('STR-17', 'Motion intelligence could not be read', `HTTP ${motions.status}`);
} else {
  motions.json.issues.length > 0
    ? results.pass('STR-17', 'Motion issues are raised from the record', motions.json.issues.map((i) => i.topic).join(', '))
    : results.fail('STR-17', 'No motion issue was raised from a report raising several');

  motions.json.issues.every((i) => i.statement === 'This repository-backed issue may warrant attorney review.')
    ? results.pass(
        'STR-18',
        'Every issue uses the wording the constitution requires, never advice to file',
        motions.json.issues[0].statement,
      )
    : results.fail('STR-18', 'An issue was phrased as advice', JSON.stringify(motions.json.issues.map((i) => i.statement)).slice(0, 160));

  const motionBody = JSON.stringify(motions.json);
  !/\bshould (?:file|be filed)\b/i.test(motionBody) && !/\bmotion (?:is|would be) (?:strong|meritorious|likely)\b/i.test(motionBody)
    ? results.pass('STR-19', 'Motion intelligence never recommends filing or assesses merits')
    : results.fail('STR-19', 'Motion intelligence recommended filing or assessed merits');

  motions.json.issues.every((i) => i.supportingEvidence.length > 0)
    ? results.pass('STR-20', 'Every issue cites the passages that raised it', `${motions.json.issues.length} issues, all cited`)
    : results.fail('STR-20', 'An issue was raised with no supporting passage');

  motions.json.notRaised.length > 0
    ? results.pass('STR-21', 'Topics the record does not raise are listed so it is clear they were examined', `${motions.json.notRaised.length} not raised`)
    : results.warn('STR-21', 'Topics not raised are not reported');
}

// ---------------------------------------------------------------------------
// Executive summary — counted, never estimated
// ---------------------------------------------------------------------------

const exec = await req('GET', `/api/cases/${caseId}/executive-summary`, { token, timeoutMs: 120000 });
if (exec.status !== 200) {
  results.fail('STR-22', 'The executive summary could not be read', `HTTP ${exec.status}`);
} else {
  exec.json.evidence.total === 1 && exec.json.evidence.processed === 1
    ? results.pass('STR-22', 'Evidence figures are counted from the record', `${exec.json.evidence.total} item, ${exec.json.evidence.processed} processed`)
    : results.fail('STR-22', 'The evidence counts are wrong', JSON.stringify(exec.json.evidence));

  /No charging document has been filed/i.test(exec.json.charges.note ?? '')
    ? results.pass('STR-23', 'A case with no charges says so rather than showing a bare zero', exec.json.charges.note)
    : results.fail('STR-23', 'Absent charges are shown as a zero without explanation', JSON.stringify(exec.json.charges).slice(0, 140));

  /counted|nothing is estimated/i.test(exec.json.caveat ?? '')
    ? results.pass('STR-24', 'The executive summary states that its figures are counts, not estimates', exec.json.caveat.slice(0, 110))
    : results.fail('STR-24', 'The summary does not say where its figures come from');
}

// ---------------------------------------------------------------------------
// Action centre
// ---------------------------------------------------------------------------

const actions = await req('GET', '/api/action-center', { token });
if (actions.status !== 200) {
  results.fail('STR-25', 'The action centre could not be read', `HTTP ${actions.status}`);
} else {
  const noCharges = actions.json.items.find((i) => i.category === 'no_charges');
  noCharges
    ? results.pass('STR-25', 'The action centre reports real outstanding work', noCharges.title)
    : results.fail('STR-25', 'The action centre missed a case with no charging document', JSON.stringify(actions.json.counts));

  actions.json.items.every((i) => i.detail && i.detail.length > 20)
    ? results.pass('STR-26', 'Every queue entry explains why it is there', actions.json.items[0].detail.slice(0, 110))
    : results.fail('STR-26', 'A queue entry has no explanation');

  actions.json.items.every((i) => i.caseId === null || i.href)
    ? results.pass('STR-27', 'Every queue entry links to the record it is about', `${actions.json.items.length} entries`)
    : results.fail('STR-27', 'A queue entry links nowhere');

  const bodies = JSON.stringify(actions.json);
  !/People v\. Smith|2024-CF-001234|hours ago/i.test(bodies)
    ? results.pass('STR-28', 'The queue contains no invented cases, numbers or timestamps', 'all entries derived from records')
    : results.fail('STR-28', 'Fabricated content is still present in the queue');
}

// ---------------------------------------------------------------------------
// Tenant isolation
// ---------------------------------------------------------------------------

const other = await registerUser({ prefix: 'strategy-other', defaultRole: 'attorney' });
const leak = await req('GET', `/api/cases/${caseId}/defense-themes`, { token: other.token });
leak.status === 404
  ? results.pass('STR-29', 'Defence strategy is not visible to another firm', 'HTTP 404')
  : results.fail('STR-29', 'Defence strategy leaked across firms', `HTTP ${leak.status}`);

const otherActions = await req('GET', '/api/action-center', { token: other.token });
otherActions.status === 200 && otherActions.json.items.every((i) => i.caseId !== caseId)
  ? results.pass('STR-30', 'The action centre shows only the firm\u2019s own cases', `${otherActions.json.items.length} entries, none from another firm`)
  : results.fail('STR-30', 'The action centre leaked another firm\u2019s work');

await results.write({ caseId });
await prisma.$disconnect();
