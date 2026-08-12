/**
 * Operational Debug — stage-by-stage lifecycle trace for a Sacramento PDF day.
 *
 * Usage:
 *   npx tsx scripts/trace-daily-case-pipeline.ts --date 2026-08-12
 *
 * Does not invent successes. Each stage is PASS / FAIL / UNKNOWN with evidence.
 */
import prisma from '../src/lib/prisma.js';

const args = process.argv.slice(2);
const dateIdx = args.indexOf('--date');
const opsDate = (dateIdx >= 0 ? args[dateIdx + 1] : null) ?? new Date().toISOString().slice(0, 10);
const facility = 'sacramento';

type Verdict = 'PASS' | 'FAIL' | 'UNKNOWN' | 'BLOCKED';

interface Stage {
  stage: string;
  verdict: Verdict;
  timestamp: string | null;
  tables: string[];
  recordCounts: Record<string, number | string | null>;
  evidence: string[];
  stop?: boolean;
}

function dayStart(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

async function main() {
  const start = dayStart(opsDate);
  const end = new Date(start.getTime() + 86_400_000);
  const priorStart = new Date(start);
  priorStart.setUTCDate(priorStart.getUTCDate() - 1);
  const stages: Stage[] = [];

  // 1. Upload received
  const uploads = await prisma.inmateRosterUpload.findMany({
    where: {
      facility,
      OR: [
        { rosterDate: { gte: start, lt: end } },
        { originalName: { contains: opsDate.slice(5).replace('-', ''), mode: 'insensitive' } },
        { originalName: { contains: `0${opsDate.slice(5, 7)}-${opsDate.slice(8)}`, mode: 'insensitive' } },
        { originalName: { contains: `${opsDate.slice(5, 7)}-${opsDate.slice(8)}`, mode: 'insensitive' } },
        { originalName: { contains: opsDate, mode: 'insensitive' } },
      ],
    },
    orderBy: { uploadedAt: 'desc' },
  });
  const upload = uploads[0] ?? null;
  stages.push({
    stage: 'Upload received',
    verdict: upload ? 'PASS' : 'FAIL',
    timestamp: upload?.uploadedAt?.toISOString() ?? null,
    tables: ['inmate_roster_uploads'],
    recordCounts: { uploadsMatchingDay: uploads.length },
    evidence: upload
      ? [
          `uploadId=${upload.uploadId}`,
          `name=${upload.originalName}`,
          `status=${upload.status}`,
          `stage=${upload.stage}`,
          `rosterDate=${upload.rosterDate?.toISOString().slice(0, 10) ?? 'null'}`,
          `sha256=${upload.sha256?.slice(0, 16) ?? 'null'}…`,
        ]
      : ['No InmateRosterUpload found for facility+date/filename pattern'],
    stop: !upload,
  });
  if (!upload) return finish(stages);

  // 2. Import Job created
  const jobFile = upload.uploadId
    ? await prisma.inmateImportJobFile.findFirst({
        where: { uploadId: upload.uploadId },
        include: { job: true },
      })
    : null;
  const jobs = await prisma.inmateImportJob.findMany({
    where: {
      facility,
      OR: [
        { rosterDate: { gte: start, lt: end } },
        { createdAt: { gte: start, lt: end } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  const job = jobFile?.job ?? jobs[0] ?? null;
  stages.push({
    stage: 'Import Job created',
    verdict: job ? 'PASS' : 'FAIL',
    timestamp: job?.createdAt?.toISOString() ?? null,
    tables: ['inmate_import_jobs', 'inmate_import_job_files'],
    recordCounts: {
      jobsForDay: jobs.length,
      jobStatus: job?.status ?? null,
      jobFilesUploaded: job?.filesUploaded ?? null,
      jobFilesCompleted: job?.filesCompleted ?? null,
    },
    evidence: job
      ? [
          `jobId=${job.jobId}`,
          `status=${job.status}`,
          `autoProcess=${job.autoProcess}`,
          jobFile ? `jobFileStatus=${jobFile.status}` : 'upload not linked via InmateImportJobFile',
        ]
      : ['No Import Job for this day — upload may have used legacy /uploads path'],
    stop: !job && upload.status === 'uploading',
  });

  // 3. File stored
  const stored =
    Boolean(upload.storedPath || upload.storageKey)
    && ['uploaded', 'queued', 'processing', 'completed', 'failed'].includes(upload.status);
  stages.push({
    stage: 'File stored',
    verdict: stored ? 'PASS' : upload.status === 'uploading' ? 'FAIL' : 'UNKNOWN',
    timestamp: upload.uploadedAt?.toISOString() ?? null,
    tables: ['inmate_roster_uploads', 'disk:NIIS_UPLOAD_DIR'],
    recordCounts: { bytes: upload.sizeBytes ?? null },
    evidence: [
      `status=${upload.status}`,
      `storedPath=${upload.storedPath ?? upload.storageKey ?? 'MISSING'}`,
      upload.status === 'uploading'
        ? 'STUCK: Import Job File still "uploading" — bytes may be incomplete; auto-process will not start'
        : 'Upload row past uploading',
    ],
    stop: upload.status === 'uploading' || !stored,
  });
  if (upload.status === 'uploading' || !stored) return finish(stages);

  // 4. Parser executed
  const batch = upload.batchId
    ? await prisma.inmateIngestionBatch.findUnique({ where: { batchId: upload.batchId } })
    : await prisma.inmateIngestionBatch.findFirst({
        where: {
          facility,
          sourceFilename: upload.originalName,
          rosterDate: { gte: start, lt: end },
        },
        orderBy: { startedAt: 'desc' },
      });
  const parserOk = batch?.status === 'completed';
  stages.push({
    stage: 'Parser executed',
    verdict: parserOk ? 'PASS' : batch ? (batch.status === 'failed' ? 'FAIL' : 'UNKNOWN') : 'FAIL',
    timestamp: batch?.finishedAt?.toISOString() ?? batch?.startedAt?.toISOString() ?? null,
    tables: ['inmate_ingestion_batches', 'inmate_ingestion_records'],
    recordCounts: {
      recordsTotal: batch?.recordsTotal ?? null,
      recordsNew: batch?.recordsNew ?? null,
      recordsForReview: batch?.recordsForReview ?? null,
      batchStatus: batch?.status ?? null,
    },
    evidence: batch
      ? [
          `batchId=${batch.batchId}`,
          `status=${batch.status}`,
          `sourceType=${batch.sourceType}`,
          `parserConfidence=${batch.parserConfidence ?? 'null'}`,
          upload.status !== 'completed' && upload.status !== 'failed'
            ? `Upload status still "${upload.status}" — process may not have finished or status not updated`
            : `Upload status=${upload.status}`,
        ]
      : [
          'No InmateIngestionBatch linked — import never started or attach failed',
          `upload.status=${upload.status} upload.stage=${upload.stage} upload.batchId=${upload.batchId}`,
        ],
    stop: !parserOk,
  });
  if (!parserOk) return finish(stages);

  // 5. Canonical roster written
  const snap = await prisma.inmateRosterSnapshot.findFirst({
    where: { facility, rosterDate: { gte: start, lt: end } },
    orderBy: { extractedAt: 'desc' },
  });
  const memberCount = snap
    ? await prisma.inmateRosterSnapshotMember.count({ where: { snapshotId: snap.snapshotId } })
    : 0;
  stages.push({
    stage: 'Canonical roster written',
    verdict: snap && memberCount > 0 ? 'PASS' : snap ? 'FAIL' : 'FAIL',
    timestamp: snap?.extractedAt?.toISOString() ?? null,
    tables: ['inmate_roster_snapshots', 'inmate_roster_snapshot_members'],
    recordCounts: {
      inmateCount: snap?.inmateCount ?? null,
      members: memberCount,
      snapshotStatus: snap?.status ?? null,
    },
    evidence: snap
      ? [
          `snapshotId=${snap.snapshotId}`,
          `status=${snap.status}`,
          `contentHash=${snap.contentHash?.slice(0, 16)}…`,
          `sourceBatchId=${snap.sourceBatchId}`,
        ]
      : ['No InmateRosterSnapshot for ops date — snapshotFromBatch may have been swallowed'],
    stop: !snap || memberCount === 0,
  });
  if (!snap || memberCount === 0) return finish(stages);

  // 6. Previous certified roster loaded
  const priorSnap = await prisma.inmateRosterSnapshot.findFirst({
    where: {
      facility,
      rosterDate: { gte: priorStart, lt: start },
      status: { in: ['certified', 'validated'] },
    },
    orderBy: [{ status: 'asc' }, { certifiedAt: 'desc' }, { validatedAt: 'desc' }],
  });
  stages.push({
    stage: 'Previous certified roster loaded',
    verdict: priorSnap ? 'PASS' : 'FAIL',
    timestamp: priorSnap?.certifiedAt?.toISOString()
      ?? priorSnap?.validatedAt?.toISOString()
      ?? priorSnap?.extractedAt?.toISOString()
      ?? null,
    tables: ['inmate_roster_snapshots'],
    recordCounts: {
      priorInmateCount: priorSnap?.inmateCount ?? null,
      priorStatus: priorSnap?.status ?? null,
    },
    evidence: priorSnap
      ? [
          `priorSnapshotId=${priorSnap.snapshotId}`,
          `rosterDate=${priorSnap.rosterDate.toISOString().slice(0, 10)}`,
          `status=${priorSnap.status}`,
        ]
      : [
          `No certified/validated snapshot for ${priorStart.toISOString().slice(0, 10)}`,
          'Comparison cannot run without yesterday baseline — DailyCase stays incomplete',
        ],
    stop: !priorSnap,
  });
  if (!priorSnap) return finish(stages);

  // 7. Comparison executed
  const daily = await prisma.inmateDailyCase.findUnique({
    where: { facility_opsDate: { facility, opsDate: start } },
  });
  const comparison = daily?.comparisonId
    ? await prisma.inmateBatchComparison.findUnique({ where: { comparisonId: daily.comparisonId } })
    : null;
  const compared = Boolean(
    comparison
    || (daily && ['compared', 'report_ready', 'enriching', 'enriched', 'closed'].includes(daily.status)),
  );
  stages.push({
    stage: 'Comparison executed',
    verdict: compared ? 'PASS' : 'FAIL',
    timestamp: comparison?.createdAt?.toISOString() ?? daily?.updatedAt?.toISOString() ?? null,
    tables: ['inmate_daily_cases', 'inmate_batch_comparisons'],
    recordCounts: {
      dailyStatus: daily?.status ?? null,
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
          comparison ? `comparisonId=${comparison.comparisonId}` : 'No InmateBatchComparison row',
        ]
      : ['No InmateDailyCase for ops date — attachUploadToDailyCase never ran or failed silently'],
    stop: !compared,
  });
  if (!compared) return finish(stages);

  // 8. New inmate list generated
  const reportable = daily?.newInmateCount ?? comparison?.newInmates ?? null;
  stages.push({
    stage: 'New inmate list generated',
    verdict: reportable != null ? 'PASS' : 'FAIL',
    timestamp: daily?.updatedAt?.toISOString() ?? null,
    tables: ['inmate_daily_cases', 'inmate_batch_comparisons'],
    recordCounts: { newInmates: reportable },
    evidence: [
      `DailyCase.newInmateCount=${daily?.newInmateCount ?? 'null'}`,
      'Source of truth must be DailyCase set-diff — NOT inmateBooking.isFirstAppearance without facility/date',
    ],
  });

  // 9. Morning Operations updated (can it see DailyCase?)
  const boardReadable = Boolean(daily?.currentPdfBatchId || batch);
  stages.push({
    stage: 'Morning Operations updated',
    verdict: boardReadable ? 'PASS' : 'FAIL',
    timestamp: null,
    tables: ['inmate_daily_cases', 'inmate_roster_uploads', 'inmate_ingestion_batches'],
    recordCounts: {},
    evidence: [
      'Morning Board reads upload/batch/DailyCase for today (UTC)',
      'Operations Console getMorningSummary historically ignored DailyCase and counted batches by startedAt — can claim "no roster for N hours" while upload exists',
      boardReadable
        ? 'DailyCase/batch present — board should reflect pipeline if wired to DailyCase'
        : 'No DailyCase current batch — board will show incomplete',
    ],
  });

  // 10. Today's New Inmates updated
  const firstAppSample = await prisma.inmateBooking.findMany({
    where: { isFirstAppearance: true },
    orderBy: { bookedAt: 'desc' },
    take: 5,
    include: { inmate: { select: { canonicalLast: true, identityConfidence: true } } },
  });
  stages.push({
    stage: "Today's New Inmates updated",
    verdict: reportable != null && daily ? 'PASS' : 'FAIL',
    timestamp: null,
    tables: ['inmate_bookings (WRONG default path)', 'inmate_daily_cases (CORRECT path)'],
    recordCounts: {
      dailyCaseNew: daily?.newInmateCount ?? null,
      globalFirstAppearanceSample: firstAppSample.length,
    },
    evidence: [
      'DEFECT: NewInmates.tsx defaulted to getNewInmates without facility+from → global isFirstAppearance history',
      `Sample isFirstAppearance rows (stale risk): ${firstAppSample.map((b) => `${b.inmate.canonicalLast}@${b.bookedAt.toISOString().slice(0, 10)}`).join(', ') || 'none'}`,
      'Fix: require Sacramento + opsDate DailyCase set-diff; empty → "No certified results available"',
    ],
  });

  // 11. Report generated
  const report = daily?.initialReportId
    ? await prisma.inmateIntelligenceReport.findUnique({ where: { reportId: daily.initialReportId } })
    : await prisma.inmateIntelligenceReport.findFirst({
        where: {
          reportType: { in: ['new_inmates', 'daily_intelligence'] },
          generatedAt: { gte: start },
        },
        orderBy: { generatedAt: 'desc' },
      });
  stages.push({
    stage: 'Report generated',
    verdict: report ? 'PASS' : 'FAIL',
    timestamp: report?.generatedAt?.toISOString() ?? null,
    tables: ['inmate_intelligence_reports'],
    recordCounts: {
      rowCount: report?.rowCount ?? null,
      approvalState: report?.approvalState ?? null,
    },
    evidence: report
      ? [`reportId=${report.reportId}`, `approvalState=${report.approvalState}`]
      : ['No report for ops date — comparison may not have auto-generated'],
  });

  return finish(stages);
}

function finish(stages: Stage[]) {
  const firstFail = stages.find((s) => s.verdict === 'FAIL' || s.verdict === 'BLOCKED');
  const report = {
    facility: 'sacramento',
    opsDate,
    generatedAt: new Date().toISOString(),
    overall: firstFail ? 'PIPELINE_BROKEN' : 'PIPELINE_COMPLETE',
    stoppedAt: firstFail?.stage ?? null,
    downstreamStaleReason: firstFail
      ? `Pipeline stopped at "${firstFail.stage}". Downstream screens that do not share DailyCase will show stale upload UI, empty morning board, or historical isFirstAppearance rows.`
      : null,
    stages,
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
