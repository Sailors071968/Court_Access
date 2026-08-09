// Registers Sacramento County and publishes its parser profiles.
//
// Idempotent: safe to run on every deploy. The profile is only published when none
// exists, because publishing again would create a second version and close the
// first one's effective window — which would misdescribe how already-imported
// documents were read.

import prisma from '../src/lib/prisma.js';
import { NORMALIZATION_VERSION } from '../src/intelligence/inmates/normalization.js';
import { getColumnMap } from '../src/intelligence/inmates/parsers/columnMaps.js';
import { listProfiles, publishProfile } from '../src/intelligence/platform/parserProfiles.js';

const FACILITY = 'sacramento';

const facility = await prisma.inmateFacility.upsert({
  where: { code: FACILITY },
  create: {
    code: FACILITY,
    name: 'Sacramento County Jail',
    county: 'Sacramento',
    // The published roster lists everyone in custody, which is what allows a
    // departure to be inferred from an absence.
    rostersAreFullPopulation: true,
    active: true,
    notes: 'Main Jail and Rio Cosumnes Correctional Center. Version 1 scope.',
  },
  update: { active: true },
});
console.log(`facility: ${facility.code} (${facility.name})`);

const columnMap = getColumnMap(FACILITY);
if (!columnMap) {
  console.error(`No compiled-in column map for "${FACILITY}". Add one to columnMaps.ts first.`);
  process.exit(1);
}

for (const sourceType of ['csv', 'pdf_text'] as const) {
  const existing = (await listProfiles(FACILITY)).filter((p) => p.sourceType === sourceType);
  if (existing.length > 0) {
    console.log(`profile: ${FACILITY}/${sourceType} already at v${existing[0].version} — left alone`);
    continue;
  }

  const created = await publishProfile({
    facility: FACILITY,
    sourceType,
    label: `Sacramento County — ${sourceType === 'csv' ? 'roster CSV' : 'roster PDF'} v1`,
    columnMap,
    normalizationVersion: NORMALIZATION_VERSION,
    // Open-ended: this is the first profile, so it applies to any roster date until
    // a layout change closes it.
    effectiveFrom: new Date('2020-01-01'),
    changeNote: 'Initial profile, written against the published roster header set. Correct against a real export rather than adding parser fallbacks.',
  });
  console.log(`profile: ${FACILITY}/${sourceType} published as v${created.version}`);
}

await prisma.$disconnect();
