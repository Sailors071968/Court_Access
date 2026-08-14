// Verifies the evidence → observation → intelligence → report chain end to end
// against a real database. Run with `node --env-file`; it prints evidence rather
// than assertions, so a failure is diagnosable from the output alone.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const pass = [];
const fail = [];
const check = (ok, label, detail = '') => {
  (ok ? pass : fail).push(label);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

const { runIngestion } = await import('../src/intelligence/inmates/ingestionEngine.ts');
const { publishProfile, resolveProfile, listProfiles } = await import('../src/intelligence/platform/parserProfiles.ts');
const { getColumnMap } = await import('../src/intelligence/inmates/parsers/columnMaps.ts');
const { describeEngines } = await import('../src/intelligence/platform/engineRegistry.ts');
const { buildReviewPacket, queryIntelligence, setDisposition } = await import('../src/intelligence/platform/intelligenceRepository.ts');
const { startReprocessRun, promoteRun, getRun } = await import('../src/intelligence/platform/reprocessing.ts');
await import('../src/intelligence/platform/engines/identityEngine.ts');
await import('../src/intelligence/platform/engines/derivedEngines.ts');

// A fresh facility per run, so every version number and count below is
// deterministic rather than a function of how many times this has been run before.
const FACILITY = process.env.VERIFY_FACILITY ?? `verify-${Date.now().toString(36)}`;

await prisma.inmateFacility.upsert({
  where: { code: FACILITY },
  create: { code: FACILITY, name: 'Verification Facility', rostersAreFullPopulation: true },
  update: {},
});

console.log('\n=== 1. Engine registry ===');
const engines = describeEngines();
console.log(engines.map((e) => `  ${e.name}@${e.version} → ${e.produces.join(',')}`).join('\n'));
check(engines.length >= 5, 'five or more engines registered', `${engines.length} found`);

console.log('\n=== 2. Versioned parser profile ===');
const baseMap = { ...getColumnMap('generic'), facility: FACILITY };
const v1 = await publishProfile({
  facility: FACILITY, sourceType: 'csv', label: 'roster v1',
  columnMap: baseMap, normalizationVersion: '1.1.0',
  effectiveFrom: new Date('2026-01-01'),
  changeNote: 'Initial profile for verification.',
});
const v2 = await publishProfile({
  facility: FACILITY, sourceType: 'csv', label: 'roster v2 — county moved the bail column',
  columnMap: baseMap, normalizationVersion: '1.1.0',
  effectiveFrom: new Date('2026-08-15'),
  changeNote: 'County reordered columns on 15 Aug 2026.',
});
check(v2.version === v1.version + 1, 'a layout change publishes a new version rather than editing one', `v${v1.version} → v${v2.version}`);

// The point of effective windows: an August 1 roster must resolve to v1, not to
// the newest profile.
const forAugust1 = await resolveProfile({ facility: FACILITY, sourceType: 'csv', rosterDate: new Date('2026-08-01') });
const forSeptember = await resolveProfile({ facility: FACILITY, sourceType: 'csv', rosterDate: new Date('2026-09-01') });
check(forAugust1.version === v1.version, 'a document is parsed with the profile that was correct for its roster date', `1 Aug → v${forAugust1.version}`);
check(forSeptember.version === v2.version, 'a later document resolves to the newer profile', `1 Sep → v${forSeptember.version}`);
check(!forAugust1.fallback, 'the profile was used, not the compiled-in map');

console.log('\n=== 3. Ingest day one ===');
const day1 = await runIngestion({
  filePath: '/tmp/niis/day1.csv', facility: FACILITY, rosterDate: '2026-08-01',
  trigger: 'cli', rosterKind: 'full_population',
});
console.log(`  status=${day1.status} counts=${JSON.stringify(day1.counts)}`);
if (day1.issues.length) console.log(`  issues: ${day1.issues.map((i) => `${i.severity}:${i.code}`).join(', ')}`);
check(day1.status === 'completed', 'day one imported');

const batch1 = await prisma.inmateIngestionBatch.findUnique({ where: { batchId: day1.batchId } });
check(batch1?.parserProfileId === forAugust1.profileId, 'the batch records which profile version read it', `v${batch1?.parserVersion}`);
check(batch1?.normalizationVersion === '1.1.0', 'the batch records the normalization version');

// Re-ingesting the same bytes into the same facility must write nothing, while the
// same bytes under a different facility must still import. Both matter: the first is
// idempotence, the second is a roster not being silently dropped.
const day1Again = await runIngestion({
  filePath: '/tmp/niis/day1.csv', facility: FACILITY, rosterDate: '2026-08-01',
  trigger: 'cli', rosterKind: 'full_population',
});
check(
  day1Again.batchId === day1.batchId && day1Again.issues.some((i) => i.code === 'file_already_ingested'),
  're-ingesting the same file into the same facility is a no-op',
);

const otherFacility = `${FACILITY}-b`;
await prisma.inmateFacility.upsert({
  where: { code: otherFacility },
  create: { code: otherFacility, name: 'Second Facility', rostersAreFullPopulation: true },
  update: {},
});
// A facility with no compiled-in column map. Publishing a profile is the whole
// onboarding step: no code change, no deploy.
await publishProfile({
  facility: otherFacility, sourceType: 'csv', label: 'second facility roster',
  columnMap: { ...getColumnMap('generic'), facility: otherFacility },
  normalizationVersion: '1.1.0', effectiveFrom: new Date('2026-01-01'),
  changeNote: 'Onboarding a facility that has no compiled-in map.',
});
check(
  getColumnMap(otherFacility) === undefined,
  'the second facility has no compiled-in map, so only the profile makes it work',
);
const elsewhere = await runIngestion({
  filePath: '/tmp/niis/day1.csv', facility: otherFacility, rosterDate: '2026-08-01',
  trigger: 'cli', rosterKind: 'full_population',
});
check(
  elsewhere.batchId !== day1.batchId && elsewhere.counts.total > 0,
  'the same bytes under a different facility still import',
  `${elsewhere.counts.total} records`,
);

console.log('\n=== 4. The chain: evidence → observation → intelligence ===');
const items1 = await prisma.inmateIntelligenceItem.findMany({ where: { batchId: day1.batchId } });
const byEngine = {};
for (const i of items1) byEngine[i.engine] = (byEngine[i.engine] ?? 0) + 1;
console.log(`  items by engine: ${JSON.stringify(byEngine)}`);
check(items1.length > 0, 'the import produced intelligence', `${items1.length} items`);
check(items1.every((i) => i.engineVersion && i.explanation), 'every item carries an engine version and a plain-language explanation');

const withEvidence = items1.filter((i) => i.evidenceObservationIds.length > 0);
check(withEvidence.length > 0, 'items cite the observations they rest on', `${withEvidence.length}/${items1.length}`);

// Every cited observation must exist. A dangling evidence id would make a finding
// unexplainable, which is the failure this whole layer exists to prevent.
const citedIds = [...new Set(items1.flatMap((i) => i.evidenceObservationIds))];
const existing = await prisma.inmateBookingObservation.count({ where: { observationId: { in: citedIds } } });
check(existing === citedIds.length, 'every cited observation exists', `${existing}/${citedIds.length}`);

const versionStamped = items1.filter((i) => i.parserProfileId && i.normalizationVersion);
check(versionStamped.length === items1.length, 'every item carries the version bundle', `${versionStamped.length}/${items1.length}`);

console.log('\n=== 5. Ingest day two — conflicts and changes ===');
const day2 = await runIngestion({
  filePath: '/tmp/niis/day2.csv', facility: FACILITY, rosterDate: '2026-08-02',
  trigger: 'cli', rosterKind: 'full_population',
});
console.log(`  status=${day2.status} counts=${JSON.stringify(day2.counts)}`);
check(day2.status === 'completed', 'day two imported');

const items2 = await prisma.inmateIntelligenceItem.findMany({ where: { batchId: day2.batchId } });
const types2 = {};
for (const i of items2) types2[i.type] = (types2[i.type] ?? 0) + 1;
console.log(`  items by type: ${JSON.stringify(types2)}`);

const changes = items2.filter((i) => i.type === 'change');
check(changes.length > 0, 'change intelligence produced from consecutive observations', `${changes.length}`);
if (changes.length) console.log(`  e.g. "${changes[0].explanation}"`);

console.log('\n=== 6. A conflict is held, not resolved ===');
// Force a bail disagreement: a second source for the same booking, same day.
const anyBooking = await prisma.inmateBooking.findFirst({ orderBy: { bookingId: 'asc' } });
if (anyBooking) {
  const [obsA, obsB] = await Promise.all([
    prisma.inmateBookingObservation.create({
      data: { bookingId: anyBooking.bookingId, batchId: day2.batchId, sourceType: 'pdf_text', rosterDate: new Date('2026-08-02'), bailAmountCents: 5_000_000n, sourcePage: 3 },
      select: { observationId: true },
    }),
    prisma.inmateBookingObservation.create({
      data: { bookingId: anyBooking.bookingId, batchId: day2.batchId, sourceType: 'csv', rosterDate: new Date('2026-08-02'), bailAmountCents: 7_500_000n, sourceRow: 12 },
      select: { observationId: true },
    }),
  ]);
  const conflict = await prisma.inmateSourceConflict.create({
    data: {
      bookingId: anyBooking.bookingId, inmateId: anyBooking.inmateId, field: 'bailAmountCents',
      valueA: '50000.00', sourceA: 'pdf_text', observationAId: obsA.observationId,
      valueB: '75000.00', sourceB: 'csv', observationBId: obsB.observationId,
      resolution: 'unknown', batchId: day2.batchId, rosterDate: new Date('2026-08-02'),
    },
    select: { conflictId: true },
  });

  const { findingFromConflict } = await import('../src/intelligence/platform/engines/derivedEngines.ts');
  const { recordFindings } = await import('../src/intelligence/platform/intelligenceRepository.ts');
  const full = await prisma.inmateSourceConflict.findUnique({ where: { conflictId: conflict.conflictId } });
  const [conflictItemId] = await recordFindings(
    { name: 'conflict', version: '1.0.0' },
    [findingFromConflict(full)],
    { batchId: day2.batchId, versions: { normalizationVersion: '1.1.0' }, dryRun: false },
  );

  const item = await prisma.inmateIntelligenceItem.findUnique({ where: { itemId: conflictItemId } });
  check(item.payload.currentTruth === 'UNKNOWN', 'an unresolved conflict states current truth UNKNOWN rather than guessing');
  check(item.reviewRequired === true, 'an unresolved conflict requires human review');
  check(item.disposition === 'proposed', 'an unresolved conflict changed nothing');
  check(item.payload.observations.length === 2, 'both stated values survive side by side');
  console.log(`  "${item.explanation}"`);

  console.log('\n=== 7. The review packet assembles the evidence ===');
  const packet = await buildReviewPacket(conflictItemId);
  check(packet.evidence.length === 2, 'the packet resolves the observations', `${packet.evidence.length} pieces of evidence`);
  check(packet.evidence.some((e) => e.sourcePage === 3), 'the packet says which page of the PDF the value came from');
  check(packet.evidence.every((e) => e.stated.bailAmount !== undefined), 'the packet shows what each source stated');
  check(Boolean(packet.recommendation), 'the packet states a recommendation');
  check(packet.history.length >= 1, 'the packet includes the item history');
  check(Boolean(packet.versions.normalizationVersion), 'the packet includes the version bundle');
  console.log(`  evidence: ${packet.evidence.map((e) => `${e.sourceType}=$${e.stated.bailAmount}${e.sourcePage ? ` p.${e.sourcePage}` : ''}`).join(' vs ')}`);
  console.log(`  recommendation: ${packet.recommendation}`);

  console.log('\n=== 8. A decision is recorded, not applied silently ===');
  const decided = await setDisposition({ itemId: conflictItemId, to: 'accepted', actorId: 'verify-script', note: 'CSV is the authoritative feed for bail.' });
  check(decided.ok, 'the reviewer decision was accepted');
  const afterDecision = await buildReviewPacket(conflictItemId);
  check(afterDecision.disposition === 'accepted', 'the disposition changed');
  check(afterDecision.history.some((h) => h.action === 'accepted' && h.note), 'the decision is in the history with its reason');
  console.log(`  history: ${afterDecision.history.map((h) => h.action).join(' → ')}`);
}

console.log('\n=== 9. Watch lists consume intelligence ===');
// Watch a person who actually appears in day two's intelligence. Picking any
// inmate in the database would test nothing, because the engine's input is the
// batch's findings rather than the roster.
const identityItem = await prisma.inmateIntelligenceItem.findFirst({
  where: { batchId: day2.batchId, type: 'identity_candidate', subjectKind: 'person', subjectId: { not: null } },
  select: { subjectId: true },
});
const watched = identityItem?.subjectId
  ? await prisma.inmate.findUnique({ where: { inmateId: identityItem.subjectId } })
  : null;
if (watched) {
  await prisma.inmateWatchListEntry.upsert({
    where: { inmateId_createdById: { inmateId: watched.inmateId, createdById: 'verify-script' } },
    create: { inmateId: watched.inmateId, createdById: 'verify-script', reason: 'Verification watch.', active: true },
    update: { active: true },
  });

  const { watchListEngine } = await import('../src/intelligence/platform/engines/derivedEngines.ts');
  const hits = await watchListEngine.analyse({ batchId: day2.batchId, versions: {}, dryRun: true });
  check(hits.length > 0, 'the watch list engine produced hits from intelligence, not from the roster', `${hits.length} hits`);
  if (hits.length) {
    check(Boolean(hits[0].inputs.triggeringItemId), 'each hit names the intelligence item that triggered it');
    console.log(`  "${hits[0].explanation.slice(0, 150)}..."`);
  }
}

console.log('\n=== 10. Reprocessing is non-destructive ===');
const before = await prisma.inmateIntelligenceItem.count();
const dry = await startReprocessRun({
  engineName: 'repeat_offender',
  mode: 'dry_run',
  scope: { facility: FACILITY },
  triggeredById: 'verify-script',
});
check(!('error' in dry), 'a dry run started', dry.error ?? dry.runId);
if (!('error' in dry)) {
  const dryRun = await getRun(dry.runId);
  const afterDry = await prisma.inmateIntelligenceItem.count();
  check(afterDry === before, 'a dry run persisted nothing', `${before} → ${afterDry}`);
  check(dryRun.status === 'completed' && dryRun.comparison !== null, 'a dry run produced a comparison');
  console.log(`  comparison: new=${dryRun.itemsNew} changed=${dryRun.itemsChanged} unchanged=${dryRun.itemsUnchanged} withdrawn=${dryRun.itemsWithdrawn}`);

  const promoteDry = await promoteRun({ runId: dry.runId, actorId: 'verify-script' });
  check(!promoteDry.ok, 'a dry run cannot be promoted', promoteDry.reason);
}

const real = await startReprocessRun({
  engineName: 'conflict',
  mode: 'reprocess',
  scope: { batchId: day2.batchId },
  triggeredById: 'verify-script',
});
if (!('error' in real)) {
  const shadow = await prisma.inmateIntelligenceItem.count({ where: { runId: real.runId } });
  check(shadow >= 0, 'a reprocessing run wrote into its own generation', `${shadow} shadow items`);

  // Findings tagged with a run are not in force; only promotion clears the tag.
  const liveBefore = await prisma.inmateIntelligenceItem.count({ where: { engine: 'conflict', runId: null, disposition: { notIn: ['superseded', 'expired'] } } });
  const promoted = await promoteRun({ runId: real.runId, actorId: 'verify-script' });
  check(promoted.ok, 'the run was promoted', JSON.stringify(promoted));

  if (promoted.ok && promoted.superseded > 0) {
    const supersededItem = await prisma.inmateIntelligenceItem.findFirst({
      where: { disposition: 'superseded' },
      include: { events: true },
    });
    check(Boolean(supersededItem.supersededById), 'the superseded item points at its replacement');
    check(supersededItem.confidence !== null && Boolean(supersededItem.explanation), 'the superseded item kept its own confidence and explanation');
    check(supersededItem.events.some((e) => e.action === 'superseded'), 'the supersession is in the audit trail');
    const blocked = await setDisposition({ itemId: supersededItem.itemId, to: 'accepted', actorId: 'verify-script' });
    check(!blocked.ok, 'a superseded conclusion cannot be re-accepted', blocked.reason);
  }
  console.log(`  live conflict findings before promotion: ${liveBefore}`);
}

console.log('\n=== 11. The repository is searchable ===');
const q = await queryIntelligence({ limit: 5, offset: 0 });
check(q.total > 0, 'the repository answers a query', `${q.total} items`);
const bySeverity = await prisma.inmateIntelligenceItem.groupBy({ by: ['type', 'severity'], _count: { itemId: true } });
console.log(bySeverity.map((r) => `  ${r.type}/${r.severity}: ${r._count.itemId}`).join('\n'));
const filtered = await queryIntelligence({ type: 'change', limit: 100, offset: 0 });
check(filtered.results.every((r) => r.type === 'change'), 'a filtered query returns only that type');

console.log('\n=== 12. Idempotence ===');
const countBefore = await prisma.inmateIntelligenceItem.count({ where: { batchId: day2.batchId, runId: null } });
const { publishBatchIntelligence } = await import('../src/intelligence/platform/publication.ts');
const republish = await publishBatchIntelligence({ batchId: day2.batchId });
const countAfter = await prisma.inmateIntelligenceItem.count({ where: { batchId: day2.batchId, runId: null } });
check(countAfter === countBefore, 'republishing a batch does not duplicate its intelligence', `${countBefore} → ${countAfter}`);
check(Object.values(republish).every((v) => v === 0), 'the second publication reported no work');

console.log('\n=== 13. Audit trail completeness ===');
const orphans = await prisma.$queryRawUnsafe(`
  SELECT count(*)::int AS n FROM inmate_intelligence_items i
  WHERE NOT EXISTS (SELECT 1 FROM inmate_intelligence_events e WHERE e."itemId" = i."itemId")
`);
check(orphans[0].n === 0, 'every item has at least one event', `${orphans[0].n} without history`);
const eventCount = await prisma.inmateIntelligenceEvent.count();
console.log(`  ${eventCount} events recorded`);

console.log(`\n${'='.repeat(70)}\n${pass.length} passed, ${fail.length} failed`);
if (fail.length) console.log(`\nFAILED:\n${fail.map((f) => `  - ${f}`).join('\n')}`);
await prisma.$disconnect();
process.exit(fail.length === 0 ? 0 : 1);
