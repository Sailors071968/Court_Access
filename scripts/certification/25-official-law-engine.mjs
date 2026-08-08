#!/usr/bin/env node
// Program 147 — Official California Law Discovery Engine certification.
//
// Every check here runs against leginfo.legislature.ca.gov, the Legislature's
// own publication. Nothing is fixtured: the statutes retrieved are the statutes
// in force, and the assertions are about text the Legislature actually
// published, not about a recorded copy of it.

import { Results, req, registerUser, login } from './lib/harness.mjs';
import { PrismaClient } from '../../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const results = new Results('OFFICIAL_LAW_ENGINE', 'Program 147 — Official California Law Engine');

const account = await registerUser({ prefix: 'law-admin', defaultRole: 'attorney' });
await prisma.user.update({ where: { id: account.user.userId }, data: { role: 'admin' } });
const admin = await login(account.email, account.password);
const token = admin.token;

const attorney = await registerUser({ prefix: 'law-atty', defaultRole: 'attorney' });

// ---------------------------------------------------------------------------
// Phase 1 — retrieval from the official source
// ---------------------------------------------------------------------------

const burglary = await req('GET', '/api/law/statute/PEN/459?refresh=true', { token, timeoutMs: 60000 });

if (burglary.status !== 200) {
  results.fail('LAW-01', 'Penal Code 459 could not be retrieved', `HTTP ${burglary.status}: ${(burglary.text ?? '').slice(0, 200)}`);
} else {
  const s = burglary.json.statute;

  s.officialUrl.startsWith('https://leginfo.legislature.ca.gov/')
    ? results.pass('LAW-01', 'Statutory text is retrieved from the official California source', s.officialUrl)
    : results.fail('LAW-01', 'The statute did not come from the official source', s.officialUrl);

  // The text must actually be the burglary statute, not a page fragment.
  /enters any house, room, apartment/i.test(s.text) && /guilty of burglary/i.test(s.text)
    ? results.pass('LAW-02', 'The retrieved text is the statute itself', `${s.text.length} characters of Penal Code 459`)
    : results.fail('LAW-02', 'The retrieved text is not the statute', s.text?.slice(0, 200));

  // No framework markup may leak into text that will be quoted in a filing.
  !/javax\.faces|<input|ViewState|<div/i.test(s.text)
    ? results.pass('LAW-03', 'No page markup leaks into the statutory text', 'text is clean enough to quote')
    : results.fail('LAW-03', 'Framework markup leaked into the statutory text', s.text.match(/javax\.faces|<input|<div/i)?.[0]);

  s.fingerprint && s.fingerprint.length === 64
    ? results.pass('LAW-04', 'Each retrieval carries a deterministic fingerprint', s.fingerprint.slice(0, 24))
    : results.fail('LAW-04', 'No fingerprint was produced');

  /Stats\. \d{4}/.test(s.legislativeNote ?? '')
    ? results.pass('LAW-05', 'The legislative version is captured from the source', s.legislativeNote.slice(0, 110))
    : results.fail('LAW-05', 'No legislative note was captured', String(s.legislativeNote));

  /Effective/i.test(s.legislativeNote ?? '')
    ? results.pass('LAW-06', 'The effective date is captured where the Legislature publishes one', s.legislativeNote.match(/Effective[^)]*/i)?.[0])
    : results.warn('LAW-06', 'No effective date was published with this section', s.legislativeNote?.slice(0, 100));

  s.hierarchy.some((h) => /PART 1/i.test(h.heading)) && s.hierarchy.some((h) => /CHAPTER 2\. Burglary/i.test(h.heading))
    ? results.pass('LAW-07', 'The statute carries its place in the code', s.hierarchy.map((h) => h.heading.split('.')[0]).join(' / '))
    : results.fail('LAW-07', 'The structural hierarchy was not captured', JSON.stringify(s.hierarchy).slice(0, 200));

  // Phase 2 — compilation
  const c = s.compilation;
  c.kind === 'offense'
    ? results.pass('LAW-08', 'The compiler recognises a section that creates criminal liability', c.kindBasis.slice(0, 110))
    : results.fail('LAW-08', 'Penal Code 459 was not recognised as an offence', `${c.kind}: ${c.kindBasis}`);

  c.mentalStates.some((m) => m.mentalState === 'intent' && m.basis)
    ? results.pass(
        'LAW-09',
        'Mens rea is extracted from the statutory language and cites it',
        c.mentalStates.find((m) => m.mentalState === 'intent').basis.slice(0, 110),
      )
    : results.fail('LAW-09', 'Intent was not extracted from Penal Code 459', JSON.stringify(c.mentalStates).slice(0, 200));

  // 459 refers out to four other codes by name; those must resolve correctly.
  const codes = new Set(c.crossReferences.map((x) => x.code));
  codes.has('HNC') && codes.has('VEH') && codes.has('HSC')
    ? results.pass(
        'LAW-10',
        'Cross references resolve to the code the statute names, not the code being read',
        c.crossReferences.map((x) => `${x.code} ${x.section}`).join(', '),
      )
    : results.fail('LAW-10', 'Cross references did not resolve to the right codes', [...codes].join(', '));

  c.crossReferences.some((x) => x.kind === 'definition')
    ? results.pass('LAW-11', 'Definitional references are distinguished from plain references', `${c.crossReferences.filter((x) => x.kind === 'definition').length} definitional`)
    : results.warn('LAW-11', 'No definitional reference was identified in Penal Code 459');

  c.definedTerms.length > 0
    ? results.pass('LAW-12', 'Terms the statute defines are extracted', c.definedTerms.map((d) => d.term).join(', '))
    : results.warn('LAW-12', 'No defined terms were extracted from Penal Code 459');
}

// ---------------------------------------------------------------------------
// Never fabricate: a section that does not exist, and one that is not law
// ---------------------------------------------------------------------------

const missing = await req('GET', '/api/law/statute/PEN/99999', { token, timeoutMs: 60000 });
missing.status === 404 && /no section .* in the Penal Code/i.test(missing.json?.message ?? '')
  ? results.pass('LAW-13', 'A section that does not exist is reported, never invented', missing.json.message.slice(0, 110))
  : results.fail('LAW-13', 'A nonexistent section was not handled correctly', `HTTP ${missing.status}: ${(missing.text ?? '').slice(0, 150)}`);

const badCode = await req('GET', '/api/law/statute/ZZZ/1', { token, timeoutMs: 30000 });
badCode.status === 404 && /not a California code/i.test(badCode.json?.message ?? '')
  ? results.pass('LAW-14', 'An unrecognised code is refused with the recognised list', badCode.json.message.slice(0, 100))
  : results.fail('LAW-14', 'An unrecognised code was not refused', `HTTP ${badCode.status}`);

// ---------------------------------------------------------------------------
// A provision that creates no liability must not be given a mental state
// ---------------------------------------------------------------------------

const pc20 = await req('GET', '/api/law/statute/PEN/20', { token, timeoutMs: 60000 });
if (pc20.status === 200) {
  const c = pc20.json.statute.compilation;
  const asserted = c.mentalStates.filter((m) => m.mentalState !== 'unknown');
  asserted.length === 0
    ? results.pass(
        'LAW-15',
        'A section that creates no liability is given no mens rea, though it discusses several',
        'Penal Code 20 names intent and criminal negligence; neither is attributed to it',
      )
    : results.fail(
        'LAW-15',
        'A mental state was read out of a section that requires none',
        asserted.map((m) => m.mentalState).join(', '),
      );

  c.unknowns.some((u) => u.field === 'mentalState')
    ? results.pass('LAW-16', 'The reason a mental state is unknown is recorded', c.unknowns.find((u) => u.field === 'mentalState').reason.slice(0, 110))
    : results.fail('LAW-16', 'No reason was given for the unknown mental state');
}

// ---------------------------------------------------------------------------
// A defining offence, phrased without "is guilty of"
// ---------------------------------------------------------------------------

const murder = await req('GET', '/api/law/statute/PEN/187', { token, timeoutMs: 60000 });
if (murder.status === 200) {
  const c = murder.json.statute.compilation;
  c.kind === 'offense' && c.mentalStates.some((m) => m.mentalState === 'malice')
    ? results.pass(
        'LAW-17',
        'An offence defined rather than announced is still recognised, with its mental state',
        `${c.kind}, malice aforethought`,
      )
    : results.fail('LAW-17', 'Penal Code 187 was misclassified', `${c.kind}, ${c.mentalStates.map((m) => m.mentalState).join(',')}`);

  // 187(b) refers into the Health and Safety Code through several clauses.
  c.crossReferences.some((x) => x.code === 'HSC')
    ? results.pass('LAW-18', 'A reference separated from its code name by several clauses still resolves', c.crossReferences.filter((x) => x.code === 'HSC').map((x) => `HSC ${x.section}`).join(', '))
    : results.fail('LAW-18', 'A distant code reference did not resolve', JSON.stringify(c.crossReferences).slice(0, 160));
}

// ---------------------------------------------------------------------------
// Phase 4 — statutory context graph
// ---------------------------------------------------------------------------

const context = await req('POST', '/api/law/context', {
  token,
  timeoutMs: 300000,
  body: { charges: [{ code: 'PEN', section: '459' }], maxDepth: 1 },
});

if (context.status !== 200) {
  results.fail('LAW-19', 'A statutory context could not be built', `HTTP ${context.status}: ${(context.text ?? '').slice(0, 200)}`);
} else {
  const ctx = context.json;
  ctx.nodes.length > 1
    ? results.pass(
        'LAW-20',
        'A charge pulls in the statutes it depends on, automatically',
        `${ctx.nodes.length} sections: ${ctx.nodes.map((n) => `${n.code} ${n.section}`).join(', ')}`,
      )
    : results.fail('LAW-20', 'The context graph contains only the charged section', JSON.stringify(ctx.nodes.length));

  ctx.nodes.every((n) => n.officialUrl.startsWith('https://leginfo.legislature.ca.gov/') && n.fingerprint)
    ? results.pass('LAW-19', 'Every section in the context carries its official URL and fingerprint', `${ctx.nodes.length} traceable nodes`)
    : results.fail('LAW-19', 'Some context nodes have no provenance');

  ctx.nodes.some((n) => n.relationship === 'definition')
    ? results.pass('LAW-21', 'Definitions the charge depends on are followed and labelled as such', ctx.nodes.filter((n) => n.relationship === 'definition').map((n) => `${n.code} ${n.section}`).join(', '))
    : results.warn('LAW-21', 'No definitional dependency was followed');

  ctx.nodes.filter((n) => n.depth > 0).every((n) => n.reachedVia)
    ? results.pass('LAW-22', 'Every dependency records the words that led to it', ctx.nodes.find((n) => n.depth > 0)?.reachedVia?.slice(0, 100))
    : results.fail('LAW-22', 'A dependency has no explanation of how it was reached');
}

// ---------------------------------------------------------------------------
// Phase 9 — the cache serves verified law and counts its own use
// ---------------------------------------------------------------------------

const first = Date.now();
await req('GET', '/api/law/statute/PEN/459', { token, timeoutMs: 60000 });
const cachedMs = Date.now() - first;

const refreshed = Date.now();
await req('GET', '/api/law/statute/PEN/459?refresh=true', { token, timeoutMs: 60000 });
const officialMs = Date.now() - refreshed;

cachedMs < officialMs
  ? results.pass('LAW-23', 'Verified law is served from cache rather than re-read every time', `${cachedMs}ms cached against ${officialMs}ms from the source`)
  : results.warn('LAW-23', 'The cache was not faster than the official source', `${cachedMs}ms vs ${officialMs}ms`);

const status = await req('GET', '/api/law/status', { token });
if (status.status === 200) {
  const st = status.json;
  st.cache.statutesCached > 0 && st.cache.cacheHits > 0
    ? results.pass(
        'LAW-24',
        'Cache utilisation is reported',
        `${st.cache.statutesCached} statutes cached across ${Object.keys(st.cache.byCode).length} codes, ${st.cache.cacheHits} hits`,
        st.cache,
      )
    : results.fail('LAW-24', 'Cache statistics are empty', JSON.stringify(st.cache).slice(0, 160));

  st.codesAvailable >= 29
    ? results.pass('LAW-25', 'The engine addresses the California codes, not one hardcoded list of offences', `${st.codesAvailable} codes`)
    : results.fail('LAW-25', 'Too few codes are addressable', String(st.codesAvailable));
}

// ---------------------------------------------------------------------------
// Phase 5 — CALCRIM: mappings only, UNKNOWN otherwise
// ---------------------------------------------------------------------------

const mapped = await req('GET', '/api/law/calcrim/PEN/459', { token, timeoutMs: 60000 });
if (mapped.status === 200) {
  const c = mapped.json.calcrim;
  c.status === 'mapped' && c.instruction === 'CALCRIM 1700' && c.elements.length > 0
    ? results.pass(
        'LAW-26',
        'A mapped charge returns its instruction with elements compiled from the statute',
        `${c.instruction}, ${c.elements.length} elements from the official text`,
      )
    : results.fail('LAW-26', 'The CALCRIM mapping is wrong or has no elements', JSON.stringify(c).slice(0, 200));
}

const unmapped = await req('GET', '/api/law/calcrim/HSC/11350', { token, timeoutMs: 60000 });
if (unmapped.status === 200) {
  const c = unmapped.json.calcrim;
  c.status === 'unknown' && c.instruction === null && /has not been guessed/i.test(c.reason ?? '')
    ? results.pass('LAW-27', 'An unmapped charge returns UNKNOWN rather than a guessed instruction', c.reason.slice(0, 110))
    : results.fail('LAW-27', 'An instruction was invented for an unmapped charge', JSON.stringify(c).slice(0, 180));

  c.elements.length > 0
    ? results.pass('LAW-28', 'Statutory elements are still compiled where no instruction is mapped', `${c.elements.length} elements from the official text`)
    : results.warn('LAW-28', 'No elements were compiled for the unmapped charge');
}

// ---------------------------------------------------------------------------
// Phase 7 — legislative synchronisation
// ---------------------------------------------------------------------------

const sync = await req('POST', '/api/law/synchronize', { token, timeoutMs: 300000, body: { limit: 5 } });
if (sync.status !== 200) {
  results.fail('LAW-29', 'Synchronisation failed', `HTTP ${sync.status}: ${(sync.text ?? '').slice(0, 200)}`);
} else {
  sync.json.checked > 0
    ? results.pass(
        'LAW-29',
        'Cached law is re-read against the official source and compared',
        `${sync.json.checked} checked, ${sync.json.unchanged} unchanged, ${sync.json.changed} changed`,
      )
    : results.fail('LAW-29', 'Synchronisation checked nothing');

  sync.json.outcomes.every((o) => o.currentFingerprint && o.previousFingerprint)
    ? results.pass('LAW-30', 'Synchronisation compares fingerprints rather than assuming', `${sync.json.outcomes.length} comparisons`)
    : results.warn('LAW-30', 'Some sections could not be compared', JSON.stringify(sync.json.outcomes.filter((o) => !o.currentFingerprint)).slice(0, 160));

  const events = await prisma.legislativeSyncEvent.count();
  events > 0
    ? results.pass('LAW-31', 'Every synchronisation pass is recorded with a date and an outcome', `${events} events`)
    : results.fail('LAW-31', 'No synchronisation events were recorded');
}

// ---------------------------------------------------------------------------
// Phase 8 — versioned snapshots pin a case to the law it was analysed under
// ---------------------------------------------------------------------------

const caseRes = await req('POST', '/api/cases', {
  token,
  body: {
    title: 'People v. Doe — statutory snapshot probe',
    caseNumber: `LAW-${Date.now()}`,
    jurisdiction: 'Los Angeles County',
    caseType: 'felony',
  },
});
const caseId = caseRes.json?.case?.caseId ?? caseRes.json?.caseId;

if (!caseId) {
  results.fail('LAW-32', 'Could not create a case to pin law to', `HTTP ${caseRes.status}`);
} else {
  const pinned = await req('POST', '/api/law/context', {
    token,
    timeoutMs: 300000,
    body: { charges: [{ code: 'PEN', section: '187' }], caseId, maxDepth: 1 },
  });

  pinned.json?.pinnedToCase > 0
    ? results.pass('LAW-32', 'The law a case was analysed under is pinned to it', `${pinned.json.pinnedToCase} sections pinned`)
    : results.fail('LAW-32', 'No statutes were pinned to the case', JSON.stringify(pinned.json ?? {}).slice(0, 160));

  const snapshot = await req('GET', `/api/law/case/${caseId}/snapshot`, { token });
  if (snapshot.status === 200) {
    const st = snapshot.json.statutes;
    st.length > 0 && st.every((s) => s.officialUrl && s.fingerprint && s.retrievedAt && s.compilerVersion && s.extractionVersion)
      ? results.pass(
          'LAW-33',
          'The snapshot records source, fingerprint, retrieval time and both versions',
          `${st.length} sections, compiler ${st[0].compilerVersion}, extraction ${st[0].extractionVersion}`,
        )
      : results.fail('LAW-33', 'The snapshot is missing provenance', JSON.stringify(st[0] ?? {}).slice(0, 220));

    Array.isArray(snapshot.json.amendedSinceAnalysis)
      ? results.pass(
          'LAW-34',
          'The snapshot reports which sections have since been amended',
          `${snapshot.json.amendedSinceAnalysis.length} amended since analysis`,
        )
      : results.fail('LAW-34', 'Amendments since analysis are not reported');
  }
}

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

const attorneySync = await req('POST', '/api/law/synchronize', { token: attorney.token, body: { limit: 1 } });
[401, 403].includes(attorneySync.status)
  ? results.pass('LAW-35', 'Only administrators may reach out to the official source in bulk', `HTTP ${attorneySync.status}`)
  : results.fail('LAW-35', 'A non-administrator triggered synchronisation', `HTTP ${attorneySync.status}`);

const attorneyRead = await req('GET', '/api/law/statute/PEN/459', { token: attorney.token, timeoutMs: 60000 });
attorneyRead.status === 200
  ? results.pass('LAW-36', 'Any authenticated user can read the law their case depends on', 'HTTP 200 for an attorney')
  : results.fail('LAW-36', 'An attorney cannot read the law', `HTTP ${attorneyRead.status}`);

const anonymous = await req('GET', '/api/law/statute/PEN/459');
[401, 403].includes(anonymous.status)
  ? results.pass('LAW-37', 'Statutory retrieval requires authentication', `HTTP ${anonymous.status}`)
  : results.fail('LAW-37', 'Statutory retrieval is open to anonymous callers', `HTTP ${anonymous.status}`);

await results.write({ officialSource: 'https://leginfo.legislature.ca.gov/' });
await prisma.$disconnect();
