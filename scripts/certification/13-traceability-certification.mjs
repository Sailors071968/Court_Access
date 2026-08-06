#!/usr/bin/env node
// Program 144, Phases 2 and 3 — evidence traceability.
//
// The constitution requires that every finding be traceable to its source and
// that every citation be verifiable. This suite checks both directions:
//
//   forward  — a citation the platform issues must name a page and line whose
//              text really is what the platform says it is
//   backward — every finding the platform holds must name a document that
//              exists in the case, and quote text that really appears in it
//
// It also checks the negative cases: a passage that is not in the document
// must not receive a citation, and removing a document must remove the
// findings that were derived from it.

import { readFile } from 'node:fs/promises';
import { Results, req, registerUser, login, API, exercisedApiRoutes } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('TRACEABILITY_CERTIFICATION', 'Program 144 — Evidence Traceability');
const FIXTURES = '/tmp/courtaccess-fixtures';

const expected = JSON.parse(await readFile(`${FIXTURES}/citation-transcript.expected.json`, 'utf8'));

const attorney = await registerUser({ prefix: 'trace', defaultRole: 'attorney' });
const session = await login(attorney.email, attorney.password);
const token = session.token;

const created = await req('POST', '/api/cases', {
  token,
  body: {
    title: 'People v. Doe — traceability certification',
    caseNumber: `TRACE-${Date.now()}`,
    jurisdiction: 'Alameda County',
    caseType: 'felony',
  },
});
const caseId = created.json.case.caseId;

await req('POST', '/api/charges', {
  token,
  body: { caseId, code: 'PC', section: '245(a)(1)', title: 'Assault with a deadly weapon', victim: 'Unidentified male' },
});

async function upload(file, type, mime, name = file) {
  const form = new FormData();
  form.append('caseId', caseId);
  form.append('evidenceType', type);
  form.append('file', new Blob([await readFile(`${FIXTURES}/${file}`)], { type: mime }), name);
  exercisedApiRoutes.add('POST /api/evidence/upload');
  const res = await fetch(`${API}/api/evidence/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  return json.evidence?.evidenceId;
}

const transcriptId = await upload('citation-transcript.pdf', 'transcript', 'application/pdf');
await new Promise((r) => setTimeout(r, 4000));

console.log(`case ${caseId}, transcript ${transcriptId}\n`);

// ---------------------------------------------------------------------------
// Page indexing
// ---------------------------------------------------------------------------

const pagesRes = await req('GET', `/api/evidence/${transcriptId}/pages`, { token });
if (pagesRes.status !== 200) {
  results.fail('TRACE-01', 'Page boundaries were not recorded for the transcript', `HTTP ${pagesRes.status}: ${(pagesRes.text || '').slice(0, 200)}`);
} else if (pagesRes.json.pageCount !== expected.pages) {
  results.fail(
    'TRACE-01',
    'Recorded page count does not match the document',
    `platform reports ${pagesRes.json.pageCount}, the PDF has ${expected.pages}`,
  );
} else {
  results.pass(
    'TRACE-01',
    'Every page of the document is indexed',
    `${pagesRes.json.pageCount} pages, matching the source`,
    { pages: pagesRes.json.pages },
  );
}

// ---------------------------------------------------------------------------
// Forward: a citation must be correct
// ---------------------------------------------------------------------------

const citationChecks = [];
for (const sentinel of expected.sentinels) {
  const res = await req('GET', `/api/evidence/${transcriptId}/citation?quote=${encodeURIComponent(sentinel.marker)}`, { token });
  if (res.status !== 200) {
    citationChecks.push({ ...sentinel, ok: false, why: `HTTP ${res.status}` });
    continue;
  }
  const c = res.json.citation;
  const pageOk = c.page === sentinel.page;
  // The sentinel text must actually be on the line the platform names.
  const lineOk = String(c.lineText || '').includes(sentinel.marker);
  citationChecks.push({
    ...sentinel,
    ok: pageOk && lineOk,
    reportedPage: c.page,
    reportedLine: c.line,
    lineText: c.lineText,
    formatted: res.json.formatted,
    why: pageOk ? (lineOk ? '' : 'cited line does not contain the passage') : `cited page ${c.page}, expected ${sentinel.page}`,
  });
}

const badCitations = citationChecks.filter((c) => !c.ok);
badCitations.length === 0
  ? results.pass(
      'TRACE-02',
      'Every citation names the page and line the passage really is on',
      `${citationChecks.length} passages checked across ${expected.pages} pages; e.g. "${citationChecks[0]?.formatted}"`,
      { checks: citationChecks },
    )
  : results.fail(
      'TRACE-02',
      'Citations do not match the document',
      badCitations.map((c) => `${c.marker}: ${c.why}`).join('; ').slice(0, 300),
      { bad: badCitations },
    );

// ---------------------------------------------------------------------------
// Negative: a passage that is not in the document must get no citation
// ---------------------------------------------------------------------------

const invented = 'The defendant confessed to the offence in the presence of two officers';
const inventedRes = await req('GET', `/api/evidence/${transcriptId}/citation?quote=${encodeURIComponent(invented)}`, { token });
inventedRes.status === 404
  ? results.pass(
      'TRACE-03',
      'A passage that is not in the document receives no citation',
      `HTTP 404: ${inventedRes.json?.message?.slice(0, 120)}`,
    )
  : results.fail(
      'TRACE-03',
      'FABRICATION: a citation was issued for text not present in the document',
      `HTTP ${inventedRes.status}: ${(inventedRes.text || '').slice(0, 220)}`,
    );

// An offset past the end of the document must not resolve either.
const overRes = await req('GET', `/api/evidence/${transcriptId}/citation?offset=99999999`, { token });
overRes.status === 404
  ? results.pass('TRACE-04', 'An offset beyond the document does not resolve to a page')
  : results.fail('TRACE-04', 'An out-of-range offset produced a citation', `HTTP ${overRes.status}`);

// ---------------------------------------------------------------------------
// Backward: every stored finding must be traceable to its document
// ---------------------------------------------------------------------------

// A use-of-force supplement gives the extractor something it recognises.
const UOF = `OAKLAND POLICE DEPARTMENT - USE OF FORCE SUPPLEMENT
Report Number: 26-114872   Date: 03/14/2026

22:47 Officers approached the subject on foot.
22:48 I gave the verbal command "show me your hands" twice.
22:49 Subject fled and a foot pursuit began westbound.
22:50 I drew my weapon and issued a last warning before deploying the taser.
22:51 The taser was deployed and the subject was taken to the ground.
22:52 A control hold was applied and the subject was handcuffed.
22:55 I read the Miranda warning to the subject.
`;

const uofForm = new FormData();
uofForm.append('caseId', caseId);
uofForm.append('evidenceType', 'police_report');
uofForm.append('file', new Blob([Buffer.from(UOF)], { type: 'text/plain' }), 'use-of-force-supplement.txt');
exercisedApiRoutes.add('POST /api/evidence/upload');
const uofRes = await fetch(`${API}/api/evidence/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: uofForm,
});
const uofId = (await uofRes.json().catch(() => ({}))).evidence?.evidenceId;
await new Promise((r) => setTimeout(r, 3000));

// Build the timeline so there are findings to trace.
const rebuild = await req('POST', `/api/timeline/rebuild/${caseId}`, { token, body: {} });
const jobId = rebuild.json?.processingJobId;
const deadline = Date.now() + 120000;
while (Date.now() < deadline) {
  const job = await prisma.processingJob.findUnique({ where: { id: jobId } });
  if (job && ['completed', 'failed'].includes(job.status)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

const events = await prisma.evidenceEvent.findMany({ where: { caseId } });
const caseEvidence = await prisma.evidence.findMany({
  where: { caseId },
  select: { evidenceId: true, fileName: true },
});
const evidenceIds = new Set(caseEvidence.map((e) => e.evidenceId));

// Reassemble each document's indexed text so quoted findings can be checked.
const textByEvidence = new Map();
for (const e of caseEvidence) {
  const chunks = await prisma.evidenceChunk.findMany({
    where: { evidenceId: e.evidenceId },
    orderBy: { chunkIndex: 'asc' },
    select: { text: true },
  });
  textByEvidence.set(e.evidenceId, chunks.map((c) => c.text).join(''));
}

if (events.length === 0) {
  results.fail('TRACE-05', 'No findings were produced to trace', 'the extractor returned no events for the uploaded discovery');
} else {
  const orphaned = events.filter((e) => !e.sourceEvidence || !evidenceIds.has(e.sourceEvidence));
  orphaned.length === 0
    ? results.pass(
        'TRACE-05',
        'Every finding names a document that exists in the case',
        `${events.length} events checked against ${caseEvidence.length} documents`,
      )
    : results.fail(
        'TRACE-05',
        'Findings reference documents that are not in the case',
        `${orphaned.length} of ${events.length}: ${orphaned.slice(0, 3).map((o) => o.sourceEvidence).join(', ')}`,
        { orphaned: orphaned.slice(0, 5).map((o) => ({ eventId: o.eventId, sourceEvidence: o.sourceEvidence })) },
      );

  // Every quoted passage must appear verbatim in the document it cites.
  const misquoted = events.filter((e) => {
    if (!e.rawText) return false;
    const source = textByEvidence.get(e.sourceEvidence) ?? '';
    return !source.includes(e.rawText.trim());
  });
  misquoted.length === 0
    ? results.pass(
        'TRACE-06',
        'Every quoted passage appears verbatim in the document it cites',
        `${events.filter((e) => e.rawText).length} quotations verified against the indexed source`,
      )
    : results.fail(
        'TRACE-06',
        'FABRICATION: findings quote text that is not in the cited document',
        misquoted.slice(0, 3).map((m) => `"${m.rawText?.slice(0, 60)}"`).join('; '),
        { misquoted: misquoted.slice(0, 5).map((m) => ({ eventId: m.eventId, rawText: m.rawText, source: m.sourceEvidence })) },
      );

  // Every finding must carry a timestamp it can be placed on.
  const undated = events.filter((e) => !e.timestamp);
  undated.length === 0
    ? results.pass('TRACE-07', 'Every finding carries the time it is placed at', `${events.length} events`)
    : results.warn('TRACE-07', 'Some findings carry no timestamp', `${undated.length} of ${events.length}`);
}

// ---------------------------------------------------------------------------
// Phantom findings: removing a document must remove what came from it
// ---------------------------------------------------------------------------

const beforeCount = await prisma.evidenceEvent.count({ where: { caseId, sourceEvidence: uofId } });
const del = await req('DELETE', `/api/evidence/${uofId}`, { token });

if (del.status >= 200 && del.status < 300) {
  // Re-derive: the findings from the removed document must not survive.
  const reRebuild = await req('POST', `/api/timeline/rebuild/${caseId}`, { token, body: {} });
  const reJobId = reRebuild.json?.processingJobId;
  const reDeadline = Date.now() + 120000;
  while (Date.now() < reDeadline) {
    const job = await prisma.processingJob.findUnique({ where: { id: reJobId } });
    if (job && ['completed', 'failed'].includes(job.status)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  const afterCount = await prisma.evidenceEvent.count({ where: { caseId, sourceEvidence: uofId } });
  const survivingTimeline = await prisma.timelineEvent.count({ where: { caseId, sourceDoc: 'use-of-force-supplement.txt' } });

  afterCount === 0 && survivingTimeline === 0
    ? results.pass(
        'TRACE-08',
        'Removing a document removes the findings derived from it',
        `${beforeCount} findings before deletion, none afterwards`,
      )
    : results.fail(
        'TRACE-08',
        'Findings survived the removal of the document they came from',
        `${afterCount} evidence events and ${survivingTimeline} timeline events still cite the deleted document`,
        { beforeCount, afterCount, survivingTimeline },
      );
} else {
  results.fail('TRACE-08', 'Could not delete the document to test finding removal', `HTTP ${del.status}`);
}

// ---------------------------------------------------------------------------
// A citation may not be issued for another firm's document
// ---------------------------------------------------------------------------

const outsider = await registerUser({ prefix: 'trace-outsider', defaultRole: 'attorney' });
const outsiderCite = await req('GET', `/api/evidence/${transcriptId}/citation?quote=UNIQUEMARK0107`, { token: outsider.token });
outsiderCite.status === 403 || outsiderCite.status === 404
  ? results.pass('TRACE-09', "Citations are not issued against another firm's document", `HTTP ${outsiderCite.status}`)
  : results.fail('TRACE-09', "A citation was issued against another firm's document", `HTTP ${outsiderCite.status}`);

await results.write({
  caseId,
  transcriptId,
  expectedPages: expected.pages,
  citationChecks,
  findingsTraced: events.length,
});
await prisma.$disconnect();
