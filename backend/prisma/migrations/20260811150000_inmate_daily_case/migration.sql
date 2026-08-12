-- Daily Case: one operational day per facility (PDF-primary, CSV enrichment).
CREATE TABLE "inmate_daily_cases" (
    "caseId" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "opsDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priorRosterDate" TIMESTAMP(3),
    "currentRosterDate" TIMESTAMP(3),
    "priorPdfUploadId" TEXT,
    "priorPdfBatchId" TEXT,
    "currentPdfUploadId" TEXT,
    "currentPdfBatchId" TEXT,
    "csvUploadId" TEXT,
    "csvBatchId" TEXT,
    "initialReportId" TEXT,
    "enrichedReportId" TEXT,
    "comparisonId" TEXT,
    "newInmateCount" INTEGER NOT NULL DEFAULT 0,
    "returningInmateCount" INTEGER NOT NULL DEFAULT 0,
    "existingInmateCount" INTEGER NOT NULL DEFAULT 0,
    "exceptionCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "auditLog" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "inmate_daily_cases_pkey" PRIMARY KEY ("caseId")
);

CREATE UNIQUE INDEX "inmate_daily_cases_facility_opsDate_key" ON "inmate_daily_cases"("facility", "opsDate");
CREATE INDEX "inmate_daily_cases_facility_status_opsDate_idx" ON "inmate_daily_cases"("facility", "status", "opsDate");
CREATE INDEX "inmate_daily_cases_opsDate_idx" ON "inmate_daily_cases"("opsDate");
