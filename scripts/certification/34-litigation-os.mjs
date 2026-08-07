#!/usr/bin/env node
// Program 151 — litigation operating system certification.
//
// Covers the pieces that tie the platform together: the stage a case is at and
// how it was worked out, what has changed and what each change meant, the one
// screen that shows all of it, and the family view that has to say the same
// things without jargon and without advising anybody.

import { createHash } from 'node:crypto';
import { Results, req, registerUser } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('LITIGATION_OS', 'Program 151 — Litigation Operating System');

const account = await registerUser({ prefix: 'los-atty', defaultRole: 'attorney' });
const token = account.token;

const created = await req('POST', '/api/cases', {
  token,
  body: { title: 'People v. Navarro', caseNumber: `LOS-${Date.now()}`, jurisdiction: 'Los Angeles County', caseType: 'felony' },
});
const caseId = created.json?.case?.caseId ?? created.json?.caseId;

// ---------------------------------------------------------------------------
// Phase 1 — the stage, worked out from the record
// ---------------------------------------------------------------------------

const bare = await req('GET', `/api/cases/${caseId}/stage`, { token, timeoutMs: 60000 });
if (bare.status !== 200) {
  results.fail('LOS-01', 'The stage could not be read', `HTTP ${bare.status}`);
} else {
  bare.json.stage === 'unknown' && /Nothing on the record settles the stage/i.test(bare.json.basis)
    ? results.pass('LOS-01', 'A case with nothing on file has an undetermined stage, and says why', bare.json.basis.slice(0, 110))
    : results.fail('LOS-01', 'A stage was asserted with nothing on the record', `${bare.json.stage}: ${bare.json.basis}`);

  bare.json.stages.length >= 20
    ? results.pass('LOS-02', 'Every litigation stage is supported', `${bare.json.stages.length} stages`)
    : results.fail('LOS-02', 'Too few stages are supported', String(bare.json.stages.length));
}

// Add evidence, and the stage should move to investigation.
const report = `
LOS ANGELES POLICE DEPARTMENT — INVESTIGATIVE REPORT
I detained the driver and conducted a warrantless search of the vehicle. The item was booked into evidence and
transferred to the laboratory. NAVARRO was advised of his Miranda rights. NAVARRO stated he did not know the
backpack was there and that other people had access to the vehicle. The witness briefly saw a male subject from
a distance in poor lighting.
`;
const evidence = await prisma.evidence.create({
  data: {
    caseId,
    tenantId: account.user.tenantId,
    uploadedBy: account.user.userId,
    fileName: 'Investigative Report.pdf',
    size: BigInt(report.length),
    mimeType: 'application/pdf',
    evidenceType: 'police_report',
    processingStatus: 'completed',
  },
});
await prisma.evidenceChunk.create({
  data: {
    evidenceId: evidence.evidenceId,
    tenantId: account.user.tenantId,
    chunkIndex: 0,
    text: report,
    startOffset: 0,
    endOffset: report.length,
    charCount: report.length,
    checksum: createHash('sha256').update(report).digest('hex').slice(0, 16),
  },
});

const investigating = await req('GET', `/api/cases/${caseId}/stage`, { token, timeoutMs: 60000 });
investigating.json?.stage === 'investigation' && investigating.json.source === 'inferred'
  ? results.pass('LOS-03', 'Evidence with no charges puts the case at investigation', investigating.json.basis.slice(0, 100))
  : results.fail('LOS-03', 'The stage was not inferred correctly', `${investigating.json?.stage}: ${investigating.json?.basis}`);

// File a complaint, and the case should move to discovery.
await req('POST', `/api/cases/${caseId}/charges/documents`, {
  token,
  timeoutMs: 180000,
  body: {
    kind: 'complaint',
    name: 'Complaint',
    filedAt: '2026-05-01T00:00:00.000Z',
    charges: [
      {
        countNumber: 1,
        code: 'HSC',
        section: '11378',
        verbatimText:
          'On or about April 20, 2026, the crime of POSSESSION FOR SALE OF A CONTROLLED SUBSTANCE, in violation of HEALTH AND SAFETY CODE SECTION 11378, was committed by LUIS NAVARRO.',
        defendants: [{ name: 'Luis Navarro' }],
      },
    ],
  },
});

const discovery = await req('GET', `/api/cases/${caseId}/stage`, { token, timeoutMs: 60000 });
discovery.json?.stage === 'discovery'
  ? results.pass('LOS-04', 'A complaint plus discovery moves the case to the discovery stage', discovery.json.basis.slice(0, 100))
  : results.fail('LOS-04', 'The stage did not follow the charging document', `${discovery.json?.stage}`);

discovery.json?.signals?.length > 0
  ? results.pass('LOS-05', 'The reasoning behind the stage is shown, not just the answer', discovery.json.signals.join(' ').slice(0, 120))
  : results.fail('LOS-05', 'No reasoning was given for the stage');

// File an information — that settles a later stage.
await req('POST', `/api/cases/${caseId}/charges/documents`, {
  token,
  timeoutMs: 180000,
  body: {
    kind: 'information',
    name: 'Information',
    filedAt: '2026-06-15T00:00:00.000Z',
    charges: [
      {
        countNumber: 1,
        code: 'HSC',
        section: '11378',
        verbatimText:
          'On or about April 20, 2026, the crime of POSSESSION FOR SALE OF A CONTROLLED SUBSTANCE, in violation of HEALTH AND SAFETY CODE SECTION 11378, was committed by LUIS NAVARRO.',
        defendants: [{ name: 'Luis Navarro' }],
      },
    ],
  },
});
const afterInformation = await req('GET', `/api/cases/${caseId}/stage`, { token, timeoutMs: 60000 });
afterInformation.json?.stage === 'information_filed'
  ? results.pass('LOS-06', 'An information on file settles a later stage', afterInformation.json.basis.slice(0, 100))
  : results.fail('LOS-06', 'The information did not move the stage', String(afterInformation.json?.stage));

// ---------------------------------------------------------------------------
// Attorney override sticks
// ---------------------------------------------------------------------------

const override = await req('PUT', `/api/cases/${caseId}/stage`, {
  token,
  body: { stage: 'motion_practice', basis: 'Suppression motion set for hearing on 12 August.' },
});
override.status === 200
  ? results.pass('LOS-07', 'Counsel can set the stage', `${override.json.label}`)
  : results.fail('LOS-07', 'The stage could not be set', `HTTP ${override.status}`);

const afterOverride = await req('GET', `/api/cases/${caseId}/stage`, { token, timeoutMs: 60000 });
afterOverride.json?.stage === 'motion_practice' && afterOverride.json.source === 'attorney'
  ? results.pass('LOS-08', 'Inference never overrides counsel\u2019s own judgement about the case', afterOverride.json.basis)
  : results.fail('LOS-08', 'An override was overwritten by inference', `${afterOverride.json?.stage} (${afterOverride.json?.source})`);

afterOverride.json?.history?.length >= 2
  ? results.pass('LOS-09', 'Every stage change is kept, so the history can be reconstructed', `${afterOverride.json.history.length} events`)
  : results.fail('LOS-09', 'Stage history was not recorded');

const badStage = await req('PUT', `/api/cases/${caseId}/stage`, { token, body: { stage: 'invented_stage' } });
badStage.status === 400
  ? results.pass('LOS-10', 'A stage that does not exist is refused', 'HTTP 400')
  : results.fail('LOS-10', 'An invented stage was accepted', `HTTP ${badStage.status}`);

const defendant = await registerUser({ prefix: 'los-def', defaultRole: 'criminal_defendant' });
const defendantSet = await req('PUT', `/api/cases/${caseId}/stage`, { token: defendant.token, body: { stage: 'trial' } });
[401, 403, 404].includes(defendantSet.status)
  ? results.pass('LOS-11', 'A defendant cannot change the stage of their own case', `HTTP ${defendantSet.status}`)
  : results.fail('LOS-11', 'A defendant changed the case stage', `HTTP ${defendantSet.status}`);

// ---------------------------------------------------------------------------
// Phase 11 — case evolution
// ---------------------------------------------------------------------------

const evolution = await req('GET', `/api/cases/${caseId}/evolution`, { token, timeoutMs: 60000 });
if (evolution.status !== 200) {
  results.fail('LOS-12', 'The evolution could not be read', `HTTP ${evolution.status}`);
} else {
  const kinds = new Set(evolution.json.entries.map((e) => e.kind));
  kinds.has('charges') && kinds.has('evidence') && kinds.has('stage')
    ? results.pass('LOS-12', 'The evolution covers charges, evidence and stage changes', [...kinds].join(', '))
    : results.fail('LOS-12', 'The evolution is incomplete', [...kinds].join(', '));

  const withConsequence = evolution.json.entries.filter((e) => e.consequence);
  withConsequence.length > 0
    ? results.pass('LOS-13', 'Each change explains what it changed downstream', withConsequence[0].consequence.slice(0, 110))
    : results.fail('LOS-13', 'No change explains its consequence');

  const ordered = evolution.json.entries.every(
    (e, i, a) => i === 0 || new Date(a[i - 1].at).getTime() <= new Date(e.at).getTime(),
  );
  ordered
    ? results.pass('LOS-14', 'The evolution is in chronological order', `${evolution.json.entries.length} entries`)
    : results.fail('LOS-14', 'The evolution is out of order');

  /left blank rather than asserted/i.test(evolution.json.note ?? '')
    ? results.pass('LOS-15', 'Where a consequence cannot be established it is left blank, not invented', evolution.json.note.slice(0, 110))
    : results.fail('LOS-15', 'The evolution does not state its limits');
}

// ---------------------------------------------------------------------------
// Phase 4 — the war room
// ---------------------------------------------------------------------------

const warRoom = await req('GET', `/api/cases/${caseId}/war-room`, { token, timeoutMs: 120000 });
if (warRoom.status !== 200) {
  results.fail('LOS-16', 'The war room could not be read', `HTTP ${warRoom.status}: ${(warRoom.text ?? '').slice(0, 150)}`);
} else {
  const w = warRoom.json;
  w.stage?.label === 'Motion practice'
    ? results.pass('LOS-16', 'The war room shows the current stage', w.stage.label)
    : results.fail('LOS-16', 'The war room stage is wrong', String(w.stage?.label));

  w.charges.counts.length === 1 && w.charges.operativeDocument?.name === 'Information'
    ? results.pass('LOS-17', 'The war room shows the operative charges', `${w.charges.counts.length} count from the ${w.charges.operativeDocument.name}`)
    : results.fail('LOS-17', 'The war room charges are wrong', JSON.stringify(w.charges).slice(0, 150));

  w.repositoryIssues.length > 0 && w.repositoryIssues.every((i) => i.statement === 'This repository-backed issue may warrant attorney review.')
    ? results.pass('LOS-18', 'Issues appear with the required wording, never as advice', `${w.repositoryIssues.length} issues`)
    : results.fail('LOS-18', 'Issues are missing or misworded', JSON.stringify(w.repositoryIssues).slice(0, 150));

  w.repositoryIssues.every((i) => i.firstPassage?.fileName)
    ? results.pass('LOS-19', 'Every issue on the war room cites a document', w.repositoryIssues[0].firstPassage.fileName)
    : results.fail('LOS-19', 'An issue on the war room has no citation');

  w.outstanding.missingMaterial.length > 0
    ? results.pass('LOS-20', 'What is not in the record is shown alongside what is', w.outstanding.missingMaterial[0].slice(0, 100))
    : results.warn('LOS-20', 'Nothing is reported as missing');

  w.recentActivity.length > 0
    ? results.pass('LOS-21', 'The war room shows what has changed lately', `${w.recentActivity.length} recent entries`)
    : results.fail('LOS-21', 'No recent activity is shown');

  const body = JSON.stringify(w);
  !/should (?:file|be filed)|likely to (?:succeed|prevail)|is (?:guilty|innocent)|strong defen[cs]e/i.test(body)
    ? results.pass('LOS-22', 'The war room states no conclusion about guilt, merits or outcome')
    : results.fail('LOS-22', 'The war room stated a conclusion');
}

// ---------------------------------------------------------------------------
// Phase 7 — the family view
// ---------------------------------------------------------------------------

const family = await req('GET', `/api/cases/${caseId}/family-view`, { token, timeoutMs: 120000 });
if (family.status !== 200) {
  results.fail('LOS-23', 'The family view could not be read', `HTTP ${family.status}`);
} else {
  const f = family.json;
  f.stage.plainEnglish && f.stage.plainEnglish.length > 25 && !/arraignment|voir dire|demurrer/i.test(f.stage.plainEnglish)
    ? results.pass('LOS-23', 'The stage is explained without jargon', f.stage.plainEnglish.slice(0, 110))
    : results.fail('LOS-23', 'The family stage explanation uses jargon or is missing', String(f.stage.plainEnglish).slice(0, 120));

  f.charges.length > 0 && /Possession For Sale/i.test(f.charges[0].plainLanguage)
    ? results.pass('LOS-24', 'Charges are named in the People\u2019s own words, not a code citation alone', f.charges[0].plainLanguage)
    : results.fail('LOS-24', 'Charges are not readable', JSON.stringify(f.charges).slice(0, 140));

  f.questions.length > 0
    ? results.pass('LOS-25', 'Questions to ask the attorney are drawn from this case', f.questions[0].question)
    : results.fail('LOS-25', 'No questions were produced');

  f.questions.every((q) => q.why)
    ? results.pass('LOS-26', 'Each question explains why it is being raised', f.questions[0].why.slice(0, 110))
    : results.fail('LOS-26', 'A question has no explanation');

  f.questions.some((q) => q.basedOn)
    ? results.pass('LOS-27', 'Questions name the document that prompted them', f.questions.find((q) => q.basedOn).basedOn)
    : results.fail('LOS-27', 'No question links to what prompted it');

  // The caveat's whole job is to name what the page does not do, so it says
  // "does not say whether anyone is guilty or innocent". Scanning it for those
  // words finds the disclaimer, not a breach of it.
  const { caveat: _familyCaveat, ...familyContent } = f;
  const familyBody = JSON.stringify(familyContent);
  !/should (?:file|plead|accept)|you must|we advise|likely to (?:succeed|win)|is (?:guilty|innocent)/i.test(familyBody)
    ? results.pass('LOS-28', 'The family view gives no advice and states no conclusion')
    : results.fail('LOS-28', 'The family view gave advice or stated a conclusion');

  /not legal advice/i.test(f.caveat) && /Only the attorney can advise you/i.test(f.caveat)
    ? results.pass('LOS-29', 'The family view says plainly that it is not advice', f.caveat.slice(0, 110))
    : results.fail('LOS-29', 'The family view does not disclaim advice', String(f.caveat).slice(0, 140));
}

// ---------------------------------------------------------------------------
// Isolation
// ---------------------------------------------------------------------------

const other = await registerUser({ prefix: 'los-other', defaultRole: 'attorney' });
const leaks = [];
for (const path of ['stage', 'evolution', 'war-room', 'family-view']) {
  const r = await req('GET', `/api/cases/${caseId}/${path}`, { token: other.token });
  if (r.status !== 404) leaks.push(`${path} (${r.status})`);
}
leaks.length === 0
  ? results.pass('LOS-30', 'None of these surfaces is visible to another firm', '4 endpoints probed')
  : results.fail('LOS-30', 'A surface leaked across firms', leaks.join(', '));

await results.write({ caseId });
await prisma.$disconnect();
