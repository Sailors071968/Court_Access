#!/usr/bin/env node
// Program 148 — charging document certification.
//
// Runs a case through the sequence a real California prosecution follows: a
// complaint, an amended complaint that adds a count and dismisses another, an
// information that renumbers what is left and severs a codefendant. Each step
// asserts that the current charges are the latest filing, that nothing earlier
// was destroyed, and that every change is identified in words.

import { Results, req, registerUser, login } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('CHARGING_DOCUMENTS', 'Program 148 — Charging Documents');

const account = await registerUser({ prefix: 'charge-atty', defaultRole: 'attorney' });
const token = account.token;

const created = await req('POST', '/api/cases', {
  token,
  body: {
    title: 'People v. Rivera and Doe',
    caseNumber: `CHG-${Date.now()}`,
    jurisdiction: 'Los Angeles County',
    caseType: 'felony',
  },
});
const caseId = created.json?.case?.caseId ?? created.json?.caseId;
if (!caseId) {
  results.fail('CHG-00', 'Could not create a case', `HTTP ${created.status}: ${(created.text ?? '').slice(0, 160)}`);
  await results.write({});
  await prisma.$disconnect();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Phase 3 — the California code selector
// ---------------------------------------------------------------------------

const codes = await req('GET', '/api/charging/codes', { token });
codes.status === 200 && codes.json.codes.length >= 29
  ? results.pass(
      'CHG-01',
      'Every California code is offered for charge entry',
      `${codes.json.codes.length} codes, including ${codes.json.codes.slice(0, 3).map((c) => c.name).join(', ')}`,
    )
  : results.fail('CHG-01', 'The code selector is incomplete', `${codes.json?.codes?.length ?? 0} codes`);

const names = (codes.json?.codes ?? []).map((c) => c.name);
const expected = ['Penal Code', 'Vehicle Code', 'Health and Safety Code', 'Fish and Game Code', 'Welfare and Institutions Code'];
const absent = expected.filter((n) => !names.includes(n));
absent.length === 0
  ? results.pass('CHG-02', 'The codes a California charge actually cites are all present', expected.join(', '))
  : results.fail('CHG-02', 'Codes are missing from the selector', absent.join(', '));

// ---------------------------------------------------------------------------
// Phase 1, 4, 5 — the original complaint
// ---------------------------------------------------------------------------

const complaint = await req('POST', `/api/cases/${caseId}/charges/documents`, {
  token,
  timeoutMs: 180000,
  body: {
    kind: 'complaint',
    name: 'Complaint',
    filedAt: '2026-01-15T00:00:00.000Z',
    court: 'Superior Court of California, County of Los Angeles',
    courtCaseNumber: 'BA123456',
    citation: 'Complaint filed 15 January 2026',
    charges: [
      {
        countNumber: 1,
        code: 'PEN',
        section: '459',
        subdivision: null,
        verbatimText:
          'On or about January 2, 2026, the crime of FIRST DEGREE RESIDENTIAL BURGLARY, in violation of PENAL CODE SECTION 459, a Felony, was committed by MARCO RIVERA, who did enter an inhabited dwelling house occupied by JANE DOE, with the intent to commit larceny and any felony.',
        enhancements: ['PC 12022(a)(1) — principal armed with a firearm'],
        defendants: [{ name: 'Marco Rivera' }, { name: 'Luis Doe' }],
      },
      {
        countNumber: 2,
        code: 'PEN',
        section: '245',
        subdivision: '(a)(4)',
        verbatimText:
          'On or about January 2, 2026, the crime of ASSAULT BY MEANS OF FORCE LIKELY TO PRODUCE GREAT BODILY INJURY, in violation of PENAL CODE SECTION 245(a)(4), a Felony, was committed by MARCO RIVERA, who did commit an assault upon JANE DOE.',
        defendants: [{ name: 'Marco Rivera' }],
      },
      {
        countNumber: 3,
        code: 'HSC',
        section: '11350',
        subdivision: null,
        verbatimText:
          'On or about January 2, 2026, the crime of POSSESSION OF A CONTROLLED SUBSTANCE, in violation of HEALTH AND SAFETY CODE SECTION 11350, was committed by LUIS DOE.',
        defendants: [{ name: 'Luis Doe' }],
      },
    ],
  },
});

if (complaint.status !== 201) {
  results.fail('CHG-03', 'The complaint could not be filed', `HTTP ${complaint.status}: ${(complaint.text ?? '').slice(0, 250)}`);
} else {
  results.pass('CHG-03', 'A complaint is filed with its counts', `${complaint.json.document.charges.length} counts`);

  const count1 = complaint.json.document.charges.find((c) => c.countNumber === 1);

  // Phase 5 — the People's words, unchanged.
  count1.verbatimText.includes('did enter an inhabited dwelling house occupied by JANE DOE')
    ? results.pass('CHG-04', "The People's wording is stored exactly as filed, not paraphrased", count1.verbatimText.slice(0, 100))
    : results.fail('CHG-04', 'The charge wording was altered', count1.verbatimText.slice(0, 150));

  count1.normalizedCitation === 'Penal Code section 459'
    ? results.pass('CHG-05', 'A normalised citation is stored beside the verbatim text', count1.normalizedCitation)
    : results.fail('CHG-05', 'The normalised citation is wrong', count1.normalizedCitation);

  const count2 = complaint.json.document.charges.find((c) => c.countNumber === 2);
  count2.normalizedCitation === 'Penal Code section 245(a)(4)'
    ? results.pass('CHG-06', 'A charged subdivision is carried into the citation', count2.normalizedCitation)
    : results.fail('CHG-06', 'The subdivision was lost', count2.normalizedCitation);

  // Phase 4 — the statute is retrieved from the Legislature.
  const resolved = complaint.json.document.charges.filter((c) => c.officialStatuteId);
  resolved.length === 3
    ? results.pass('CHG-07', 'Every charged section is resolved against the official source', `${resolved.length} of 3 counts`)
    : results.fail(
        'CHG-07',
        'Some charged sections were not resolved',
        complaint.json.document.charges.map((c) => `${c.code} ${c.section}: ${c.officialStatuteId ? 'ok' : c.statuteNote}`).join('; ').slice(0, 200),
      );

  // Phase 6 — defendants per count.
  const joint = complaint.json.document.charges.find((c) => c.defendants.length === 2);
  joint
    ? results.pass('CHG-08', 'A count can be charged against more than one defendant', joint.defendants.map((d) => d.defendantName).join(' and '))
    : results.fail('CHG-08', 'Joint charges are not supported');

  const individual = complaint.json.document.charges.find((c) => c.countNumber === 3);
  individual.defendants.length === 1 && individual.defendants[0].defendantName === 'Luis Doe'
    ? results.pass('CHG-09', 'A count can be charged against one defendant alone', 'count 3 names Luis Doe only')
    : results.fail('CHG-09', 'Individual charging is wrong', JSON.stringify(individual.defendants));

  Array.isArray(count1.enhancements) && count1.enhancements.length === 1
    ? results.pass('CHG-10', 'Enhancements alleged with a count are recorded verbatim', count1.enhancements[0])
    : results.fail('CHG-10', 'Enhancements were not recorded', JSON.stringify(count1.enhancements));
}

// ---------------------------------------------------------------------------
// Phase 7, 8 — an amended complaint
// ---------------------------------------------------------------------------

const amended = await req('POST', `/api/cases/${caseId}/charges/documents`, {
  token,
  timeoutMs: 180000,
  body: {
    kind: 'amended_complaint',
    name: 'First Amended Complaint',
    filedAt: '2026-02-10T00:00:00.000Z',
    court: 'Superior Court of California, County of Los Angeles',
    courtCaseNumber: 'BA123456',
    charges: [
      {
        // Same count, rewritten allegation, enhancement dropped, Doe removed.
        countNumber: 1,
        code: 'PEN',
        section: '459',
        verbatimText:
          'On or about January 2, 2026, the crime of FIRST DEGREE RESIDENTIAL BURGLARY, in violation of PENAL CODE SECTION 459, a Felony, was committed by MARCO RIVERA, who did enter an inhabited dwelling house, with the intent to commit larceny.',
        defendants: [{ name: 'Marco Rivera' }],
      },
      {
        // Renumbered from 2 to 3.
        countNumber: 3,
        code: 'PEN',
        section: '245',
        subdivision: '(a)(4)',
        verbatimText:
          'On or about January 2, 2026, the crime of ASSAULT BY MEANS OF FORCE LIKELY TO PRODUCE GREAT BODILY INJURY, in violation of PENAL CODE SECTION 245(a)(4), a Felony, was committed by MARCO RIVERA, who did commit an assault upon JANE DOE.',
        defendants: [{ name: 'Marco Rivera' }],
      },
      {
        // A new count.
        countNumber: 2,
        code: 'PEN',
        section: '211',
        verbatimText:
          'On or about January 2, 2026, the crime of SECOND DEGREE ROBBERY, in violation of PENAL CODE SECTION 211, a Felony, was committed by MARCO RIVERA, who did take personal property from the person of JANE DOE.',
        defendants: [{ name: 'Marco Rivera' }],
      },
      // HSC 11350 against Luis Doe is gone entirely.
    ],
  },
});

if (amended.status !== 201) {
  results.fail('CHG-11', 'The amended complaint could not be filed', `HTTP ${amended.status}: ${(amended.text ?? '').slice(0, 200)}`);
} else {
  results.pass('CHG-11', 'An amended complaint is filed after the original', `${amended.json.document.charges.length} counts`);

  const current = await req('GET', `/api/cases/${caseId}/charges/current`, { token });
  current.json.operativeDocument.name === 'First Amended Complaint'
    ? results.pass('CHG-12', 'The newest filing determines the current charges', `operative: ${current.json.operativeDocument.name}`)
    : results.fail('CHG-12', 'The current charges are not the newest filing', current.json.operativeDocument?.name);

  const hsc = current.json.charges.find((c) => c.code === 'HSC');
  !hsc
    ? results.pass('CHG-13', 'A count dropped from the amended pleading is not among the current charges', 'HSC 11350 is no longer charged')
    : results.fail('CHG-13', 'A dropped count is still shown as current', JSON.stringify(hsc).slice(0, 120));

  // Phase 2 — nothing historical is destroyed.
  const history = await req('GET', `/api/cases/${caseId}/charges/history`, { token });
  const original = history.json.documents.find((d) => d.name === 'Complaint');
  original && original.charges.length === 3 && original.charges.some((c) => c.code === 'HSC')
    ? results.pass(
        'CHG-14',
        'The original complaint survives intact, including the count later dropped',
        `${original.charges.length} counts still recorded, HSC 11350 among them`,
      )
    : results.fail('CHG-14', 'The original complaint was altered or lost', JSON.stringify(original?.charges?.length));

  original?.supersededAt
    ? results.pass('CHG-15', 'A superseded filing is marked rather than removed', `superseded ${original.supersededAt}`)
    : results.fail('CHG-15', 'The superseded filing is not marked');
}

// ---------------------------------------------------------------------------
// Phase 8 — change detection in words
// ---------------------------------------------------------------------------

const timeline = await req('GET', `/api/cases/${caseId}/charges/timeline`, { token });
if (timeline.status !== 200) {
  results.fail('CHG-16', 'The charging timeline could not be read', `HTTP ${timeline.status}`);
} else {
  const second = timeline.json.timeline[1];
  const types = new Set(second.changesFromPrevious.map((c) => c.type));

  types.has('added')
    ? results.pass('CHG-16', 'An added count is identified', second.changesFromPrevious.find((c) => c.type === 'added').description)
    : results.fail('CHG-16', 'The added count was not detected', [...types].join(', '));

  types.has('dismissed')
    ? results.pass('CHG-17', 'A count no longer charged is identified', second.changesFromPrevious.find((c) => c.type === 'dismissed').description)
    : results.fail('CHG-17', 'The dropped count was not detected', [...types].join(', '));

  types.has('renumbered')
    ? results.pass(
        'CHG-18',
        'A renumbered count is identified as renumbered, not as a dismissal and an addition',
        second.changesFromPrevious.find((c) => c.type === 'renumbered').description,
      )
    : results.fail('CHG-18', 'Renumbering was not detected', [...types].join(', '));

  types.has('allegation_modified')
    ? results.pass('CHG-19', 'A rewritten allegation is identified', second.changesFromPrevious.find((c) => c.type === 'allegation_modified').description)
    : results.fail('CHG-19', 'The rewritten allegation was not detected', [...types].join(', '));

  types.has('enhancement_dismissed')
    ? results.pass('CHG-20', 'An enhancement no longer alleged is identified', second.changesFromPrevious.find((c) => c.type === 'enhancement_dismissed').description)
    : results.fail('CHG-20', 'The dropped enhancement was not detected', [...types].join(', '));

  types.has('defendant_removed')
    ? results.pass('CHG-21', 'A defendant no longer charged on a count is identified', second.changesFromPrevious.find((c) => c.type === 'defendant_removed').description)
    : results.fail('CHG-21', 'The removed defendant was not detected', [...types].join(', '));

  timeline.json.timeline[0].changesFromPrevious.length === 0 && timeline.json.timeline[0].isOperative === false
    ? results.pass('CHG-22', 'The first filing has nothing to compare against and is not operative', 'Complaint')
    : results.warn('CHG-22', 'The first filing is described unexpectedly', JSON.stringify(timeline.json.timeline[0]).slice(0, 140));
}

// ---------------------------------------------------------------------------
// An information, with a severed codefendant
// ---------------------------------------------------------------------------

const information = await req('POST', `/api/cases/${caseId}/charges/documents`, {
  token,
  timeoutMs: 180000,
  body: {
    kind: 'information',
    name: 'Information',
    filedAt: '2026-03-20T00:00:00.000Z',
    court: 'Superior Court of California, County of Los Angeles',
    courtCaseNumber: 'BA123456',
    charges: [
      {
        countNumber: 1,
        code: 'PEN',
        section: '459',
        verbatimText:
          'On or about January 2, 2026, the crime of FIRST DEGREE RESIDENTIAL BURGLARY, in violation of PENAL CODE SECTION 459, a Felony, was committed by MARCO RIVERA, who did enter an inhabited dwelling house, with the intent to commit larceny.',
        defendants: [
          { name: 'Marco Rivera' },
          { name: 'Luis Doe', status: 'severed', note: 'Severed for separate trial on motion of the People.' },
        ],
      },
      {
        countNumber: 2,
        code: 'PEN',
        section: '211',
        verbatimText:
          'On or about January 2, 2026, the crime of SECOND DEGREE ROBBERY, in violation of PENAL CODE SECTION 211, a Felony, was committed by MARCO RIVERA, who did take personal property from the person of JANE DOE.',
        status: 'dismissed',
        defendants: [{ name: 'Marco Rivera', status: 'dismissed' }],
      },
    ],
  },
});

if (information.status === 201) {
  results.pass('CHG-23', 'An information is filed after the amended complaint', 'three filings now on record');

  const current = await req('GET', `/api/cases/${caseId}/charges/current`, { token });
  current.json.operativeDocument.kind === 'information'
    ? results.pass('CHG-24', 'The information becomes the operative document', current.json.operativeDocument.name)
    : results.fail('CHG-24', 'The information is not operative', current.json.operativeDocument?.kind);

  current.json.activeCounts === 1 && current.json.dismissedCounts === 1
    ? results.pass('CHG-25', 'Dismissed counts are shown as dismissed, not hidden', `${current.json.activeCounts} active, ${current.json.dismissedCounts} dismissed`)
    : results.fail('CHG-25', 'The count status breakdown is wrong', JSON.stringify({ a: current.json.activeCounts, d: current.json.dismissedCounts }));

  const severed = current.json.charges.flatMap((c) => c.defendants).find((d) => d.status === 'severed');
  severed
    ? results.pass('CHG-26', 'A severed defendant is recorded as severed, with the reason', `${severed.name}: ${severed.note}`)
    : results.fail('CHG-26', 'Severance is not recorded');

  // Phase 9 — the analysis inputs follow the operative charges.
  information.json.operativeChargesSynchronised === 1
    ? results.pass(
        'CHG-27',
        'The charges the analysis engines read are rebuilt from the operative document',
        `${information.json.operativeChargesSynchronised} active count synchronised`,
      )
    : results.fail('CHG-27', 'Analysis charges were not synchronised', String(information.json.operativeChargesSynchronised));

  const derived = await prisma.charge.findMany({ where: { caseId } });
  derived.length === 1 && derived[0].section.startsWith('459')
    ? results.pass('CHG-28', 'Downstream analysis sees exactly the counts still charged', `${derived[0].code} ${derived[0].section}`)
    : results.fail('CHG-28', 'Downstream charges do not match the operative document', JSON.stringify(derived.map((d) => `${d.code} ${d.section}`)));
}

// ---------------------------------------------------------------------------
// Comparison across non-adjacent filings
// ---------------------------------------------------------------------------

const history = await req('GET', `/api/cases/${caseId}/charges/history`, { token });
const docs = history.json.documents;
const compare = await req(
  'GET',
  `/api/cases/${caseId}/charges/compare?from=${docs[0].chargingDocumentId}&to=${docs[2].chargingDocumentId}`,
  { token },
);
compare.status === 200 && compare.json.changes.length > 0
  ? results.pass(
      'CHG-29',
      'Any two filings can be compared, not only consecutive ones',
      `${compare.json.changes.length} changes between the Complaint and the Information`,
    )
  : results.fail('CHG-29', 'Non-adjacent comparison failed', `HTTP ${compare.status}`);

// ---------------------------------------------------------------------------
// Nothing is ever destroyed
// ---------------------------------------------------------------------------

const firstCharge = docs[0].charges[0];
const deletion = await req('DELETE', `/api/charging/counts/${firstCharge.filedChargeId}`, { token });
deletion.status === 409 && /never removed from the record/i.test(deletion.json?.message ?? '')
  ? results.pass('CHG-30', 'A charge cannot be deleted, and the refusal explains why', deletion.json.message.slice(0, 120))
  : results.fail('CHG-30', 'A charge could be deleted', `HTTP ${deletion.status}`);

const stillThere = await prisma.filedCharge.count({ where: { caseId } });
stillThere === 8
  ? results.pass('CHG-31', 'Every count ever filed is still on record', `${stillThere} counts across three filings`)
  : results.warn('CHG-31', 'The count of historical charges is unexpected', `${stillThere} recorded`);

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

const defendant = await registerUser({ prefix: 'chg-def', defaultRole: 'criminal_defendant' });
const defendantFiling = await req('POST', `/api/cases/${caseId}/charges/documents`, {
  token: defendant.token,
  body: { kind: 'complaint', name: 'Fabricated', filedAt: '2026-04-01T00:00:00.000Z', charges: [] },
});
[401, 403, 404].includes(defendantFiling.status)
  ? results.pass('CHG-32', 'A defendant cannot file a charging document', `HTTP ${defendantFiling.status}`)
  : results.fail('CHG-32', 'A defendant filed a charging document', `HTTP ${defendantFiling.status}`);

const otherFirm = await registerUser({ prefix: 'chg-other', defaultRole: 'attorney' });
const crossTenant = await req('GET', `/api/cases/${caseId}/charges/current`, { token: otherFirm.token });
crossTenant.status === 404
  ? results.pass('CHG-33', 'Charges are not visible to another firm', 'HTTP 404')
  : results.fail('CHG-33', 'Charges leaked across firms', `HTTP ${crossTenant.status}`);

// A code that is not California must be refused at entry.
const badCode = await req('POST', `/api/cases/${caseId}/charges/documents`, {
  token,
  body: {
    kind: 'complaint',
    name: 'Bad code',
    filedAt: '2026-04-01T00:00:00.000Z',
    charges: [{ countNumber: 1, code: 'XYZ', section: '1', verbatimText: 'x' }],
  },
});
badCode.status === 400 && /not a California code/i.test(badCode.json?.message ?? '')
  ? results.pass('CHG-34', 'A charge citing a code that does not exist is refused', badCode.json.message.slice(0, 100))
  : results.fail('CHG-34', 'An invalid code was accepted', `HTTP ${badCode.status}`);

await results.write({ caseId });
await prisma.$disconnect();
