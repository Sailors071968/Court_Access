// ============================================================================
// Access logging for the intelligence subsystem.
//
// This is personal data about people who have not been convicted of anything, so
// looking at a record is an event worth recording and printing a list is a
// disclosure. The log answers "who saw whose record, and who printed what",
// which is a question that gets asked after the fact and cannot be answered
// retrospectively if it was not recorded at the time.
//
// Logging never fails a request. A failure to record an access is worth a warning
// in the process log; it is not worth denying an administrator the record they
// are entitled to see, and it must not turn a read into a 500.
// ============================================================================

import prisma from '../../lib/prisma.js';

export type IntelligenceAction =
  | 'view_inmate'
  | 'view_timeline'
  | 'search'
  | 'list_new_inmates'
  | 'generate_report'
  | 'view_review_queue'
  | 'merge'
  | 'unmerge'
  | 'ingest'
  | 'watch_list_add'
  | 'watch_list_remove';

export interface AccessEvent {
  userId: string;
  action: IntelligenceAction;
  inmateId?: string;
  batchId?: string;
  /** Query or report parameters, so a printed list is reproducible exactly. */
  parameters?: Record<string, unknown>;
  resultCount?: number;
  ipAddress?: string;
}

export async function recordAccess(event: AccessEvent): Promise<void> {
  try {
    await prisma.inmateAccessLog.create({
      data: {
        userId: event.userId,
        action: event.action,
        inmateId: event.inmateId ?? null,
        batchId: event.batchId ?? null,
        parameters: (event.parameters ?? null) as unknown as object,
        resultCount: event.resultCount ?? null,
        ipAddress: event.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.warn(
      `[InmateIntelligence] Could not record ${event.action} by ${event.userId}: ` +
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** The audit trail for one person's record. */
export async function getAccessHistory(inmateId: string, limit = 100) {
  const rows = await prisma.inmateAccessLog.findMany({
    where: { inmateId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    userId: r.userId,
    action: r.action,
    at: r.createdAt.toISOString(),
    ipAddress: r.ipAddress,
  }));
}

/** Every report generated, so "the list I printed on Tuesday" is retrievable. */
export async function getReportHistory(limit = 100) {
  const rows = await prisma.inmateAccessLog.findMany({
    where: { action: 'generate_report' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    userId: r.userId,
    at: r.createdAt.toISOString(),
    parameters: r.parameters,
    resultCount: r.resultCount,
  }));
}
