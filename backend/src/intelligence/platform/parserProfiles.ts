// ============================================================================
// Versioned parser profiles.
//
// A county changes its CSV layout without notice, and a scanned PDF's OCR quality
// depends on which engine version read it. Both of those are provenance, not
// configuration: two years from now the question "why does this record say the bail
// was $500" may have the answer "because version 3 of the profile mapped the wrong
// column, and version 4 fixed it".
//
// So a profile is a row with a version, never an edit. A layout change is a new
// version with an effective date; the old version stays exactly as it was, because
// it is the only accurate description of how last year's documents were read.
//
// The column map lives in the database as data rather than in code as a constant.
// That is what allows a historical document to be re-parsed with the profile that
// was correct for it, which is the requirement this exists to satisfy.
// ============================================================================

import prisma from '../../lib/prisma.js';
import { getColumnMap } from '../inmates/parsers/columnMaps.js';
import type { ColumnMap } from '../inmates/types.js';

export type SourceType = 'csv' | 'pdf_text' | 'pdf_ocr';

export interface ResolvedProfile {
  profileId: string | null;
  facility: string;
  sourceType: SourceType;
  version: number | null;
  label: string;
  /** Undefined only in the fallback case for a facility with no compiled-in map
   *  either, which ingestion rejects rather than guessing at a layout. */
  columnMap: ColumnMap | undefined;
  parseOptions: Record<string, unknown>;
  normalizationVersion: string | null;
  ocrVersion: string | null;
  /** True when no stored profile applied and the compiled-in map was used. Recorded
   *  rather than hidden: a document parsed without a profile has weaker provenance
   *  than one parsed with a versioned profile, and an operator should be able to
   *  find those documents later. */
  fallback: boolean;
}

/**
 * The profile that applies to a document.
 *
 * Chosen by roster date rather than by "latest", because a document from March must
 * be read with March's profile even if the layout changed in June. Falling back to
 * the compiled-in column map keeps ingestion working for a facility nobody has
 * created a profile for yet, and marks the result so the gap is visible.
 */
export async function resolveProfile(args: {
  facility: string;
  sourceType: SourceType;
  rosterDate?: Date | null;
}): Promise<ResolvedProfile> {
  const asOf = args.rosterDate ?? new Date();

  const candidates = await prisma.inmateParserProfile.findMany({
    where: {
      facility: args.facility,
      sourceType: args.sourceType,
      active: true,
      AND: [
        { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: asOf } }] },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }] },
      ],
    },
    // Highest version whose window contains the date. Two overlapping windows is a
    // configuration mistake; taking the highest version makes the outcome
    // deterministic rather than dependent on insertion order.
    orderBy: { version: 'desc' },
    take: 1,
  });

  const profile = candidates[0];
  if (!profile) {
    return {
      profileId: null,
      facility: args.facility,
      sourceType: args.sourceType,
      version: null,
      label: `compiled-in default for ${args.facility}`,
      columnMap: getColumnMap(args.facility),
      parseOptions: {},
      normalizationVersion: null,
      ocrVersion: null,
      fallback: true,
    };
  }

  return {
    profileId: profile.profileId,
    facility: profile.facility,
    sourceType: profile.sourceType as SourceType,
    version: profile.version,
    label: profile.label,
    columnMap: profile.columnMap as unknown as ColumnMap,
    parseOptions: (profile.parseOptions ?? {}) as Record<string, unknown>,
    normalizationVersion: profile.normalizationVersion,
    ocrVersion: profile.ocrVersion,
    fallback: false,
  };
}

/**
 * Add a version of a profile.
 *
 * Always a new version, never an update. The previous version's effective window is
 * closed the day before this one opens, so the two do not overlap and every
 * historical date resolves to exactly one profile.
 */
export async function publishProfile(args: {
  facility: string;
  sourceType: SourceType;
  label: string;
  columnMap: ColumnMap;
  parseOptions?: Record<string, unknown>;
  normalizationVersion?: string;
  ocrVersion?: string;
  effectiveFrom?: Date;
  changeNote: string;
  createdById?: string;
}): Promise<{ profileId: string; version: number }> {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.inmateParserProfile.findFirst({
      where: { facility: args.facility, sourceType: args.sourceType },
      orderBy: { version: 'desc' },
      select: { profileId: true, version: true, effectiveTo: true },
    });

    const version = (previous?.version ?? 0) + 1;
    const effectiveFrom = args.effectiveFrom ?? new Date();

    if (previous && previous.effectiveTo === null) {
      const closeAt = new Date(effectiveFrom.getTime() - 86_400_000);
      await tx.inmateParserProfile.update({
        where: { profileId: previous.profileId },
        data: { effectiveTo: closeAt },
      });
    }

    const created = await tx.inmateParserProfile.create({
      data: {
        facility: args.facility,
        sourceType: args.sourceType,
        version,
        label: args.label,
        columnMap: args.columnMap as unknown as object,
        parseOptions: (args.parseOptions ?? {}) as object,
        normalizationVersion: args.normalizationVersion ?? null,
        ocrVersion: args.ocrVersion ?? null,
        effectiveFrom,
        changeNote: args.changeNote,
        createdById: args.createdById ?? null,
      },
      select: { profileId: true, version: true },
    });

    return created;
  });
}

export async function listProfiles(facility?: string) {
  const profiles = await prisma.inmateParserProfile.findMany({
    where: facility ? { facility } : {},
    orderBy: [{ facility: 'asc' }, { sourceType: 'asc' }, { version: 'desc' }],
  });
  return profiles.map((p) => ({
    profileId: p.profileId,
    facility: p.facility,
    sourceType: p.sourceType,
    version: p.version,
    label: p.label,
    active: p.active,
    effectiveFrom: p.effectiveFrom?.toISOString().slice(0, 10) ?? null,
    effectiveTo: p.effectiveTo?.toISOString().slice(0, 10) ?? null,
    normalizationVersion: p.normalizationVersion,
    ocrVersion: p.ocrVersion,
    changeNote: p.changeNote,
    mappedFields: Object.keys(p.columnMap as object).length,
    createdAt: p.createdAt.toISOString(),
  }));
}

/**
 * Which documents were parsed with which profile version.
 *
 * The reprocessing entry point: after a mapping error is found in version 3, this
 * is how an operator learns which imports are affected.
 */
export async function batchesByProfile(profileId: string) {
  const batches = await prisma.inmateIngestionBatch.findMany({
    where: { parserProfileId: profileId },
    orderBy: { startedAt: 'desc' },
    take: 500,
    select: {
      batchId: true, facility: true, sourceFilename: true, rosterDate: true,
      parserVersion: true, startedAt: true, status: true, recordsTotal: true,
    },
  });
  return batches.map((b) => ({
    batchId: b.batchId,
    facility: b.facility,
    filename: b.sourceFilename,
    rosterDate: b.rosterDate?.toISOString().slice(0, 10) ?? null,
    parserVersion: b.parserVersion,
    status: b.status,
    records: b.recordsTotal,
    startedAt: b.startedAt.toISOString(),
  }));
}
