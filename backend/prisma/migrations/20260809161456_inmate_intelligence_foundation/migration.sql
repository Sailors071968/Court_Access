-- CreateTable
CREATE TABLE "inmate_ingestion_batches" (
    "batchId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "rosterDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "recordsTotal" INTEGER NOT NULL DEFAULT 0,
    "recordsNew" INTEGER NOT NULL DEFAULT 0,
    "recordsMatched" INTEGER NOT NULL DEFAULT 0,
    "recordsDuplicate" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "recordsForReview" INTEGER NOT NULL DEFAULT 0,
    "extractionStats" JSONB,
    "triggeredBy" TEXT NOT NULL DEFAULT 'cli',
    "ingestedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "notes" TEXT,

    CONSTRAINT "inmate_ingestion_batches_pkey" PRIMARY KEY ("batchId")
);

-- CreateTable
CREATE TABLE "inmate_ingestion_records" (
    "recordId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "normalizedPayload" JSONB NOT NULL,
    "resolution" TEXT NOT NULL,
    "resolvedInmateId" TEXT,
    "bookingId" TEXT,
    "confidence" INTEGER,
    "matchTier" TEXT,
    "matchEvidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_ingestion_records_pkey" PRIMARY KEY ("recordId")
);

-- CreateTable
CREATE TABLE "inmate_ingestion_issues" (
    "issueId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "lineNumber" INTEGER,
    "severity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_ingestion_issues_pkey" PRIMARY KEY ("issueId")
);

-- CreateTable
CREATE TABLE "inmates" (
    "inmateId" TEXT NOT NULL,
    "canonicalFirst" TEXT NOT NULL,
    "canonicalLast" TEXT NOT NULL,
    "canonicalMiddle" TEXT,
    "suffix" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "sex" TEXT,
    "race" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookingCount" INTEGER NOT NULL DEFAULT 0,
    "identityConfidence" INTEGER NOT NULL DEFAULT 100,
    "mergeEvidence" JSONB,
    "mergedIntoId" TEXT,
    "mergedById" TEXT,
    "mergedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inmates_pkey" PRIMARY KEY ("inmateId")
);

-- CreateTable
CREATE TABLE "inmate_aliases" (
    "aliasId" TEXT NOT NULL,
    "inmateId" TEXT NOT NULL,
    "first" TEXT NOT NULL,
    "last" TEXT NOT NULL,
    "middle" TEXT,
    "suffix" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "sourceBatchId" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_aliases_pkey" PRIMARY KEY ("aliasId")
);

-- CreateTable
CREATE TABLE "inmate_bookings" (
    "bookingId" TEXT NOT NULL,
    "inmateId" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "externalBookingId" TEXT,
    "bookedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "arrestingAgency" TEXT,
    "bailAmountCents" BIGINT,
    "housingLocation" TEXT,
    "contentHash" TEXT NOT NULL,
    "sourceBatchId" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "isFirstAppearance" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_bookings_pkey" PRIMARY KEY ("bookingId")
);

-- CreateTable
CREATE TABLE "inmate_booking_charges" (
    "chargeId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "statuteCode" TEXT,
    "statuteSection" TEXT,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'unknown',
    "counts" INTEGER NOT NULL DEFAULT 1,
    "bailAmountCents" BIGINT,
    "rawText" TEXT NOT NULL,

    CONSTRAINT "inmate_booking_charges_pkey" PRIMARY KEY ("chargeId")
);

-- CreateTable
CREATE TABLE "inmate_watch_list_entries" (
    "entryId" TEXT NOT NULL,
    "inmateId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnRebooking" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "inmate_watch_list_entries_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "inmate_access_logs" (
    "logId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "inmateId" TEXT,
    "batchId" TEXT,
    "parameters" JSONB,
    "resultCount" INTEGER,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_access_logs_pkey" PRIMARY KEY ("logId")
);

-- CreateIndex
CREATE INDEX "inmate_ingestion_batches_facility_rosterDate_idx" ON "inmate_ingestion_batches"("facility", "rosterDate");

-- CreateIndex
CREATE INDEX "inmate_ingestion_batches_sourceSha256_idx" ON "inmate_ingestion_batches"("sourceSha256");

-- CreateIndex
CREATE INDEX "inmate_ingestion_batches_status_startedAt_idx" ON "inmate_ingestion_batches"("status", "startedAt");

-- CreateIndex
CREATE INDEX "inmate_ingestion_records_batchId_resolution_idx" ON "inmate_ingestion_records"("batchId", "resolution");

-- CreateIndex
CREATE INDEX "inmate_ingestion_records_resolvedInmateId_idx" ON "inmate_ingestion_records"("resolvedInmateId");

-- CreateIndex
CREATE INDEX "inmate_ingestion_issues_batchId_severity_idx" ON "inmate_ingestion_issues"("batchId", "severity");

-- CreateIndex
CREATE INDEX "inmates_canonicalLast_canonicalFirst_dateOfBirth_idx" ON "inmates"("canonicalLast", "canonicalFirst", "dateOfBirth");

-- CreateIndex
CREATE INDEX "inmates_dateOfBirth_idx" ON "inmates"("dateOfBirth");

-- CreateIndex
CREATE INDEX "inmates_lastSeenAt_idx" ON "inmates"("lastSeenAt");

-- CreateIndex
CREATE INDEX "inmates_mergedIntoId_idx" ON "inmates"("mergedIntoId");

-- CreateIndex
CREATE INDEX "inmate_aliases_last_first_dateOfBirth_idx" ON "inmate_aliases"("last", "first", "dateOfBirth");

-- CreateIndex
CREATE UNIQUE INDEX "inmate_aliases_inmateId_last_first_middle_dateOfBirth_key" ON "inmate_aliases"("inmateId", "last", "first", "middle", "dateOfBirth");

-- CreateIndex
CREATE UNIQUE INDEX "inmate_bookings_contentHash_key" ON "inmate_bookings"("contentHash");

-- CreateIndex
CREATE INDEX "inmate_bookings_inmateId_bookedAt_idx" ON "inmate_bookings"("inmateId", "bookedAt");

-- CreateIndex
CREATE INDEX "inmate_bookings_bookedAt_idx" ON "inmate_bookings"("bookedAt");

-- CreateIndex
CREATE INDEX "inmate_bookings_facility_externalBookingId_idx" ON "inmate_bookings"("facility", "externalBookingId");

-- CreateIndex
CREATE INDEX "inmate_bookings_isFirstAppearance_bookedAt_idx" ON "inmate_bookings"("isFirstAppearance", "bookedAt");

-- CreateIndex
CREATE INDEX "inmate_booking_charges_bookingId_idx" ON "inmate_booking_charges"("bookingId");

-- CreateIndex
CREATE INDEX "inmate_booking_charges_statuteCode_statuteSection_idx" ON "inmate_booking_charges"("statuteCode", "statuteSection");

-- CreateIndex
CREATE INDEX "inmate_watch_list_entries_active_idx" ON "inmate_watch_list_entries"("active");

-- CreateIndex
CREATE UNIQUE INDEX "inmate_watch_list_entries_inmateId_createdById_key" ON "inmate_watch_list_entries"("inmateId", "createdById");

-- CreateIndex
CREATE INDEX "inmate_access_logs_userId_createdAt_idx" ON "inmate_access_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "inmate_access_logs_action_createdAt_idx" ON "inmate_access_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "inmate_access_logs_inmateId_idx" ON "inmate_access_logs"("inmateId");

-- AddForeignKey
ALTER TABLE "inmate_ingestion_records" ADD CONSTRAINT "inmate_ingestion_records_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inmate_ingestion_batches"("batchId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inmate_ingestion_issues" ADD CONSTRAINT "inmate_ingestion_issues_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inmate_ingestion_batches"("batchId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inmate_aliases" ADD CONSTRAINT "inmate_aliases_inmateId_fkey" FOREIGN KEY ("inmateId") REFERENCES "inmates"("inmateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inmate_aliases" ADD CONSTRAINT "inmate_aliases_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "inmate_ingestion_batches"("batchId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inmate_bookings" ADD CONSTRAINT "inmate_bookings_inmateId_fkey" FOREIGN KEY ("inmateId") REFERENCES "inmates"("inmateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inmate_bookings" ADD CONSTRAINT "inmate_bookings_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "inmate_ingestion_batches"("batchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inmate_booking_charges" ADD CONSTRAINT "inmate_booking_charges_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "inmate_bookings"("bookingId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inmate_watch_list_entries" ADD CONSTRAINT "inmate_watch_list_entries_inmateId_fkey" FOREIGN KEY ("inmateId") REFERENCES "inmates"("inmateId") ON DELETE CASCADE ON UPDATE CASCADE;
