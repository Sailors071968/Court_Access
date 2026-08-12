// ============================================================================
// Deduplication.
//
// Two different jobs that are easy to conflate:
//
//   Booking-level — the same arrest arriving twice, because rosters are
//   cumulative and the same file gets ingested again. Handled by a content hash
//   with a unique constraint, so re-ingesting is a no-op rather than a doubling.
//
//   Person-level — the same human appearing under two spellings. That is
//   identityResolution.ts, not this file.
//
// The hash covers the *normalized* booking identity, not the raw line. Column
// order, whitespace and letter case change between exports of the same roster,
// so hashing the line would make every re-export look like new arrests.
// ============================================================================

import { createHash } from 'node:crypto';

import type { NormalizedRecord } from './types.js';

/**
 * The identity of a booking.
 *
 * When the facility supplies its own booking number that is authoritative, and
 * the person is deliberately excluded: a roster that corrects a misspelled name
 * on an existing booking must update it, not create a second one.
 *
 * Without a booking number, the identity falls back to facility, booking date
 * and the normalized person — which is why the date is truncated to the day.
 * The same booking exported twice often carries different times, and treating
 * those as separate arrests would be wrong in the direction that inflates the
 * new-inmate report.
 */
export function bookingContentHash(record: NormalizedRecord): string {
  const parts = record.externalBookingId
    ? [record.facility, 'ext', record.externalBookingId]
    : [
        record.facility,
        'identity',
        record.bookedAt.slice(0, 10),
        record.last,
        record.first,
        record.middle ?? '',
        record.dateOfBirth ?? '',
      ];

  return createHash('sha256').update(parts.join('\u0000').toUpperCase()).digest('hex');
}

/**
 * Collapse rows that are the same booking within a single file.
 *
 * Rosters repeat a person once per charge, so a booking with four charges
 * arrives as four rows. Those are one booking with four charges, and merging
 * them here means identity resolution runs once per booking instead of four
 * times with three of them landing as duplicates.
 */
export function collapseWithinBatch(
  records: { lineNumber: number; record: NormalizedRecord }[],
): { lineNumber: number; record: NormalizedRecord; mergedLines: number[] }[] {
  const byHash = new Map<string, { lineNumber: number; record: NormalizedRecord; mergedLines: number[] }>();

  for (const entry of records) {
    const hash = bookingContentHash(entry.record);
    const existing = byHash.get(hash);

    if (!existing) {
      byHash.set(hash, { ...entry, mergedLines: [] });
      continue;
    }

    existing.mergedLines.push(entry.lineNumber);

    // Union the charges, keyed on raw text so a genuinely repeated charge with
    // a different count is kept and an identical repeat is not.
    const seen = new Set(existing.record.charges.map((c) => c.rawText));
    for (const charge of entry.record.charges) {
      if (!seen.has(charge.rawText)) {
        existing.record.charges.push(charge);
        seen.add(charge.rawText);
      }
    }

    // Prefer whichever row carries more information about the person. Later rows
    // of the same booking sometimes omit fields the first one had.
    existing.record.dateOfBirth ??= entry.record.dateOfBirth;
    existing.record.middle ??= entry.record.middle;
    existing.record.race ??= entry.record.race;
    existing.record.releasedAt ??= entry.record.releasedAt;
    existing.record.housingLocation ??= entry.record.housingLocation;
    existing.record.arrestingAgency ??= entry.record.arrestingAgency;
    if (existing.record.sex === 'unknown' && entry.record.sex) existing.record.sex = entry.record.sex;
  }

  return [...byHash.values()].sort((a, b) => a.lineNumber - b.lineNumber);
}
