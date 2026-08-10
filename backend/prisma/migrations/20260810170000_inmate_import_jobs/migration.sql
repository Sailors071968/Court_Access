-- Import Jobs: resumable bulk upload + async processing for historical imports.

CREATE TABLE "inmate_import_jobs" (
    "jobId" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "rosterDate" TIMESTAMP(3),
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "autoProcess" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadStartedAt" TIMESTAMP(3),
    "uploadFinishedAt" TIMESTAMP(3),
    "processStartedAt" TIMESTAMP(3),
    "processFinishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "filesPending" INTEGER NOT NULL DEFAULT 0,
    "filesUploading" INTEGER NOT NULL DEFAULT 0,
    "filesUploaded" INTEGER NOT NULL DEFAULT 0,
    "filesSkippedDuplicate" INTEGER NOT NULL DEFAULT 0,
    "filesFailedUpload" INTEGER NOT NULL DEFAULT 0,
    "filesQueued" INTEGER NOT NULL DEFAULT 0,
    "filesProcessing" INTEGER NOT NULL DEFAULT 0,
    "filesCompleted" INTEGER NOT NULL DEFAULT 0,
    "filesFailedProcessing" INTEGER NOT NULL DEFAULT 0,
    "totalBytes" BIGINT NOT NULL DEFAULT 0,
    "uploadedBytes" BIGINT NOT NULL DEFAULT 0,
    "currentFilename" TEXT,
    "failureReason" TEXT,
    "metrics" JSONB,
    CONSTRAINT "inmate_import_jobs_pkey" PRIMARY KEY ("jobId")
);

CREATE INDEX "inmate_import_jobs_status_createdAt_idx" ON "inmate_import_jobs"("status", "createdAt");
CREATE INDEX "inmate_import_jobs_facility_createdAt_idx" ON "inmate_import_jobs"("facility", "createdAt");
CREATE INDEX "inmate_import_jobs_createdById_createdAt_idx" ON "inmate_import_jobs"("createdById", "createdAt");

CREATE TABLE "inmate_import_job_files" (
    "jobFileId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "fileKind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "uploadId" TEXT,
    "batchIndex" INTEGER,
    "error" TEXT,
    "duplicateOfUploadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadStartedAt" TIMESTAMP(3),
    "uploadFinishedAt" TIMESTAMP(3),
    "processStartedAt" TIMESTAMP(3),
    "processFinishedAt" TIMESTAMP(3),
    "uploadDurationMs" INTEGER,
    "processDurationMs" INTEGER,
    "rowsRead" INTEGER,
    CONSTRAINT "inmate_import_job_files_pkey" PRIMARY KEY ("jobFileId")
);

CREATE UNIQUE INDEX "inmate_import_job_files_jobId_sha256_key" ON "inmate_import_job_files"("jobId", "sha256");
CREATE INDEX "inmate_import_job_files_jobId_status_idx" ON "inmate_import_job_files"("jobId", "status");
CREATE INDEX "inmate_import_job_files_sha256_idx" ON "inmate_import_job_files"("sha256");
CREATE INDEX "inmate_import_job_files_uploadId_idx" ON "inmate_import_job_files"("uploadId");

ALTER TABLE "inmate_import_job_files" ADD CONSTRAINT "inmate_import_job_files_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "inmate_import_jobs"("jobId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inmate_roster_uploads" ADD COLUMN "jobId" TEXT;
ALTER TABLE "inmate_roster_uploads" ADD COLUMN "jobFileId" TEXT;
CREATE INDEX "inmate_roster_uploads_jobId_idx" ON "inmate_roster_uploads"("jobId");
