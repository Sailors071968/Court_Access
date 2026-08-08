#!/usr/bin/env node
// Program 149 — charge lifecycle certification.
//
// Covers the working life of a charging document: drafted, reviewed, filed;
// duplicated into an amendment; corrected by hand with every correction
// recorded; parsed out of an uploaded document with its confidence stated; and
// locked once the case relies on it.

import { Results, req, registerUser } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('CHARGE_LIFECYCLE', 'Program 149 — Charge Lifecycle');

const account = await registerUser({ prefix: 'lifecycle-atty', defaultRole: 'attorney' });
const token = account.token;

const created = await req('POST', '/api/cases', {
  token,
  body: { title: 'People v. Vasquez', caseNumber: `LIFE-${Date.now()}`, jurisdiction: 'Los Angeles County', caseType: 'felony' },
});
const caseId = created.json?.case?.caseId ?? created.json?.caseId;

// ---------------------------------------------------------------------------
// Phase 1 — draft, add counts, preview, finalise
// ---------------------------------------------------------------------------

const draft = await req('POST', `/api/cases/${caseId}/charges/drafts`, {
  token,
  body: {
    kind: 'complaint',
    name: 'Complaint',
    filedAt: '2026-01-15T00:00:00.000Z',
    court: 'Superior Court of California, County of Los Angeles',
    courtCaseNumber: 'BA555111',
  },
});
const draftId = draft.json?.document?.chargingDocumentId;

draft.status === 201 && draft.json.document.status === 'draft'
  ? results.pass('LIF-01', 'A charging document can be started as a draft', `${draft.json.document.name} (draft)`)
  : results.fail('LIF-01', 'A draft could not be started', `HTTP ${draft.status}: ${(draft.text ?? '').slice(0, 160)}`);

// A draft is not operative: the case has no current charges yet.
const beforeFiling = await req('GET', `/api/cases/${caseId}/charges/current`, { token });
!beforeFiling.json.operativeDocument
  ? results.pass('LIF-02', 'A draft does not become the current charges until it is filed', 'no operative document while drafting')
  : results.fail('LIF-02', 'A draft was treated as operative', beforeFiling.json.operativeDocument?.name);

// Filing nothing is refused.
const emptyFile = await req('POST', `/api/charging/documents/${draftId}/finalize`, { token });
emptyFile.status === 422
  ? results.pass('LIF-03', 'A document with no counts cannot be filed', emptyFile.json.message.slice(0, 100))
  : results.fail('LIF-03', 'An empty document was filed', `HTTP ${emptyFile.status}`);

// Add counts, with the allegations a real complaint pleads.
const count1 = await req('POST', `/api/charging/documents/${draftId}/counts`, {
  token,
  timeoutMs: 120000,
  body: {
    countNumber: 1,
    code: 'PEN',
    section: '245',
    subdivision: '(a)(4)',
    verbatimText:
      'On or about January 2, 2026, the crime of ASSAULT BY MEANS OF FORCE LIKELY TO PRODUCE GREAT BODILY INJURY, in violation of PENAL CODE SECTION 245(a)(4), a Felony, was committed by ANA VASQUEZ.',
    seriousFelony: true,
    strikeAllegation: true,
    greatBodilyInjury: true,
    enhancements: ['PC 12022.7(a) — personally inflicted great bodily injury'],
    priorConvictions: ['PC 459 conviction, 2019, Los Angeles County'],
    maximumExposure: 'Seven years in state prison as pleaded',
    defendants: [{ name: 'Ana Vasquez' }],
  },
});
const count2 = await req('POST', `/api/charging/documents/${draftId}/counts`, {
  token,
  timeoutMs: 120000,
  body: {
    countNumber: 2,
    code: 'HSC',
    section: '11378',
    verbatimText:
      'On or about January 2, 2026, the crime of POSSESSION FOR SALE OF A CONTROLLED SUBSTANCE, in violation of HEALTH AND SAFETY CODE SECTION 11378, was committed by ANA VASQUEZ and DAVID OKONKWO.',
    drugWeight: '112 grams of methamphetamine',
    defendants: [{ name: 'Ana Vasquez' }, { name: 'David Okonkwo' }],
  },
});

count1.status === 201 && count2.status === 201
  ? results.pass('LIF-04', 'Counts are added to a draft with the allegations the People plead', '2 counts')
  : results.fail('LIF-04', 'Counts could not be added', `${count1.status}, ${count2.status}`);

const finalize = await req('POST', `/api/charging/documents/${draftId}/finalize`, { token, timeoutMs: 120000 });
finalize.status === 200 && finalize.json.operativeChargesSynchronised === 2
  ? results.pass(
      'LIF-05',
      'Filing a draft makes it operative and drives the case analysis',
      `${finalize.json.operativeChargesSynchronised} counts synchronised`,
    )
  : results.fail('LIF-05', 'Filing did not take effect', `HTTP ${finalize.status}: ${(finalize.text ?? '').slice(0, 160)}`);

// ---------------------------------------------------------------------------
// Phase 3 — the attributes a count actually carries
// ---------------------------------------------------------------------------

const matrix = await req('GET', `/api/cases/${caseId}/charges/matrix`, { token });
if (matrix.status !== 200) {
  results.fail('LIF-06', 'The defendant matrix could not be read', `HTTP ${matrix.status}`);
} else {
  const m = matrix.json;
  m.defendants.length === 2 && m.defendants.includes('Ana Vasquez') && m.defendants.includes('David Okonkwo')
    ? results.pass('LIF-06', 'The matrix lists every defendant across the counts', m.defendants.join(', '))
    : results.fail('LIF-06', 'The matrix is missing defendants', JSON.stringify(m.defendants));

  const notCharged = m.cells.find((c) => c.state === 'not_charged');
  notCharged
    ? results.pass(
        'LIF-07',
        'A defendant not charged on a count is shown as not charged, not left blank',
        `${notCharged.defendant} is not charged on count ${notCharged.countNumber}`,
      )
    : results.fail('LIF-07', 'The matrix does not distinguish uncharged cells');

  m.jointCounts.includes(2)
    ? results.pass('LIF-08', 'Joint counts are identified as joint', `count(s) ${m.jointCounts.join(', ')}`)
    : results.fail('LIF-08', 'Joint counts are not identified', JSON.stringify(m.jointCounts));

  const first = m.counts.find((c) => c.countNumber === 1);
  const wanted = ['Serious felony', 'Strike allegation', 'Great bodily injury'];
  const missing = wanted.filter((w) => !first.allegations.includes(w));
  missing.length === 0
    ? results.pass('LIF-09', 'Allegations pleaded against a count are reported', first.allegations.join('; '))
    : results.fail('LIF-09', 'Allegations are missing', missing.join(', '));

  first.allegations.some((a) => a.startsWith('Prior conviction alleged'))
    ? results.pass('LIF-10', 'Prior convictions pleaded against a count are reported', first.allegations.find((a) => a.startsWith('Prior conviction')))
    : results.fail('LIF-10', 'Prior convictions are not reported');

  const second = m.counts.find((c) => c.countNumber === 2);
  second.allegations.some((a) => a.includes('112 grams'))
    ? results.pass('LIF-11', 'A drug weight allegation is reported as pleaded', second.allegations.find((a) => a.includes('grams')))
    : results.fail('LIF-11', 'The drug weight allegation is not reported');

  // Exposure is reported as pleaded, never computed.
  /as pleaded by the People/i.test(first.exposureNote)
    ? results.pass('LIF-12', 'Maximum exposure is reported as the People pleaded it', first.exposureNote.slice(0, 100))
    : results.fail('LIF-12', 'Exposure is not attributed to the pleading', first.exposureNote);

  /none has been calculated/i.test(second.exposureNote)
    ? results.pass(
        'LIF-13',
        'Where the People plead no exposure, none is calculated and the reason is given',
        second.exposureNote.slice(0, 110),
      )
    : results.fail('LIF-13', 'An exposure figure was produced without a pleading', second.exposureNote);
}

// ---------------------------------------------------------------------------
// Phase 8 — manual correction, audited
// ---------------------------------------------------------------------------

const current = await req('GET', `/api/cases/${caseId}/charges/current`, { token });
const firstCharge = current.json.charges.find((c) => c.countNumber === 1);

const edit = await req('PATCH', `/api/charging/counts/${firstCharge.filedChargeId}/edit`, {
  token,
  body: { subdivision: '(a)(1)', firearmAllegation: true },
});
edit.status === 200 && edit.json.changed === 2
  ? results.pass('LIF-14', 'An attorney can correct a count by hand', '2 fields changed')
  : results.fail('LIF-14', 'The correction failed', `HTTP ${edit.status}: ${(edit.text ?? '').slice(0, 160)}`);

const audit = await req('GET', `/api/cases/${caseId}/charges/audit`, { token });
const editEvents = (audit.json?.events ?? []).filter((e) => e.action === 'edited');
editEvents.length === 2
  ? results.pass(
      'LIF-15',
      'Every manual correction is recorded with the field, the values and the author',
      editEvents[0].description.slice(0, 110),
    )
  : results.fail('LIF-15', 'Corrections were not fully audited', `${editEvents.length} events`);

editEvents.every((e) => e.actorId && e.actorRole && e.occurredAt)
  ? results.pass('LIF-16', 'Each audit entry names who made the change and when', `${editEvents[0].actorRole} at ${editEvents[0].occurredAt}`)
  : results.fail('LIF-16', 'Audit entries are missing an author or a time');

const filedEvent = (audit.json?.events ?? []).find((e) => e.action === 'finalized');
filedEvent
  ? results.pass('LIF-17', 'Filing a document is itself audited', filedEvent.description.slice(0, 110))
  : results.fail('LIF-17', 'Filing was not audited');

// A field that is not an attorney's to change is refused.
const badEdit = await req('PATCH', `/api/charging/counts/${firstCharge.filedChargeId}/edit`, {
  token,
  body: { officialStatuteId: 'fabricated', caseId: 'other' },
});
badEdit.status === 400
  ? results.pass('LIF-18', 'Fields that are not an attorney\'s to change are refused', badEdit.json.message.slice(0, 100))
  : results.fail('LIF-18', 'An unrestricted field was editable', `HTTP ${badEdit.status}`);

// ---------------------------------------------------------------------------
// Phase 1 — duplicate a prior filing into an amendment
// ---------------------------------------------------------------------------

const duplicate = await req('POST', `/api/cases/${caseId}/charges/drafts`, {
  token,
  timeoutMs: 120000,
  body: {
    kind: 'amended_complaint',
    name: 'First Amended Complaint',
    filedAt: '2026-02-20T00:00:00.000Z',
    duplicateOf: draftId,
  },
});
const amendedId = duplicate.json?.document?.chargingDocumentId;

duplicate.status === 201 && duplicate.json.document.charges.length === 2
  ? results.pass('LIF-19', 'An amendment can be started from a prior filing, carrying its counts forward', '2 counts duplicated')
  : results.fail('LIF-19', 'Duplication failed', `HTTP ${duplicate.status}: ${(duplicate.text ?? '').slice(0, 160)}`);

const carried = duplicate.json?.document?.charges?.find((c) => c.countNumber === 1);
carried?.strikeAllegation === true && carried?.seriousFelony === true
  ? results.pass('LIF-20', 'Allegations carry forward with the count, so they need not be retyped', 'strike and serious felony carried')
  : results.fail('LIF-20', 'Allegations were lost in duplication', JSON.stringify(carried).slice(0, 150));

duplicate.json?.document?.status === 'draft'
  ? results.pass('LIF-21', 'A duplicated filing starts as a draft, so it can be edited before it takes effect', 'draft')
  : results.fail('LIF-21', 'A duplicate took effect immediately', duplicate.json?.document?.status);

// Amend it: drop the gang-free count's allegation and add one, then file.
const amendedCharge = duplicate.json.document.charges.find((c) => c.countNumber === 2);
await req('PATCH', `/api/charging/counts/${amendedCharge.filedChargeId}/edit`, {
  token,
  body: { gangAllegation: true },
});
const fileAmended = await req('POST', `/api/charging/documents/${amendedId}/finalize`, { token, timeoutMs: 120000 });
fileAmended.status === 200
  ? results.pass('LIF-22', 'The amendment is filed and becomes operative', `${fileAmended.json.operativeChargesSynchronised} counts`)
  : results.fail('LIF-22', 'The amendment could not be filed', `HTTP ${fileAmended.status}`);

// Phase 4 — the new allegation must be reported in words.
const timeline = await req('GET', `/api/cases/${caseId}/charges/timeline`, { token });
const amendChanges = timeline.json.timeline[1]?.changesFromPrevious ?? [];
const allegationChange = amendChanges.find((c) => c.type === 'allegation_added');
allegationChange
  ? results.pass('LIF-23', 'A newly pleaded allegation is reported in plain words', allegationChange.description)
  : results.fail('LIF-23', 'The new allegation was not detected', amendChanges.map((c) => c.type).join(', '));

// ---------------------------------------------------------------------------
// Phase 9 — locking
// ---------------------------------------------------------------------------

const addToLocked = await req('POST', `/api/charging/documents/${draftId}/counts`, {
  token,
  body: { countNumber: 9, code: 'PEN', section: '211', verbatimText: 'Fabricated count added after filing.' },
});
addToLocked.status === 409 && /litigation record/i.test(addToLocked.json?.message ?? '')
  ? results.pass('LIF-24', 'A filing the case relies on cannot be altered, and the refusal explains why', addToLocked.json.message.slice(0, 120))
  : results.fail('LIF-24', 'A locked filing was altered', `HTTP ${addToLocked.status}`);

const lockedDoc = await prisma.chargingDocument.findUnique({ where: { chargingDocumentId: draftId } });
lockedDoc?.lockedAt && lockedDoc.lockedReason
  ? results.pass('LIF-25', 'The lock records why the filing became part of the record', lockedDoc.lockedReason)
  : results.fail('LIF-25', 'The filing was not locked');

// ---------------------------------------------------------------------------
// Phase 7 — parsing an uploaded document
// ---------------------------------------------------------------------------

const complaintText = `
SUPERIOR COURT OF CALIFORNIA, COUNTY OF LOS ANGELES
CASE NO: BA778899

COUNT 1
On or about March 4, 2026, the crime of SECOND DEGREE ROBBERY, in violation of PENAL CODE SECTION 211, a Felony,
was committed by ANA VASQUEZ, who did unlawfully take personal property from the person of MARIA SOTO.
It is further alleged within the meaning of PC 12022.53(b) that a principal personally used a firearm.

COUNT 2
On or about March 4, 2026, the crime of ATTEMPTED CARJACKING, in violation of PENAL CODE SECTION 215(a), a Felony,
was committed by DAVID OKONKWO, who did attempt to take a motor vehicle from the person of MARIA SOTO.

COUNT 3
On or about March 4, 2026, the crime of POSSESSION OF A CONTROLLED SUBSTANCE, in violation of HEALTH AND SAFETY CODE SECTION 11350,
a Misdemeanor, was committed by ANA VASQUEZ.
`;

const parsed = await req('POST', `/api/cases/${caseId}/charges/parse`, { token, body: { text: complaintText } });
if (parsed.status !== 200) {
  results.fail('LIF-26', 'The complaint could not be parsed', `HTTP ${parsed.status}: ${(parsed.text ?? '').slice(0, 160)}`);
} else {
  const p = parsed.json;
  p.charges.length === 3
    ? results.pass('LIF-26', 'Counts are read out of an uploaded charging document', `${p.charges.length} counts found`)
    : results.fail('LIF-26', 'The wrong number of counts was found', `${p.charges.length}`);

  const c1 = p.charges[0];
  c1.code === 'PEN' && c1.section === '211' && c1.countNumber === 1
    ? results.pass('LIF-27', 'The code, section and count number are extracted', `Count ${c1.countNumber}: ${c1.code} ${c1.section}`)
    : results.fail('LIF-27', 'Extraction is wrong', JSON.stringify({ n: c1.countNumber, code: c1.code, s: c1.section }));

  const c3 = p.charges[2];
  c3.code === 'HSC' && c3.section === '11350'
    ? results.pass('LIF-28', 'A count citing a different code resolves to that code', `${c3.code} ${c3.section}`)
    : results.fail('LIF-28', 'A cross-code count was misread', `${c3.code} ${c3.section}`);

  const c2 = p.charges[1];
  c2.attempt === true && c2.subdivision === '(a)'
    ? results.pass('LIF-29', 'An attempt and a charged subdivision are recognised', `attempt, subdivision ${c2.subdivision}`)
    : results.fail('LIF-29', 'Attempt or subdivision was missed', JSON.stringify({ attempt: c2.attempt, sub: c2.subdivision }));

  c1.defendants.includes('ANA VASQUEZ')
    ? results.pass('LIF-30', 'The defendant named on a count is extracted', c1.defendants.join(', '))
    : results.fail('LIF-30', 'The defendant was not extracted', JSON.stringify(c1.defendants));

  c1.enhancements.length > 0
    ? results.pass('LIF-31', 'An enhancement pleaded with a count is extracted', c1.enhancements[0].slice(0, 90))
    : results.fail('LIF-31', 'The enhancement was missed');

  Object.values(c1.confidence).every((v) => typeof v === 'number')
    ? results.pass(
        'LIF-32',
        'Every extracted field carries the confidence it was read with',
        Object.entries(c1.confidence).map(([k, v]) => `${k} ${v}`).join(', '),
      )
    : results.fail('LIF-32', 'Confidence is not reported per field', JSON.stringify(c1.confidence));

  typeof p.overallConfidence === 'number' && /proposal, not a filing/i.test(p.message)
    ? results.pass(
        'LIF-33',
        'A parse is presented as a proposal for review, never as a filing',
        `${(p.overallConfidence * 100).toFixed(0)}% overall confidence`,
      )
    : results.fail('LIF-33', 'A parse was presented as settled', p.message?.slice(0, 120));

  p.courtCaseNumber === 'BA778899'
    ? results.pass('LIF-34', 'The court case number is read from the document', p.courtCaseNumber)
    : results.warn('LIF-34', 'The case number was not extracted', String(p.courtCaseNumber));
}

// A document the parser cannot read must say so rather than return nothing.
const unreadable = await req('POST', `/api/cases/${caseId}/charges/parse`, {
  token,
  body: { text: 'This is a scanned page with no recognisable count headings at all.' },
});
unreadable.status === 200 && unreadable.json.charges.length === 0 && unreadable.json.notes.length > 0
  ? results.pass('LIF-35', 'A document with no readable counts is explained, not silently empty', unreadable.json.notes[0].slice(0, 120))
  : results.fail('LIF-35', 'An unreadable document returned nothing useful', JSON.stringify(unreadable.json).slice(0, 150));

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

const defendant = await registerUser({ prefix: 'life-def', defaultRole: 'criminal_defendant' });
const defendantDraft = await req('POST', `/api/cases/${caseId}/charges/drafts`, {
  token: defendant.token,
  body: { kind: 'complaint', name: 'Fabricated', filedAt: '2026-04-01T00:00:00.000Z' },
});
[401, 403, 404].includes(defendantDraft.status)
  ? results.pass('LIF-36', 'A defendant cannot draft a charging document', `HTTP ${defendantDraft.status}`)
  : results.fail('LIF-36', 'A defendant drafted a charging document', `HTTP ${defendantDraft.status}`);

await results.write({ caseId });
await prisma.$disconnect();
