// ============================================================================
// Daily Case Pipeline — single shared operational state for all NIIS screens.
//
// Upload · Morning Operations · Today's New Inmates · Reports · Investigator
// Workspace must all derive readiness from this object — not independent queries.
// ============================================================================

import prisma from '../../lib/prisma.js';

export type PipelineVerdict = 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN';

export interface PipelineStage {
  id: string;
  label: string;
  verdict: PipelineVerdict;
  timestamp: string | null;
  tables: string[];
  recordCounts: Record<string, number | string | null>;
  evidence: string[];
}

export interface DailyCasePipelineState {
  facility: string;
  opsDate: string;
  priorDate: string;
  /** Compact DailyCase flags for operator/UI. */
  flags: {
    pdfUploaded: boolean;
    pdfParsed: boolean;
    canonicalRosterBuilt: boolean;
    yesterdayLoaded: boolean;
    comparisonFinished: boolean;
    reportGenerated: boolean;
    certified: boolean;
  };
  dailyCaseStatus: string | null;
  caseId: string | null;
  /** First non-PASS stage — where the pipeline is stuck. */
  blockedAt: string | null;
  /** Operator-facing one-liner (never invents success). */
  operatorMessage: string;
  /** True only when set-diff new-inmate list may be shown. */
  mayShowNewInmates: boolean;
  stages: PipelineStage[];
  generatedAt: string;
}

function dayStart(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

function priorIso(iso: string): string {
  const d = dayStart(iso);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Build the single source of truth for one Sacramento operational day.
 */
export async function getDailyCasePipelineState(
  facility = 'sacramento',
  opsDate = new Date().toISOString().slice(0, 10),
): Promise<DailyCasePipelineState> {
  const ops = opsDate.slice(0, 10);
  const start = dayStart(ops);
  const end = new Date(start.getTime() + 86_400_000);
  const priorDate = priorIso(ops);
  const priorStart = dayStart(priorDate);

  const stages: PipelineStage[] = [];

  // Explicit select — avoid schema fields (jobId/jobFileId) not yet migrated on all DBs.
  const upload = await prisma.inmateRosterUpload.findFirst({
    where: {
      facility,
      OR: [
        { rosterDate: { gte: start, lt: end } },
        { uploadedAt: { gte: start, lt: end }, fileKind: 'pdf' },
      ],
    },
    orderBy: { uploadedAt: 'desc' },
    select: {
      uploadId: true,
      originalName: true,
      status: true,
      stage: true,
      storedPath: true,
      sizeBytes: true,
      sha256: true,
      fileKind: true,
      rosterDate: true,
      uploadedAt: true,
      batchId: true,
      failureReason: true,
    },
  });

  // Import job (optional — table may not exist on older DBs)
  let job: {
    jobId: string;
    status: string;
    createdAt: Date;
    filesUploaded: number;
    filesCompleted: number;
    currentFilename: string | null;
  } | null = null;
  let jobFileStatus: string | null = null;
  try {
    if (upload?.uploadId) {
      const jf = await prisma.inmateImportJobFile.findFirst({
        where: { uploadId: upload.uploadId },
        include: {
          job: {
            select: {
              jobId: true,
              status: true,
              createdAt: true,
              filesUploaded: true,
              filesCompleted: true,
              currentFilename: true,
            },
          },
        },
      });
      if (jf?.job) {
        job = jf.job;
        jobFileStatus = jf.status;
      }
    }
    if (!job) {
      job = await prisma.inmateImportJob.findFirst({
        where: {
          facility,
          OR: [
            { rosterDate: { gte: start, lt: end } },
            { createdAt: { gte: start, lt: end } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: {
          jobId: true,
          status: true,
          createdAt: true,
          filesUploaded: true,
          filesCompleted: true,
          currentFilename: true,
        },
      });
    }
  } catch {
    job = null;
  }

  const pdfUploaded = Boolean(upload);
  stages.push({
    id: 'upload_received',
    label: 'Upload received',
    verdict: pdfUploaded ? 'PASS' : 'FAIL',
    timestamp: upload?.uploadedAt?.toISOString() ?? null,
    tables: ['inmate_roster_uploads'],
    recordCounts: { found: pdfUploaded ? 1 : 0 },
    evidence: upload
      ? [
          `uploadId=${upload.uploadId}`,
          `name=${upload.originalName}`,
          `status=${upload.status}`,
          `stage=${upload.stage ?? 'null'}`,
        ]
      : ['No PDF upload for this ops date'],
  });

  const jobOk = Boolean(job) || (upload != null && upload.status !== 'uploading');
  stages.push({
    id: 'import_job',
    label: 'Import Job created',
    verdict: job ? 'PASS' : upload ? 'PENDING' : 'FAIL',
    timestamp: job?.createdAt?.toISOString() ?? null,
    tables: ['inmate_import_jobs', 'inmate_import_job_files'],
    recordCounts: {
      jobStatus: job?.status ?? null,
      jobFileStatus,
    },
    evidence: job
      ? [`jobId=${job.jobId}`, `status=${job.status}`, jobFileStatus ? `fileStatus=${jobFileStatus}` : '']
      : upload
        ? ['Upload exists without Import Job row (legacy path or migration missing)']
        : ['No import job'],
  });

  const stuckUploading =
    job?.status === 'uploading'
    || jobFileStatus === 'uploading'
    || jobFileStatus === 'pending';
  const fileStored = Boolean(
    upload
    && upload.storedPath
    && ['uploaded', 'queued', 'processing', 'completed', 'failed'].includes(upload.status),
  );
  stages.push({
    id: 'file_stored',
    label: 'File stored',
    verdict: stuckUploading ? 'FAIL' : fileStored ? 'PASS' : upload ? 'PENDING' : 'FAIL',
    timestamp: upload?.uploadedAt?.toISOString() ?? null,
    tables: ['inmate_roster_uploads'],
    recordCounts: { sizeBytes: upload?.sizeBytes ?? null },
    evidence: stuckUploading
      ? [
          'STUCK in uploading — Import Job will not auto-process until file status leaves pending/uploading',
          `job.status=${job?.status ?? 'n/a'} jobFile=${jobFileStatus ?? 'n/a'}`,
        ]
      : fileStored
        ? [`storedPath present`, `upload.status=${upload!.status}`]
        : ['File not fully stored'],
  });

  let batch: {
    batchId: string;
    status: string;
    sourceType: string;
    recordsTotal: number | null;
    recordsNew: number | null;
    finishedAt: Date | null;
    startedAt: Date;
  } | null = null;
  try {
    batch = upload?.batchId
      ? await prisma.inmateIngestionBatch.findUnique({
          where: { batchId: upload.batchId },
          select: {
            batchId: true,
            status: true,
            sourceType: true,
            recordsTotal: true,
            recordsNew: true,
            finishedAt: true,
            startedAt: true,
          },
        })
      : await prisma.inmateIngestionBatch.findFirst({
          where: {
            facility,
            status: 'completed',
            sourceType: { in: ['pdf_text', 'pdf_ocr', 'csv'] },
            rosterDate: { gte: start, lt: end },
          },
          orderBy: { finishedAt: 'desc' },
          select: {
            batchId: true,
            status: true,
            sourceType: true,
            recordsTotal: true,
            recordsNew: true,
            finishedAt: true,
            startedAt: true,
          },
        });
  } catch {
    batch = null;
  }
  const pdfParsed = batch?.status === 'completed';
  stages.push({
    id: 'parser',
    label: 'Parser executed',
    verdict: pdfParsed ? 'PASS' : batch ? 'PENDING' : upload && fileStored && !stuckUploading ? 'FAIL' : 'PENDING',
    timestamp: batch?.finishedAt?.toISOString() ?? batch?.startedAt?.toISOString() ?? null,
    tables: ['inmate_ingestion_batches', 'inmate_ingestion_records'],
    recordCounts: {
      recordsTotal: batch?.recordsTotal ?? null,
      recordsNew: batch?.recordsNew ?? null,
      batchStatus: batch?.status ?? null,
    },
    evidence: batch
      ? [`batchId=${batch.batchId}`, `status=${batch.status}`, `sourceType=${batch.sourceType}`]
      : [
          'No completed ingestion batch for ops date',
          upload
            ? `upload.status=${upload.status} stage=${upload.stage ?? 'null'} batchId=${upload.batchId ?? 'null'}`
            : 'no upload',
        ],
  });

  const snap = await prisma.inmateRosterSnapshot.findFirst({
    where: { facility, rosterDate: { gte: start, lt: end } },
    orderBy: { extractedAt: 'desc' },
  }).catch(() => null);
  let memberCount = 0;
  if (snap) {
    memberCount = await prisma.inmateRosterSnapshotMember.count({
      where: { snapshotId: snap.snapshotId },
    }).catch(() => 0);
  }
  const canonicalRosterBuilt = Boolean(snap && (snap.inmateCount > 0 || memberCount > 0));
  stages.push({
    id: 'canonical_roster',
    label: 'Canonical roster written',
    verdict: canonicalRosterBuilt ? 'PASS' : pdfParsed ? 'FAIL' : 'PENDING',
    timestamp: snap?.extractedAt?.toISOString() ?? null,
    tables: ['inmate_roster_snapshots', 'inmate_roster_snapshot_members'],
    recordCounts: {
      inmateCount: snap?.inmateCount ?? null,
      members: memberCount,
      status: snap?.status ?? null,
    },
    evidence: snap
      ? [`snapshotId=${snap.snapshotId}`, `status=${snap.status}`]
      : ['No roster snapshot for ops date (snapshotFromBatch may have failed silently)'],
  });

  const priorSnap = await prisma.inmateRosterSnapshot.findFirst({
    where: {
      facility,
      rosterDate: { gte: priorStart, lt: start },
      status: { in: ['certified', 'validated'] },
    },
    orderBy: [{ status: 'asc' }, { certifiedAt: 'desc' }, { validatedAt: 'desc' }],
  }).catch(() => null);
  const priorBatch = await prisma.inmateIngestionBatch.findFirst({
    where: {
      facility,
      status: 'completed',
      sourceType: { in: ['pdf_text', 'pdf_ocr'] },
      rosterDate: { gte: priorStart, lt: start },
    },
    orderBy: { finishedAt: 'desc' },
  });
  const yesterdayLoaded = Boolean(priorSnap || priorBatch);
  stages.push({
    id: 'prior_roster',
    label: 'Previous certified roster loaded',
    verdict: yesterdayLoaded ? 'PASS' : canonicalRosterBuilt ? 'FAIL' : 'PENDING',
    timestamp:
      priorSnap?.certifiedAt?.toISOString()
      ?? priorSnap?.validatedAt?.toISOString()
      ?? priorBatch?.finishedAt?.toISOString()
      ?? null,
    tables: ['inmate_roster_snapshots', 'inmate_ingestion_batches'],
    recordCounts: {
      priorSnapshotCount: priorSnap?.inmateCount ?? null,
      priorBatchId: priorBatch?.batchId ?? null,
    },
    evidence: priorSnap
      ? [`priorSnapshot=${priorSnap.snapshotId}`, `status=${priorSnap.status}`]
      : priorBatch
        ? [`priorBatch=${priorBatch.batchId} (not yet certified snapshot)`]
        : [`No prior roster for ${priorDate}`],
  });

  const daily = await prisma.inmateDailyCase.findUnique({
    where: { facility_opsDate: { facility, opsDate: start } },
  }).catch(() => null);

  const comparisonFinished = Boolean(
    daily
    && ['compared', 'report_ready', 'enriching', 'enriched', 'closed'].includes(daily.status)
    && daily.comparisonId,
  );
  stages.push({
    id: 'comparison',
    label: 'Comparison executed',
    verdict: comparisonFinished ? 'PASS' : yesterdayLoaded && pdfParsed ? 'FAIL' : 'PENDING',
    timestamp: daily?.updatedAt?.toISOString() ?? null,
    tables: ['inmate_daily_cases', 'inmate_batch_comparisons'],
    recordCounts: {
      status: daily?.status ?? null,
      newInmateCount: daily?.newInmateCount ?? null,
      existingInmateCount: daily?.existingInmateCount ?? null,
      returningInmateCount: daily?.returningInmateCount ?? null,
      reviewCount: daily?.reviewCount ?? null,
    },
    evidence: daily
      ? [
          `caseId=${daily.caseId}`,
          `status=${daily.status}`,
          `priorPdfBatchId=${daily.priorPdfBatchId ?? 'MISSING'}`,
          `currentPdfBatchId=${daily.currentPdfBatchId ?? 'MISSING'}`,
          `comparisonId=${daily.comparisonId ?? 'MISSING'}`,
        ]
      : ['No InmateDailyCase — attachUploadToDailyCase did not run'],
  });

  stages.push({
    id: 'new_inmate_list',
    label: 'New inmate list generated',
    verdict: comparisonFinished ? 'PASS' : 'PENDING',
    timestamp: daily?.updatedAt?.toISOString() ?? null,
    tables: ['inmate_daily_cases'],
    recordCounts: { newInmates: daily?.newInmateCount ?? null },
    evidence: comparisonFinished
      ? [`DailyCase.newInmateCount=${daily!.newInmateCount}`]
      : ['Set-diff list unavailable until comparison finishes — must NOT fall back to seed isFirstAppearance rows'],
  });

  const report = daily?.initialReportId
    ? await prisma.inmateIntelligenceReport.findUnique({ where: { reportId: daily.initialReportId } })
    : null;
  const reportGenerated = Boolean(report || (daily && ['report_ready', 'enriching', 'enriched', 'closed'].includes(daily.status)));
  stages.push({
    id: 'report',
    label: 'Report generated',
    verdict: reportGenerated ? 'PASS' : comparisonFinished ? 'FAIL' : 'PENDING',
    timestamp: report?.generatedAt?.toISOString() ?? null,
    tables: ['inmate_intelligence_reports'],
    recordCounts: {
      reportId: report?.reportId ?? daily?.initialReportId ?? null,
      rowCount: report?.rowCount ?? null,
    },
    evidence: report
      ? [`reportId=${report.reportId}`, `approvalState=${report.approvalState}`]
      : ['No initial report on DailyCase'],
  });

  const cert = await prisma.inmateDailyCertification.findFirst({
    where: { facility, opsDate: start, isCurrent: true },
  }).catch(() => null);
  const certified = cert?.status === 'pass';
  stages.push({
    id: 'certified',
    label: 'Engineering certified',
    verdict: certified ? 'PASS' : reportGenerated ? 'PENDING' : 'PENDING',
    timestamp: cert?.createdAt?.toISOString() ?? null,
    tables: ['inmate_daily_certifications'],
    recordCounts: { status: cert?.status ?? null },
    evidence: cert
      ? [`certification=${cert.status}`, `revision=${cert.revision}`]
      : ['Not certified'],
  });

  const blocked = stages.find((s) => s.verdict === 'FAIL' || s.verdict === 'PENDING');
  const blockedAt = blocked && blocked.verdict !== 'PASS' ? blocked.label : null;

  let operatorMessage: string;
  if (!pdfUploaded) {
    operatorMessage = "Upload today's Sacramento PDF to begin the Daily Case.";
  } else if (stuckUploading) {
    operatorMessage =
      `PDF "${upload!.originalName}" is stuck in uploading — import never started. `
      + 'Resume/retry the Import Job; Morning Operations and New Inmates correctly show no results yet.';
  } else if (!pdfParsed) {
    operatorMessage =
      `PDF uploaded (${upload!.status}/${upload!.stage ?? 'no stage'}) but parser has not completed. `
      + 'Do not trust New Inmates until DailyCase comparison finishes.';
  } else if (!yesterdayLoaded) {
    operatorMessage =
      `Today's roster parsed, but yesterday's certified roster (${priorDate}) is missing. Comparison cannot run.`;
  } else if (!comparisonFinished) {
    operatorMessage =
      `Awaiting comparison — DailyCase status ${daily?.status ?? 'missing'}. New Inmates must show "No certified results available".`;
  } else if (!certified) {
    operatorMessage =
      `Comparison ready: ${daily!.newInmateCount} new inmates (provisional). Complete investigator certification.`;
  } else {
    operatorMessage = `Certified: ${daily!.newInmateCount} newly booked.`;
  }

  return {
    facility,
    opsDate: ops,
    priorDate,
    flags: {
      pdfUploaded,
      pdfParsed,
      canonicalRosterBuilt,
      yesterdayLoaded,
      comparisonFinished,
      reportGenerated,
      certified,
    },
    dailyCaseStatus: daily?.status ?? null,
    caseId: daily?.caseId ?? null,
    blockedAt: comparisonFinished && !blockedAt ? null : blockedAt,
    operatorMessage,
    mayShowNewInmates: comparisonFinished,
    stages,
    generatedAt: new Date().toISOString(),
  };
}
