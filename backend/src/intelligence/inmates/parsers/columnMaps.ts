// ============================================================================
// Per-facility column maps.
//
// Jail exports differ per facility and change without notice. Driving the parser
// from a descriptor rather than hardcoded column positions means a changed export
// fails the batch naming the columns it could not place, instead of importing a
// roster full of nulls that looks like a quiet day at the jail.
//
// The maps here are starting points written against the fields these exports are
// known to carry. They are expected to be corrected against real sample files —
// which is why an unrecognised header set is a hard failure and `--dry-run`
// exists.
// ============================================================================

import { SACRAMENTO_CSV } from './sacramento.js';
import type { ColumnMap } from '../types.js';

/** Fields a roster must supply for a row to become a booking. */
export const REQUIRED_FIELDS = ['bookedAt'] as const;

const GENERIC: ColumnMap = {
  facility: 'generic',
  label: 'Generic county roster (best-effort header matching)',
  nameOrder: 'last_first',
  dateFormats: ['iso', 'mm/dd/yyyy', 'yyyy-mm-dd'],
  chargeSeparator: ';',
  fields: {
    fullName: ['name', 'inmate name', 'inmate', 'full name', 'defendant'],
    first: ['first', 'first name', 'firstname', 'given name', 'fname'],
    last: ['last', 'last name', 'lastname', 'surname', 'lname'],
    middle: ['middle', 'middle name', 'middlename', 'mi', 'middle initial'],
    suffix: ['suffix', 'sfx'],
    dateOfBirth: ['dob', 'date of birth', 'birth date', 'birthdate', 'born'],
    sex: ['sex', 'gender'],
    race: ['race', 'ethnicity'],
    externalBookingId: ['booking #', 'booking number', 'booking no', 'booking id', 'bookingid', 'book #'],
    externalPersonId: ['so #', 'so number', 'sonumber', 'inmate #', 'inmate number', 'inmate id',
                       'person id', 'personid', 'pin', 'cii', 'mni', 'subject number'],
    bookedAt: ['booking date', 'booked', 'book date', 'arrest date', 'date booked', 'booking date/time'],
    releasedAt: ['release date', 'released', 'release date/time'],
    arrestingAgency: ['agency', 'arresting agency', 'arr agency'],
    bailAmount: ['bail', 'bail amount', 'bond', 'bond amount'],
    housingLocation: ['housing', 'location', 'cell', 'pod', 'housing location'],
    charges: ['charges', 'charge', 'offense', 'offenses', 'charge description'],
  },
};

/**
 * A facility whose export splits the name and writes dates as mm/dd/yyyy.
 * Registered as a worked example of overriding the generic map; replace with the
 * real headers once a sample file exists.
 */
const EXAMPLE_COUNTY: ColumnMap = {
  ...GENERIC,
  facility: 'example-county',
  label: 'Example County Jail — daily roster CSV',
  dateFormats: ['mm/dd/yyyy', 'iso'],
  nameOrder: 'last_first',
  chargeSeparator: '|',
  fields: {
    ...GENERIC.fields,
    last: ['LastName'],
    first: ['FirstName'],
    middle: ['MiddleName'],
    dateOfBirth: ['DOB'],
    externalBookingId: ['BookingNumber'],
    externalPersonId: ['SONumber'],
    bookedAt: ['BookingDate'],
    releasedAt: ['ReleaseDate'],
    charges: ['Charges'],
    bailAmount: ['BailAmount'],
    arrestingAgency: ['ArrestingAgency'],
  },
};


/**
 * Sacramento County.
 *
 * Taken from the CSV profile in sacramento.ts rather than written again here, so the
 * compiled-in fallback and the published profile cannot describe different columns.
 */
const SACRAMENTO: ColumnMap = SACRAMENTO_CSV.columnMap;

const MAPS = new Map<string, ColumnMap>([
  [GENERIC.facility, GENERIC],
  [SACRAMENTO.facility, SACRAMENTO],
  [EXAMPLE_COUNTY.facility, EXAMPLE_COUNTY],
]);

export function getColumnMap(facility: string): ColumnMap | undefined {
  return MAPS.get(facility);
}

export function listColumnMaps(): { facility: string; label: string }[] {
  return [...MAPS.values()].map((m) => ({ facility: m.facility, label: m.label }));
}

/**
 * Which of a file's headers the map cannot place, and whether the ones a booking
 * needs are present.
 *
 * Unmapped headers are reported but do not fail a batch: rosters carry columns
 * this system has no use for. A missing *required* field does fail it, because
 * every row would be rejected for the same reason and reporting that once is
 * more useful than reporting it a thousand times.
 */
export function inspectHeaders(headers: string[], map: ColumnMap): {
  unmapped: string[];
  missingRequired: string[];
  resolved: Record<string, string>;
} {
  const known = new Map<string, string>();
  for (const [field, candidates] of Object.entries(map.fields)) {
    for (const candidate of candidates ?? []) known.set(candidate.trim().toLowerCase(), field);
  }

  const unmapped: string[] = [];
  const resolved: Record<string, string> = {};
  for (const header of headers) {
    const field = known.get(header.trim().toLowerCase());
    if (field) resolved[field] = header;
    else unmapped.push(header);
  }

  const hasName = Boolean(resolved.fullName || resolved.last);
  const missingRequired = REQUIRED_FIELDS.filter((f) => !resolved[f]);
  if (!hasName) missingRequired.push('name' as never);

  return { unmapped, missingRequired, resolved };
}
