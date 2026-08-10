// Registers Sacramento County and publishes its parser profiles.
//
// Idempotent: safe on every deploy. A profile is only published when none exists for
// that source, because publishing again creates a version and closes the previous
// one's effective window — which would misdescribe how already-imported documents
// were read.
//
// To correct a profile, publish the next version through the administrative route or
// by bumping `version` in parsers/sacramento.ts. Never by editing a published row.

import prisma from '../src/lib/prisma.js';
import { NORMALIZATION_VERSION } from '../src/intelligence/inmates/normalization.js';
import { SACRAMENTO_PROFILES } from '../src/intelligence/inmates/parsers/sacramento.js';
import { listProfiles, normaliseEffectiveWindows, publishProfile } from '../src/intelligence/platform/parserProfiles.js';

const FACILITY = 'sacramento';

const facility = await prisma.inmateFacility.upsert({
  where: { code: FACILITY },
  create: {
    code: FACILITY,
    name: 'Sacramento County Main Jail',
    county: 'Sacramento',
    // The published roster lists everyone in custody, which is what allows a
    // departure to be inferred from an absence.
    rostersAreFullPopulation: true,
    active: true,
    notes: 'Main Jail (651 I Street) and Rio Cosumnes Correctional Center. Phase 2 scope: Sacramento only.',
  },
  update: { active: true, name: 'Sacramento County Main Jail', county: 'Sacramento' },
});
console.log(`facility: ${facility.code} (${facility.name})`);

// Repair any effective window written before they were day-granular. A version
// published at 22:41 used to leave that whole day uncovered, so a roster dated in the
// gap imported under the compiled-in map. Idempotent.
const repair = await normaliseEffectiveWindows();
if (repair.repaired > 0) {
  console.log(`windows: normalised ${repair.repaired} of ${repair.examined} effective window(s) to day boundaries`);
}

const existing = await listProfiles(FACILITY);

for (const profile of SACRAMENTO_PROFILES) {
  const already = existing.filter((p) => p.sourceType === profile.sourceType);
  if (already.length > 0) {
    console.log(`profile: ${FACILITY}/${profile.sourceType} already at v${already[0].version} — left alone`);
    continue;
  }

  const created = await publishProfile({
    facility: profile.facility,
    sourceType: profile.sourceType,
    label: profile.label,
    columnMap: profile.columnMap,
    normalizationVersion: NORMALIZATION_VERSION,
    expectedHeaders: profile.expectedHeaders,
    normalizationRules: profile.normalizationRules,
    validationRules: profile.validation,
    effectiveFrom: new Date(profile.effectiveFrom),
    changeNote: profile.changeNote,
  });

  console.log(
    `profile: ${FACILITY}/${profile.sourceType} published as v${created.version}` +
    ` — ${profile.expectedHeaders.length} expected headers,` +
    ` ${profile.validation.requiredFields.length} required field(s),` +
    ` ${profile.validation.expectedCoverage.length} coverage rule(s)`,
  );
}

await prisma.$disconnect();
