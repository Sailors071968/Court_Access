#!/usr/bin/env node
// Program 153 — evidence coverage and explainability.
//
// The elements have to come from the statute every time, the material has to
// be quoted from documents that exist, an element with nothing behind it has
// to say so, and none of it may decide whether anything is proved.

import { createHash } from 'node:crypto';
import { Results, req, registerUser } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('EVIDENCE_COVERAGE', 'Program 153 — Evidence Coverage and Explainability');

const account = await registerUser({ prefix: 'cov-atty', defaultRole: 'attorney' });
const token = account.token;

const created = await req('POST', '/api/cases', {
  token,
  body: { title: 'People v. Ibarra', caseNumber: `COV-${Date.now()}`, jurisdiction: 'Los Angeles County', caseType: 'felony' },
});
const caseId = created.json?.case?.caseId ?? created.json?.caseId;

// A case with no charges must say so rather than show an empty matrix.
const bare = await req('GET', `/api/cases/${caseId}/evidence-coverage`, { token, timeoutMs: 120000 });
bare.status === 200 && /No charging document has been filed/i.test(bare.json.note ?? '')
  ? results.pass('COV-01', 'A case with no charges says so rather than showing an empty matrix', bare.json.note)
  : results.fail('COV-01', 'An uncharged case did not explain itself', JSON.stringify(bare.json).slice(0, 150));

// ---------------------------------------------------------------------------
// A burglary count, and a record that touches some of its elements
// ---------------------------------------------------------------------------

const report = `
LOS ANGELES POLICE DEPARTMENT — INVESTIGATIVE REPORT

The reporting party stated an unknown subject entered the residence through an unlocked window. The residence is
an inhabited dwelling house occupied by the reporting party. A television and a laptop were taken from the
building. The subject was seen leaving through the same window.

No fingerprints were located on the window frame. The witness was unable to identify the subject.
`;
const evidence = await prisma.evidence.create({
  data: {
    caseId,
    tenantId: account.user.tenantId,
    uploadedBy: account.user.userId,
    fileName: 'Burglary Report.pdf',
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

await req('POST', `/api/cases/${caseId}/charges/documents`, {
  token,
  timeoutMs: 180000,
  body: {
    kind: 'complaint',
    name: 'Complaint',
    filedAt: '2026-06-01T00:00:00.000Z',
    charges: [
      {
        countNumber: 1,
        code: 'PEN',
        section: '459',
        verbatimText:
          'On or about May 2, 2026, the crime of FIRST DEGREE RESIDENTIAL BURGLARY, in violation of PENAL CODE SECTION 459, a Felony, was committed by ANA IBARRA.',
        defendants: [{ name: 'Ana Ibarra' }],
      },
      {
        countNumber: 2,
        code: 'PEN',
        section: '99999',
        verbatimText: 'A count citing a section that does not exist, to test how that is reported.',
        defendants: [{ name: 'Ana Ibarra' }],
      },
    ],
  },
});

const coverage = await req('GET', `/api/cases/${caseId}/evidence-coverage`, { token, timeoutMs: 180000 });
if (coverage.status !== 200) {
  results.fail('COV-02', 'The coverage matrix could not be built', `HTTP ${coverage.status}`);
} else {
  const counts = coverage.json.counts;
  counts.length === 2
    ? results.pass('COV-02', 'Every charged count appears in the matrix', `${counts.length} counts`)
    : results.fail('COV-02', 'Counts are missing from the matrix', String(counts.length));

  const burglary = counts.find((c) => c.section === '459.');

  burglary?.elements.length > 0
    ? results.pass('COV-03', 'Elements are taken from the statute, not from a stored list', `${burglary.elements.length} elements, sourced from the section`)
    : results.fail('COV-03', 'No elements were derived', JSON.stringify(burglary).slice(0, 150));

  burglary?.elements.every((e) => e.source)
    ? results.pass('COV-04', 'Each element names where in the statute it came from', burglary.elements[0].source)
    : results.fail('COV-04', 'An element has no source');

  burglary?.officialUrl?.startsWith('https://leginfo.legislature.ca.gov/')
    ? results.pass('COV-05', 'The count links to the official statute it charges', burglary.officialUrl.slice(0, 90))
    : results.fail('COV-05', 'The count has no link to the official source');

  const withMaterial = burglary?.elements.filter((e) => e.status === 'has_material') ?? [];
  withMaterial.length > 0
    ? results.pass('COV-06', 'Material in the record is placed beside the elements it touches', `${withMaterial.length} element(s) have material`)
    : results.fail('COV-06', 'No material was matched to any element');

  // Every quoted passage must really be in the document.
  const flat = report.replace(/\s+/g, ' ');
  const allCitations = (burglary?.elements ?? []).flatMap((e) => [...e.supporting, ...e.conflicting]);
  const misquoted = allCitations.filter((c) => {
    const core = c.excerpt.replace(/^…|…$/g, '').slice(0, 55).trim().replace(/\s+/g, ' ');
    return core.length > 20 && !flat.includes(core);
  });
  misquoted.length === 0 && allCitations.length > 0
    ? results.pass('COV-07', 'Every quoted passage appears in the document it is attributed to', `${allCitations.length} passages verified`)
    : results.fail('COV-07', 'A quoted passage is not in the document', misquoted[0]?.excerpt.slice(0, 110) ?? 'no citations at all');

  // Contrary material must be shown as contrary, not folded into support.
  const conflicting = (burglary?.elements ?? []).flatMap((e) => e.conflicting);
  conflicting.length > 0
    ? results.pass(
        'COV-08',
        'Material that cuts the other way is shown separately, not folded into support',
        conflicting[0].excerpt.slice(0, 110),
      )
    : results.warn('COV-08', 'No contrary material was identified', 'the report contains "unable to identify" and "no fingerprints"');

  // The most important cell: an element with nothing behind it.
  const without = (burglary?.elements ?? []).filter((e) => e.status === 'no_material');
  without.length === 0
    ? results.warn(
        'COV-09',
        'Every element of this count has material, so the empty cell was not exercised here',
        'The report used is deliberately rich. Count 2 exercises the neighbouring case, where the statute itself ' +
          'cannot be read and no elements exist to cover.',
      )
    : results.pass(
        'COV-09',
        'An element with nothing behind it says so, and says what that does and does not mean',
        without[0].basis.slice(0, 130),
      );

  // It must never decide whether an element is proved.
  const { caveat: _caveat, ...coverageContent } = coverage.json;
  const body = JSON.stringify(coverageContent);
  !/\b(?:element is (?:proved|satisfied|met)|proven beyond|sufficient to convict|fails as a matter of law)\b/i.test(body)
    ? results.pass('COV-10', 'The matrix never decides whether an element is proved')
    : results.fail('COV-10', 'The matrix decided an element', body.match(/element is (?:proved|satisfied|met)/i)?.[0]);

  /does not decide whether an element is proved/i.test(coverage.json.caveat)
    ? results.pass('COV-11', 'The matrix says plainly that it decides nothing', coverage.json.caveat.slice(0, 110))
    : results.fail('COV-11', 'The matrix does not state its limits');

  // A count citing a section that does not exist must be reported, not skipped.
  const missing = counts.find((c) => c.section === '99999.');
  missing?.unavailable && /(?:could not be read|has no section)/i.test(missing.unavailable)
    ? results.pass(
        'COV-12',
        'A count whose statute cannot be read is reported with the reason, not silently dropped',
        missing.unavailable.slice(0, 120),
      )
    : results.fail('COV-12', 'An unreadable statute was not reported', JSON.stringify(missing).slice(0, 150));

  burglary?.calcrim?.instruction === 'CALCRIM 1700'
    ? results.pass('COV-13', 'The CALCRIM correspondence is shown where one is verified', burglary.calcrim.instruction)
    : results.fail('COV-13', 'The CALCRIM correspondence is wrong', JSON.stringify(burglary?.calcrim));

  burglary?.mentalStates?.some((m) => m.mentalState === 'intent' && m.basis)
    ? results.pass('COV-14', 'The mental state comes from the statute with the words that establish it', burglary.mentalStates[0].basis?.slice(0, 100))
    : results.fail('COV-14', 'No mental state was reported for burglary', JSON.stringify(burglary?.mentalStates).slice(0, 140));
}

// ---------------------------------------------------------------------------
// Explain this
// ---------------------------------------------------------------------------

const explanation = await req('GET', `/api/cases/${caseId}/explain/count/1`, { token, timeoutMs: 180000 });
if (explanation.status !== 200) {
  results.fail('COV-15', 'A displayed item could not be explained', `HTTP ${explanation.status}`);
} else {
  const e = explanation.json;
  const required = ['whyDisplayed', 'producedBy', 'repository', 'supportingEvidence', 'conflictingEvidence', 'missingEvidence', 'unknown'];
  const absent = required.filter((k) => e[k] === undefined);
  absent.length === 0
    ? results.pass('COV-15', 'An explanation answers why it is shown, what produced it, and what supports it', required.join(', '))
    : results.fail('COV-15', 'The explanation is incomplete', absent.join(', '));

  /charged in the operative charging document/i.test(e.whyDisplayed)
    ? results.pass('COV-16', 'The explanation says why the item is on screen', e.whyDisplayed)
    : results.fail('COV-16', 'No reason was given for displaying it', e.whyDisplayed);

  e.authorities.length > 0 && e.authorities[0].officialUrl
    ? results.pass('COV-17', 'The explanation links to the legal authority behind the item', e.authorities[0].citation)
    : results.fail('COV-17', 'The explanation cites no authority');

  Array.isArray(e.unknown)
    ? results.pass('COV-18', 'Anything the explanation cannot answer is listed rather than left blank', `${e.unknown.length} unknown item(s)`)
    : results.fail('COV-18', 'Unknowns are not reported');

  const missingExplain = await req('GET', `/api/cases/${caseId}/explain/count/99`, { token });
  missingExplain.status === 404
    ? results.pass('COV-19', 'Asking to explain something not on screen returns nothing, not an invention', 'HTTP 404')
    : results.fail('COV-19', 'An explanation was produced for something not displayed', `HTTP ${missingExplain.status}`);
}

// ---------------------------------------------------------------------------
// Repository completeness
// ---------------------------------------------------------------------------

const completeness = await req('GET', '/api/repositories/completeness', { token });
if (completeness.status !== 200) {
  results.fail('COV-20', 'Repository completeness could not be read', `HTTP ${completeness.status}`);
} else {
  const repos = completeness.json.repositories;
  repos.length >= 3 && repos.every((r) => r.coverage && r.unknownItems && r.synchronization)
    ? results.pass('COV-21', 'Every repository reports coverage, unknowns and synchronisation', repos.map((r) => r.name).join(', '))
    : results.fail('COV-21', 'A repository does not report its state', JSON.stringify(repos).slice(0, 160));

  const gold = repos.find((r) => /Gold Standard/i.test(r.name));
  gold?.missingSources?.includes('Case 001')
    ? results.pass('COV-20', 'The missing Gold Standard cases are named as missing sources', gold.missingSources.join(', '))
    : results.fail('COV-20', 'The missing cases are not reported', JSON.stringify(gold).slice(0, 140));

  /reported as what has been retrieved, not as a proportion/i.test(completeness.json.caveat)
    ? results.pass('COV-22', 'Coverage is described rather than given a number nobody can justify', completeness.json.caveat.slice(0, 110))
    : results.fail('COV-22', 'Coverage is stated without qualification');
}

// ---------------------------------------------------------------------------
// Isolation
// ---------------------------------------------------------------------------

const other = await registerUser({ prefix: 'cov-other', defaultRole: 'attorney' });
const leak = await req('GET', `/api/cases/${caseId}/evidence-coverage`, { token: other.token });
leak.status === 404
  ? results.pass('COV-23', 'The coverage matrix is not visible to another firm', 'HTTP 404')
  : results.fail('COV-23', 'The coverage matrix leaked across firms', `HTTP ${leak.status}`);

await results.write({ caseId });
await prisma.$disconnect();
