// ============================================================================
// Import Inspection Mode and the mapping editor.
//
// Two capabilities that belong together: inspection tells an operator what a file
// contains, and the editor lets them act on it by publishing a new parser profile
// version — without a code change or a deployment.
//
// The separation between them is deliberate. Inspection never changes a mapping, and
// the editor never guesses one. An inspector that quietly corrected the profile would
// be acting on an inference drawn from a few hundred sample rows, and the cost of
// being wrong is a repository of misfiled data that looks correct.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';

import prisma from '../../../lib/prisma.js';
import type { AuthenticatedRequest } from '../../../security/authMiddleware.js';
import { recordAccess } from '../auditLog.js';
import { NORMALIZATION_VERSION } from '../normalization.js';
import { getColumnMap } from '../parsers/columnMaps.js';
import type { CanonicalField, ColumnMap } from '../types.js';
import { listProfiles, publishProfile, resolveProfile } from '../../platform/parserProfiles.js';
import { MAX_UPLOAD_BYTES, SUPPORTED_FACILITIES } from '../rosterUploads.js';
import { inspectFile } from './inspector.js';

function requireAdministrator(request: AuthenticatedRequest, reply: FastifyReply): boolean {
  const user = request.user;
  if (!user) {
    void reply.code(401).send({ error: 'Authentication required' });
    return false;
  }
  if (user.role !== 'admin') {
    void reply.code(403).send({
      error: 'Forbidden',
      message: 'The Inmate Intelligence System is available to administrators only.',
    });
    return false;
  }
  return true;
}

/** Every field a mapping can target, for the editor's dropdown. */
const CANONICAL_FIELDS: { field: CanonicalField; label: string; note: string }[] = [
  { field: 'externalBookingId', label: 'Booking number', note: 'Identifies one stay. Not the same as the X-Ref.' },
  { field: 'externalPersonId', label: 'X-Ref / SO number', note: 'Identifies the person across every stay. The strongest identity evidence available.' },
  { field: 'last', label: 'Last name', note: '' },
  { field: 'first', label: 'First name', note: '' },
  { field: 'middle', label: 'Middle name', note: '' },
  { field: 'suffix', label: 'Suffix', note: 'JR, SR, III — separated so it does not defeat a name match.' },
  { field: 'fullName', label: 'Full name (single column)', note: 'Use only when the export does not split the name.' },
  { field: 'dateOfBirth', label: 'Date of birth', note: '' },
  { field: 'sex', label: 'Sex', note: '' },
  { field: 'race', label: 'Race', note: '' },
  { field: 'bookedAt', label: 'Booking date', note: 'Required. A row without it cannot become a booking.' },
  { field: 'releasedAt', label: 'Release date (actual)', note: 'A fact. Never map a projected release here.' },
  { field: 'projectedReleaseAt', label: 'Projected release date', note: 'A forecast the jail revises. Kept apart from an actual release.' },
  { field: 'bailAmount', label: 'Bail amount', note: '"NO BAIL" is recorded as absent, not as zero.' },
  { field: 'housingLocation', label: 'Housing location', note: '' },
  { field: 'charges', label: 'Charges', note: 'Split on the separator declared in the profile.' },
  { field: 'arrestingAgency', label: 'Arresting agency', note: '' },
  { field: 'arrestType', label: 'Type of arrest', note: '' },
  { field: 'courtDate', label: 'Next court date', note: '' },
  { field: 'courtName', label: 'Court', note: '' },
  { field: 'outstandingWarrants', label: 'Outstanding warrants', note: 'Unrecognised values stay absent — "none" is a claim.' },
  { field: 'height', label: 'Height', note: 'Parsed to inches; refused outside 24–96.' },
  { field: 'weight', label: 'Weight', note: 'Parsed to pounds; refused outside 50–700.' },
];

const VALID_FIELDS = new Set(CANONICAL_FIELDS.map((f) => f.field));

export async function registerInspectionRoutes(app: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // Inspect — multipart, in its own scope
  // -------------------------------------------------------------------------
  await app.register(async function inspectionPlugin(instance) {
    await instance.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 2 } });

    /**
     * Analyse a file without importing it.
     *
     * The file is written to a temporary path, read, and deleted. It is deliberately
     * not stored alongside real uploads: an inspected file has not been accepted as
     * evidence of anything, and putting it in the evidence directory would blur the
     * line between "we looked at this" and "we imported this".
     */
    instance.post('/api/admin/intelligence/inspect', async (request: AuthenticatedRequest, reply: FastifyReply) => {
      if (!requireAdministrator(request, reply)) return;

      const query = request.query as { facility?: string; rosterDate?: string; persist?: string };
      const facility = query.facility ?? SUPPORTED_FACILITIES[0];

      const staging = join(tmpdir(), 'niis-inspection');
      await mkdir(staging, { recursive: true });

      const reports: unknown[] = [];
      const rejected: { filename: string; reason: string }[] = [];
      const written: string[] = [];

      try {
        for await (const part of request.parts()) {
          if (part.type !== 'file') continue;

          const extension = extname(part.filename).toLowerCase();
          if (extension !== '.csv' && extension !== '.pdf') {
            rejected.push({
              filename: part.filename,
              reason: 'Only CSV and PDF files can be inspected. Nothing was read.',
            });
            part.file.resume();
            continue;
          }

          const path = join(staging, `${crypto.randomUUID()}${extension}`);
          written.push(path);
          await pipeline(part.file, createWriteStream(path));

          reports.push(await inspectFile({
            filePath: path,
            facility,
            originalName: part.filename,
            rosterDate: query.rosterDate,
            persist: query.persist !== 'false',
            inspectedById: request.user!.userId,
          }));
        }
      } catch (err) {
        return reply.code(400).send({
          error: 'Inspection failed',
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        // The file has been described; the bytes are not evidence of anything yet.
        for (const path of written) await unlink(path).catch(() => undefined);
      }

      if (reports.length === 0 && rejected.length === 0) {
        return reply.code(400).send({
          error: 'No file received',
          message: 'Attach a CSV or PDF to inspect.',
        });
      }

      await recordAccess({
        userId: request.user!.userId,
        action: 'import_inspected',
        parameters: { facility, files: reports.length, rejected: rejected.length },
        ipAddress: request.ip,
      });

      return reply.send({ inspections: reports, rejected });
    });
  });

  // -------------------------------------------------------------------------
  // Inspection history
  // -------------------------------------------------------------------------

  app.get('/api/admin/intelligence/inspections', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const q = request.query as { facility?: string; limit?: string };
    const limit = Math.min(Number(q.limit) || 25, 100);

    const rows = await prisma.inmateImportInspection.findMany({
      where: q.facility ? { facility: q.facility } : {},
      orderBy: [{ inspectedAt: 'desc' }, { inspectionId: 'asc' }],
      take: limit,
      select: {
        inspectionId: true, facility: true, filename: true, sha256: true, sizeBytes: true,
        fileKind: true, profileVersion: true, verdict: true, parserConfidence: true,
        inspectedById: true, inspectedAt: true,
      },
    });

    return reply.send({
      inspections: rows.map((r) => ({
        ...r,
        sha256: r.sha256.slice(0, 16),
        inspectedAt: r.inspectedAt.toISOString(),
      })),
    });
  });

  app.get('/api/admin/intelligence/inspections/:inspectionId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { inspectionId } = request.params as { inspectionId: string };

    const row = await prisma.inmateImportInspection.findUnique({ where: { inspectionId } });
    if (!row) return reply.code(404).send({ error: 'Not found', message: 'No such inspection.' });

    return reply.send({
      inspectionId: row.inspectionId,
      inspectedAt: row.inspectedAt.toISOString(),
      inspectedById: row.inspectedById,
      ...(row.report as object),
    });
  });

  // -------------------------------------------------------------------------
  // The mapping editor
  // -------------------------------------------------------------------------

  /** What the editor needs: the current mapping, and every field it could target. */
  app.get('/api/admin/intelligence/mappings/:facility', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { facility } = request.params as { facility: string };
    const { sourceType } = request.query as { sourceType?: string };

    const resolved = await resolveProfile({
      facility,
      sourceType: (sourceType as 'csv' | 'pdf_text' | 'pdf_ocr') ?? 'csv',
    });
    const versions = (await listProfiles(facility)).filter(
      (p) => p.sourceType === (sourceType ?? 'csv'),
    );

    const map = resolved.columnMap;
    return reply.send({
      facility,
      sourceType: sourceType ?? 'csv',
      active: {
        profileId: resolved.profileId,
        version: resolved.version,
        label: resolved.label,
        isFallback: resolved.fallback,
        expectedHeaders: resolved.expectedHeaders ?? [],
        dateFormats: map?.dateFormats ?? [],
        nameOrder: map?.nameOrder ?? 'last_first',
        chargeSeparator: map?.chargeSeparator ?? ';',
        // One row per field, so the editor can render the whole mapping without
        // knowing the shape of a ColumnMap.
        mappings: CANONICAL_FIELDS.map((f) => ({
          field: f.field,
          label: f.label,
          note: f.note,
          aliases: map?.fields[f.field] ?? [],
          required: f.field === 'bookedAt',
        })),
      },
      versionHistory: versions,
      canonicalFields: CANONICAL_FIELDS,
    });
  });

  /**
   * Publish a new profile version from an edited mapping.
   *
   * Always a new version. There is deliberately no route that edits a published one:
   * the old version is the only accurate description of how the documents already
   * imported under it were read, and editing it would make every one of those imports
   * misdescribed.
   *
   * This is what "no code deployment should be required" means in practice — the
   * mapping is data, and this is the write.
   */
  app.post('/api/admin/intelligence/mappings/:facility/publish', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { facility } = request.params as { facility: string };
    const body = (request.body ?? {}) as {
      sourceType?: string;
      label?: string;
      /** field → aliases. An empty array disables the mapping for that field. */
      mappings?: Record<string, string[]>;
      dateFormats?: string[];
      nameOrder?: 'last_first' | 'first_last';
      chargeSeparator?: string;
      expectedHeaders?: string[];
      normalizationRules?: string[];
      validationRules?: unknown;
      effectiveFrom?: string;
      changeNote?: string;
      /** Carry forward the previous version's aliases for fields not sent. */
      basedOnActive?: boolean;
    };

    const sourceType = (body.sourceType ?? 'csv') as 'csv' | 'pdf_text' | 'pdf_ocr';
    if (!['csv', 'pdf_text', 'pdf_ocr'].includes(sourceType)) {
      return reply.code(400).send({ error: 'Invalid sourceType', message: 'One of: csv, pdf_text, pdf_ocr.' });
    }
    if (!body.changeNote?.trim()) {
      return reply.code(400).send({
        error: 'Change note required',
        message: 'A profile version must say why it exists. Years from now, "why does this import read the bail column from there" is answered by this sentence and nothing else.',
      });
    }
    if (!body.mappings || Object.keys(body.mappings).length === 0) {
      return reply.code(400).send({ error: 'No mappings', message: 'Send at least one field mapping.' });
    }

    const unknownFields = Object.keys(body.mappings).filter((f) => !VALID_FIELDS.has(f as CanonicalField));
    if (unknownFields.length > 0) {
      return reply.code(400).send({
        error: 'Unknown fields',
        message: `These are not canonical fields: ${unknownFields.join(', ')}. The list is at GET /api/admin/intelligence/mappings/${facility}.`,
      });
    }

    const previous = await resolveProfile({ facility, sourceType });
    const base = body.basedOnActive === false ? undefined : previous.columnMap;

    const fields: ColumnMap['fields'] = {};
    if (base) {
      for (const [field, aliases] of Object.entries(base.fields)) {
        fields[field as CanonicalField] = [...(aliases ?? [])];
      }
    }
    // An explicitly empty array disables the field, which is how an obsolete mapping is
    // retired — the field is simply not read from this version on.
    const disabled: string[] = [];
    for (const [field, aliases] of Object.entries(body.mappings)) {
      const cleaned = [...new Set(aliases.map((a) => a.trim().toLowerCase()).filter(Boolean))];
      if (cleaned.length === 0) {
        delete fields[field as CanonicalField];
        disabled.push(field);
      } else {
        fields[field as CanonicalField] = cleaned;
      }
    }

    if (!fields.bookedAt || fields.bookedAt.length === 0) {
      return reply.code(400).send({
        error: 'Booking date is required',
        message: 'Every row needs a booking date to become a booking. A profile without it would refuse every document it read.',
      });
    }

    const columnMap: ColumnMap = {
      facility,
      label: body.label ?? `${facility} ${sourceType}`,
      fields,
      dateFormats: (body.dateFormats?.length ? body.dateFormats : base?.dateFormats ?? ['mm/dd/yyyy', 'iso']) as ColumnMap['dateFormats'],
      nameOrder: body.nameOrder ?? base?.nameOrder ?? 'last_first',
      chargeSeparator: body.chargeSeparator ?? base?.chargeSeparator ?? ';',
    };

    const created = await publishProfile({
      facility,
      sourceType,
      label: body.label ?? `${facility} ${sourceType} (edited)`,
      columnMap,
      normalizationVersion: NORMALIZATION_VERSION,
      expectedHeaders: body.expectedHeaders ?? previous.expectedHeaders ?? [],
      normalizationRules: body.normalizationRules ?? [],
      validationRules: body.validationRules ?? previous.validationRules,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
      changeNote: body.changeNote.trim(),
      createdById: request.user!.userId,
    });

    await recordAccess({
      userId: request.user!.userId,
      action: 'parser_profile_published',
      parameters: {
        facility, sourceType, version: created.version,
        fieldsMapped: Object.keys(fields).length, disabled,
      },
      ipAddress: request.ip,
    });

    return reply.code(201).send({
      ...created,
      facility,
      sourceType,
      supersededVersion: previous.version,
      disabledFields: disabled,
      message: `Published as v${created.version}. Documents dated from ${
        (body.effectiveFrom ?? new Date().toISOString()).slice(0, 10)
      } will be read with it; earlier documents keep v${previous.version ?? '—'}, which remains the accurate description of how they were read.`,
    });
  });

  /**
   * Publish directly from an inspection's suggestion.
   *
   * The shortcut that makes the loop closeable: inspect a new export, read the
   * suggestions, publish. The suggestion is still not applied automatically — this
   * route is a person pressing a button, and it records which inspection it came from.
   */
  app.post('/api/admin/intelligence/inspections/:inspectionId/publish', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { inspectionId } = request.params as { inspectionId: string };
    const body = (request.body ?? {}) as { changeNote?: string; effectiveFrom?: string };

    const inspection = await prisma.inmateImportInspection.findUnique({ where: { inspectionId } });
    if (!inspection) return reply.code(404).send({ error: 'Not found', message: 'No such inspection.' });

    const report = inspection.report as {
      suggestedProfileUpdate?: { columnMap: ColumnMap; addedAliases: { field: string; alias: string }[]; basedOnVersion: number | null };
      profile?: { sourceType?: string };
      structure?: { headerRow?: string[] };
    };

    if (!report.suggestedProfileUpdate) {
      return reply.code(409).send({
        error: 'Nothing to publish',
        message: 'This inspection produced no confident suggestions. Map the columns by hand in the mapping editor, having read the sample values.',
      });
    }

    const sourceType = (report.profile?.sourceType ?? 'csv') as 'csv' | 'pdf_text' | 'pdf_ocr';
    const added = report.suggestedProfileUpdate.addedAliases;

    const created = await publishProfile({
      facility: inspection.facility,
      sourceType,
      label: `${inspection.facility} ${sourceType} — from inspection of ${inspection.filename}`,
      columnMap: report.suggestedProfileUpdate.columnMap,
      normalizationVersion: NORMALIZATION_VERSION,
      expectedHeaders: report.structure?.headerRow ?? [],
      normalizationRules: [],
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
      changeNote: body.changeNote?.trim()
        || `Published from the inspection of ${inspection.filename} (sha256 ${inspection.sha256.slice(0, 12)}). Added ${added.length} alias(es): ${added.map((a) => `${a.alias} → ${a.field}`).join(', ')}.`,
      createdById: request.user!.userId,
    });

    await recordAccess({
      userId: request.user!.userId,
      action: 'parser_profile_published',
      parameters: { fromInspection: inspectionId, facility: inspection.facility, version: created.version },
      ipAddress: request.ip,
    });

    return reply.code(201).send({
      ...created,
      fromInspection: inspectionId,
      addedAliases: added,
      message: `Published as v${created.version} from the inspection of ${inspection.filename}. Re-inspect the same file to confirm it now reads completely before importing it.`,
    });
  });

  /** The compiled-in map, as a starting point when no profile exists at all. */
  app.get('/api/admin/intelligence/mappings/:facility/default', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { facility } = request.params as { facility: string };
    const map = getColumnMap(facility);
    if (!map) {
      return reply.code(404).send({
        error: 'No default',
        message: `No compiled-in column map for "${facility}". Build the mapping from an inspection instead.`,
      });
    }
    return reply.send({ facility, columnMap: map });
  });
}
