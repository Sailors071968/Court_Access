-- CreateTable
CREATE TABLE "inmate_roster_uploads" (
    "uploadId" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "fileKind" TEXT NOT NULL,
    "rosterDate" TIMESTAMP(3),
    "rosterKind" TEXT NOT NULL DEFAULT 'full_population',
    "uploadedById" TEXT NOT NULL,
    "uploadedByName" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "stage" TEXT,
    "progressDone" INTEGER,
    "progressTotal" INTEGER,
    "batchId" TEXT,
    "processingStartedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "failureReason" TEXT,
    "resultCounts" JSONB,

    CONSTRAINT "inmate_roster_uploads_pkey" PRIMARY KEY ("uploadId")
);

-- CreateIndex
CREATE INDEX "inmate_roster_uploads_facility_uploadedAt_idx" ON "inmate_roster_uploads"("facility", "uploadedAt");

-- CreateIndex
CREATE INDEX "inmate_roster_uploads_status_uploadedAt_idx" ON "inmate_roster_uploads"("status", "uploadedAt");

-- CreateIndex
CREATE INDEX "inmate_roster_uploads_batchId_idx" ON "inmate_roster_uploads"("batchId");
