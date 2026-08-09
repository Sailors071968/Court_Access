// ============================================================================
// Printable intelligence report.
//
// The primary operational deliverable: a list of newly discovered inmates, each
// linked to their historical arrests and the evidence behind them.
//
// Server-rendered HTML with a print stylesheet rather than a PDF library. It
// prints correctly from a browser, adds no dependency to an artifact that is
// fingerprinted and frozen, and the same markup is the on-screen view — so what
// is reviewed is what is printed.
//
// Every generated report is persisted verbatim with its parameters, because "the
// list I printed on Tuesday" is a question that gets asked after the underlying
// data has been corrected, and re-running the query would answer a different one.
// ============================================================================

import prisma from '../../lib/prisma.js';
import { displayName } from './displayName.js';

export interface ReportParameters {
  from?: string;
  to?: string;
  facility?: string;
  /** Include rows whose identity confidence is below this. Default includes all. */
  minConfidence?: number;
}

export interface ReportRow {
  inmateId: string;
  name: string;
  dateOfBirth: string | null;
  sex: string | null;
  bookingDate: string;
  facility: string;
  externalBookingId: string | null;
  charges: { statute: string | null; description: string | null; severity: string; counts: number }[];
  bailAmount: string | null;
  housingLocation: string | null;
  priorBookingCount: number;
  priorBookingDates: string[];
  identityConfidence: number;
  matchTier: string | null;
  onWatchList: boolean;
  watchListReason: string | null;
  /** Anything an operator should know before acting on the row. */
  flags: string[];
  provenance: { filename: string; sha256: string; rosterDate: string | null; sourceType: string; line: number | null };
}

const money = (cents: bigint | null): string | null =>
  cents === null ? null : (Number(cents) / 100).toFixed(2);

/**
 * Gather the rows.
 *
 * A query over `isFirstAppearance`, which ingestion recorded at the time. Not
 * re-derived: recomputing "new" from current data would change last week's
 * report every time an older roster was backfilled.
 */
export async function buildNewInmateReport(params: ReportParameters): Promise<ReportRow[]> {
  const where: Record<string, unknown> = { isFirstAppearance: true };
  if (params.facility) where.facility = params.facility;
  if (params.from || params.to) {
    where.bookedAt = {
      ...(params.from ? { gte: new Date(params.from) } : {}),
      ...(params.to ? { lte: new Date(params.to) } : {}),
    };
  }

  const bookings = await prisma.inmateBooking.findMany({
    where,
    orderBy: { bookedAt: 'desc' },
    include: {
      charges: true,
      sourceBatch: { include: { document: true } },
      inmate: { include: { watchListEntries: { where: { active: true }, take: 1 } } },
    },
  });

  const rows: ReportRow[] = [];

  for (const b of bookings) {
    const priors = await prisma.inmateBooking.findMany({
      where: { inmateId: b.inmateId, bookedAt: { lt: b.bookedAt } },
      orderBy: { bookedAt: 'desc' },
      select: { bookedAt: true },
      take: 25,
    });

    const record = await prisma.inmateIngestionRecord.findFirst({
      where: { bookingId: b.bookingId },
      select: { lineNumber: true, matchTier: true, extractionMethod: true, extractionConfidence: true },
    });

    const watch = b.inmate.watchListEntries[0];
    const flags: string[] = [];

    // Flags exist so an operator is not required to infer these from the data.
    if (b.inmate.identityConfidence < 90) {
      flags.push(`identity confidence ${b.inmate.identityConfidence}% — matched on partial evidence`);
    }
    if (!b.inmate.dateOfBirth) {
      flags.push('no date of birth on record — identity matching is weaker for this person');
    }
    if (record?.extractionMethod === 'ocr') {
      flags.push(`transcribed by OCR (extraction confidence ${record.extractionConfidence ?? '?'}%) — verify against the source`);
    }
    if (b.charges.some((c) => c.severity === 'felony')) flags.push('felony charge');
    if (b.charges.length === 0) flags.push('no charges recorded on this booking');
    if (priors.length > 0) flags.push(`${priors.length} prior booking(s) — returning`);

    const conflicts = await prisma.inmateSourceConflict.count({
      where: { bookingId: b.bookingId, resolution: 'unknown' },
    });
    if (conflicts > 0) {
      flags.push(`${conflicts} unresolved disagreement(s) between sources about this booking`);
    }

    if (params.minConfidence !== undefined && b.inmate.identityConfidence < params.minConfidence) continue;

    rows.push({
      inmateId: b.inmateId,
      name: displayName(b.inmate, { includeMiddle: true }),
      dateOfBirth: b.inmate.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      sex: b.inmate.sex,
      bookingDate: b.bookedAt.toISOString(),
      facility: b.facility,
      externalBookingId: b.externalBookingId,
      charges: b.charges.map((c) => ({
        statute: c.statuteCode && c.statuteSection ? `${c.statuteCode} ${c.statuteSection}` : null,
        description: c.description,
        severity: c.severity,
        counts: c.counts,
      })),
      bailAmount: money(b.bailAmountCents),
      housingLocation: b.housingLocation,
      priorBookingCount: priors.length,
      priorBookingDates: priors.map((p) => p.bookedAt.toISOString().slice(0, 10)),
      identityConfidence: b.inmate.identityConfidence,
      matchTier: record?.matchTier ?? null,
      onWatchList: Boolean(watch),
      watchListReason: watch?.reason ?? null,
      flags,
      provenance: {
        filename: b.sourceBatch.sourceFilename,
        sha256: b.sourceBatch.sourceSha256,
        rosterDate: b.sourceBatch.rosterDate?.toISOString().slice(0, 10) ?? null,
        sourceType: b.sourceBatch.sourceType,
        line: record?.lineNumber ?? null,
      },
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const escape = (s: string | null | undefined): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/**
 * Render for print.
 *
 * Deliberately plain: this is an internal operational document, and the
 * directive is explicit that appearance is not the current concern. The layout
 * exists to be legible on paper — a page break never splits a person, and every
 * page carries the parameters and the generation time so two printings are
 * distinguishable.
 */
export function renderNewInmateReport(
  rows: ReportRow[],
  params: ReportParameters,
  meta: { generatedAt: string; generatedBy: string; reportId?: string },
): string {
  const scope = [
    params.facility ? `facility ${params.facility}` : 'all facilities',
    params.from ? `from ${params.from}` : null,
    params.to ? `to ${params.to}` : null,
    params.minConfidence !== undefined ? `identity confidence ≥ ${params.minConfidence}%` : null,
  ].filter(Boolean).join(' · ');

  const body = rows.length === 0
    ? '<p class="empty">No newly discovered inmates in this range.</p>'
    : rows.map((r) => `
    <section class="person">
      <h2>${escape(r.name)}${r.onWatchList ? ' <span class="watch">WATCH LIST</span>' : ''}</h2>
      <table class="facts">
        <tr><th>Date of birth</th><td>${escape(r.dateOfBirth ?? 'UNKNOWN')}</td>
            <th>Sex</th><td>${escape(r.sex ?? 'UNKNOWN')}</td></tr>
        <tr><th>Booked</th><td>${escape(r.bookingDate.slice(0, 16).replace('T', ' '))}</td>
            <th>Facility</th><td>${escape(r.facility)}</td></tr>
        <tr><th>Booking no.</th><td>${escape(r.externalBookingId ?? 'UNKNOWN')}</td>
            <th>Housing</th><td>${escape(r.housingLocation ?? 'UNKNOWN')}</td></tr>
        <tr><th>Bail</th><td>${r.bailAmount ? '$' + escape(r.bailAmount) : 'UNKNOWN'}</td>
            <th>Identity confidence</th><td>${r.identityConfidence}%${r.matchTier ? ` (${escape(r.matchTier)})` : ''}</td></tr>
        <tr><th>Prior bookings</th><td colspan="3">${r.priorBookingCount === 0
          ? 'none on record'
          : `${r.priorBookingCount} — ${r.priorBookingDates.map(escape).join(', ')}`}</td></tr>
      </table>

      <h3>Charges</h3>
      ${r.charges.length === 0 ? '<p class="empty">None recorded.</p>' : `
      <table class="charges">
        <thead><tr><th>Statute</th><th>Description</th><th>Severity</th><th>Counts</th></tr></thead>
        <tbody>${r.charges.map((c) => `
          <tr><td>${escape(c.statute ?? 'UNKNOWN')}</td><td>${escape(c.description ?? '')}</td>
              <td>${escape(c.severity)}</td><td>${c.counts}</td></tr>`).join('')}
        </tbody>
      </table>`}

      ${r.flags.length > 0 ? `
      <h3>Intelligence flags</h3>
      <ul class="flags">${r.flags.map((f) => `<li>${escape(f)}</li>`).join('')}</ul>` : ''}

      ${r.watchListReason ? `<p class="watch-reason"><strong>Watch list reason:</strong> ${escape(r.watchListReason)}</p>` : ''}

      <p class="provenance">Source: ${escape(r.provenance.filename)}
        (${escape(r.provenance.sourceType)}${r.provenance.line !== null ? `, row ${r.provenance.line}` : ''})
        · roster ${escape(r.provenance.rosterDate ?? 'undated')}
        · sha256 ${escape(r.provenance.sha256.slice(0, 16))}…</p>
    </section>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>New inmate intelligence — ${escape(meta.generatedAt.slice(0, 10))}</title>
<style>
  body { font: 11pt/1.4 Georgia, serif; margin: 0; color: #111; }
  .page { padding: 18mm 16mm; }
  header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
  h1 { font-size: 15pt; margin: 0 0 4px; }
  .meta { font-size: 8.5pt; color: #444; }
  .person { border: 1px solid #999; padding: 10px 12px; margin-bottom: 12px; page-break-inside: avoid; }
  h2 { font-size: 12pt; margin: 0 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: .06em; margin: 10px 0 4px; color: #333; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; }
  .facts th { text-align: left; width: 15%; color: #444; font-weight: normal; padding: 2px 6px 2px 0; vertical-align: top; }
  .facts td { padding: 2px 12px 2px 0; }
  .charges th, .charges td { border: 1px solid #bbb; padding: 3px 6px; text-align: left; }
  .charges thead th { background: #eee; }
  .flags { margin: 4px 0; padding-left: 18px; font-size: 9.5pt; }
  .watch { background: #111; color: #fff; font-size: 8pt; padding: 1px 6px; vertical-align: middle; }
  .watch-reason { font-size: 9.5pt; }
  .provenance { font-size: 8pt; color: #555; margin: 8px 0 0; border-top: 1px dotted #bbb; padding-top: 4px; }
  .empty { font-size: 9.5pt; color: #666; font-style: italic; }
  @media print { .page { padding: 0; } @page { margin: 14mm; } }
</style></head>
<body><div class="page">
  <header>
    <h1>Newly Discovered Inmates</h1>
    <div class="meta">
      Scope: ${escape(scope)} · ${rows.length} record(s)<br>
      Generated ${escape(meta.generatedAt)} by ${escape(meta.generatedBy)}${meta.reportId ? ` · report ${escape(meta.reportId)}` : ''}<br>
      Internal use only. Derived from jail rosters; every fact above cites the document it came from.
    </div>
  </header>
  ${body}
</div></body></html>`;
}

/**
 * Build, render and persist in one step.
 *
 * The rendered HTML is stored verbatim so the printed document can be retrieved
 * exactly, including after the data behind it has been corrected.
 */
export async function generateAndPersistReport(
  params: ReportParameters,
  generatedById: string,
): Promise<{ reportId: string; html: string; rowCount: number }> {
  const rows = await buildNewInmateReport(params);
  const generatedAt = new Date().toISOString();

  const created = await prisma.inmateIntelligenceReport.create({
    data: {
      reportType: 'new_inmates',
      parameters: params as unknown as object,
      rowCount: rows.length,
      generatedById,
    },
    select: { reportId: true },
  });

  const html = renderNewInmateReport(rows, params, {
    generatedAt,
    generatedBy: generatedById,
    reportId: created.reportId,
  });

  await prisma.inmateIntelligenceReport.update({
    where: { reportId: created.reportId },
    data: { renderedHtml: html },
  });

  return { reportId: created.reportId, html, rowCount: rows.length };
}
