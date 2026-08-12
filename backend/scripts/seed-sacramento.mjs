#!/usr/bin/env node
// Idempotent Sacramento facility + parser profile seed for production deploys.
// Uses PrismaClient only — no TypeScript source tree required on the host.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

function databaseUrlFromEnvFile() {
  for (const candidate of [process.env.ENV_FILE, '.env'].filter(Boolean)) {
    try {
      const text = readFileSync(resolve(candidate), 'utf8');
      for (const line of text.split('\n')) {
        const match = /^\s*DATABASE_URL\s*=\s*(.*)\s*$/.exec(line);
        if (match) {
          let value = match[1].trim();
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          return value;
        }
      }
    } catch {
      // try next candidate
    }
  }
  return process.env.DATABASE_URL;
}

const DATABASE_URL = databaseUrlFromEnvFile();
if (!DATABASE_URL) {
  console.error('DATABASE_URL missing from .env');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
const FACILITY = 'sacramento';
const NORMALIZATION_VERSION = '1.1.0';

const SACRAMENTO_FIELDS = {
  fullName: ['name', 'inmate name', 'inmate', 'defendant name', 'full name'],
  last: ['last name', 'last', 'lastname', 'surname'],
  first: ['first name', 'first', 'firstname'],
  middle: ['middle name', 'middle', 'mi', 'middle initial'],
  suffix: ['suffix', 'sfx'],
  dateOfBirth: ['dob', 'date of birth', 'birth date', 'birthdate'],
  sex: ['sex', 'gender'],
  race: ['race', 'ethnicity', 'descent'],
  externalBookingId: [
    'booking number', 'booking #', 'booking no', 'bkg #', 'bkg no',
    'registry number', 'registry #', 'book #', 'booking id',
  ],
  externalPersonId: [
    'x-ref', 'xref', 'x ref', 'x-ref number', 'xref number',
    'so #', 'so number', 'main id', 'subject number', 'inmate #',
  ],
  bookedAt: [
    'booking date', 'booking date and time', 'booking date/time', 'booked',
    'book date', 'intake date', 'arrest date', 'date booked',
  ],
  releasedAt: ['release date', 'released', 'release date/time', 'actual release'],
  projectedReleaseAt: [
    'projected release date', 'projected release', 'expected release',
    'scheduled release', 'proj release',
  ],
  arrestingAgency: ['arresting agency', 'agency', 'arr agency', 'law enforcement agency'],
  arrestType: ['type of arrest', 'arrest type', 'arrest reason'],
  bailAmount: ['bail', 'bail amount', 'total bail', 'bond', 'bond amount'],
  housingLocation: ['housing location', 'housing', 'location', 'cell', 'pod', 'unit', 'bed'],
  charges: ['charges', 'charge', 'charge description', 'offense', 'offenses', 'charge(s)'],
  courtDate: ['next court date', 'court date', 'court appearance', 'arraignment date'],
  courtName: ['court', 'court name', 'hearing court', 'court location'],
  outstandingWarrants: ['outstanding warrants', 'warrants', 'holds', 'warrant'],
  height: ['height', 'ht'],
  weight: ['weight', 'wt'],
};

const PROFILES = [
  {
    facility: FACILITY,
    sourceType: 'csv',
    label: 'Sacramento County Main Jail — CSV export',
    effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
    changeNote:
      'Initial profile. Field vocabulary from the Sheriff\'s published description of the roster; header spellings are candidates until a real export is available. Correct by publishing v2, not by editing this.',
    expectedHeaders: [
      'Booking Number', 'X-Ref', 'Last Name', 'First Name', 'Middle Name',
      'DOB', 'Sex', 'Height', 'Weight',
      'Booking Date', 'Arresting Agency', 'Type of Arrest',
      'Facility', 'Housing Location', 'Charges', 'Bail',
      'Outstanding Warrants', 'Projected Release Date', 'Next Court Date', 'Court',
    ],
    columnMap: {
      facility: FACILITY,
      label: 'Sacramento County Main Jail — CSV export',
      dateFormats: ['mm/dd/yyyy', 'iso', 'yyyy-mm-dd'],
      nameOrder: 'last_first',
      chargeSeparator: ';',
      fields: SACRAMENTO_FIELDS,
    },
    normalizationRules: [
      'Names uppercased; punctuation removed for matching, preserved for display.',
      'Dates parsed as mm/dd/yyyy first, then ISO. An unparseable date of birth is left absent rather than guessed.',
      'Bail parsed to integer cents. "NO BAIL" and "PC 1275" are recorded as absent, not zero — no bail set and bail of zero are different facts.',
      'Height parsed to inches from feet-and-inches or packed notation; refused outside 24–96 inches.',
      'Weight parsed to pounds; refused outside 50–700.',
      'Charges split on ";" then parsed for statute, section and severity.',
      'Outstanding warrants: only recognised yes/no values become a boolean; anything else stays absent.',
      'Projected release date recorded separately from an actual release date.',
    ],
    validationRules: {
      requiredFields: ['bookedAt'],
      expectedCoverage: [
        { field: 'externalBookingId', minimumPercent: 80 },
        { field: 'last', minimumPercent: 95 },
        { field: 'dateOfBirth', minimumPercent: 70 },
        { field: 'externalPersonId', minimumPercent: 60 },
        { field: 'charges', minimumPercent: 70 },
      ],
      minimumRows: 5,
      maximumRowFailurePercent: 10,
      unmappedHeadersAreErrors: false,
    },
  },
  {
    facility: FACILITY,
    sourceType: 'pdf_text',
    label: 'Sacramento County Main Jail — PDF roster',
    effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
    changeNote:
      'Initial profile. The PDF is a paginated listing, not a table; layout is inferred per page. Expect to publish v2 once a real roster is available.',
    expectedHeaders: [
      'BOOKING', 'NAME', 'DOB', 'SEX', 'BOOKED', 'HOUSING', 'CHARGES', 'BAIL',
    ],
    columnMap: {
      facility: FACILITY,
      label: 'Sacramento County Main Jail — PDF roster',
      dateFormats: ['mm/dd/yyyy', 'iso'],
      nameOrder: 'last_first',
      chargeSeparator: ';',
      fields: SACRAMENTO_FIELDS,
    },
    normalizationRules: [
      'Same rules as the CSV profile — normalization is a property of the field, not the document.',
      'Page and row are recorded on every observation, so a value traces to a place in the PDF.',
      'OCR is used only when the page has no text layer, and the source type is recorded as pdf_ocr so the weaker provenance is visible.',
    ],
    validationRules: {
      requiredFields: ['bookedAt'],
      expectedCoverage: [
        { field: 'last', minimumPercent: 85 },
        { field: 'externalBookingId', minimumPercent: 60 },
        { field: 'dateOfBirth', minimumPercent: 50 },
      ],
      minimumRows: 5,
      maximumRowFailurePercent: 25,
      unmappedHeadersAreErrors: false,
    },
  },
];

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function publishIfMissing(profile) {
  const existing = await prisma.inmateParserProfile.findFirst({
    where: { facility: profile.facility, sourceType: profile.sourceType },
    orderBy: { version: 'desc' },
  });
  if (existing) {
    console.log(`profile: ${profile.facility}/${profile.sourceType} already at v${existing.version} — left alone`);
    return;
  }

  const version = 1;
  const effectiveFrom = startOfUtcDay(profile.effectiveFrom);
  const created = await prisma.inmateParserProfile.create({
    data: {
      facility: profile.facility,
      sourceType: profile.sourceType,
      version,
      label: profile.label,
      columnMap: profile.columnMap,
      parseOptions: {},
      normalizationVersion: NORMALIZATION_VERSION,
      expectedHeaders: profile.expectedHeaders,
      normalizationRules: profile.normalizationRules,
      validationRules: profile.validationRules,
      effectiveFrom,
      changeNote: profile.changeNote,
      active: true,
    },
    select: { profileId: true, version: true },
  });
  console.log(
    `profile: ${profile.facility}/${profile.sourceType} published as v${created.version}` +
      ` — ${profile.expectedHeaders.length} expected headers`,
  );
}

const facility = await prisma.inmateFacility.upsert({
  where: { code: FACILITY },
  create: {
    code: FACILITY,
    name: 'Sacramento County Main Jail',
    county: 'Sacramento',
    rostersAreFullPopulation: true,
    active: true,
    notes:
      'Main Jail (651 I Street) and Rio Cosumnes Correctional Center. Phase 2 scope: Sacramento only.',
  },
  update: {
    active: true,
    name: 'Sacramento County Main Jail',
    county: 'Sacramento',
  },
});
console.log(`facility: ${facility.code} (${facility.name})`);

for (const profile of PROFILES) {
  await publishIfMissing(profile);
}

const profiles = await prisma.inmateParserProfile.findMany({
  where: { facility: FACILITY },
  select: { sourceType: true, version: true, active: true },
  orderBy: [{ sourceType: 'asc' }, { version: 'desc' }],
});
console.log('seed complete:', JSON.stringify({ facility: facility.code, profiles }));

await prisma.$disconnect();
