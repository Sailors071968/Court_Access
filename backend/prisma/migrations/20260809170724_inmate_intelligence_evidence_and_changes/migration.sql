-- AlterTable
ALTER TABLE "inmate_bookings" ADD COLUMN     "courtDate" TIMESTAMP(3),
ADD COLUMN     "custodyStatus" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN     "departedRosterAt" TIMESTAMP(3),
ADD COLUMN     "lastObservedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "inmate_ingestion_batches" ADD COLUMN     "documentId" TEXT,
ADD COLUMN     "resumeCursor" INTEGER,
ADD COLUMN     "rosterKind" TEXT NOT NULL DEFAULT 'full_population';

-- AlterTable
ALTER TABLE "inmate_ingestion_records" ADD COLUMN     "extractionConfidence" INTEGER,
ADD COLUMN     "extractionMethod" TEXT,
ADD COLUMN     "sourcePage" INTEGER;

-- CreateTable
CREATE TABLE "inmate_facilities" (
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "county" TEXT,
    "rostersAreFullPopulation" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_facilities_pkey" PRIMARY KEY ("facilityId")
);

-- CreateTable
CREATE TABLE "inmate_source_documents" (
    "documentId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "facilityCode" TEXT NOT NULL,
    "rosterDate" TIMESTAMP(3),
    "storagePath" TEXT,
    "pageCount" INTEGER,
    "pageStats" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" TEXT,

    CONSTRAINT "inmate_source_documents_pkey" PRIMARY KEY ("documentId")
);

-- CreateTable
CREATE TABLE "inmate_identity_matches" (
    "matchId" TEXT NOT NULL,
    "importRecordId" TEXT NOT NULL,
    "inmateId" TEXT,
    "tier" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "humanReviewRequired" BOOLEAN NOT NULL,
    "reviewRationale" TEXT NOT NULL,
    "resolverVersion" TEXT NOT NULL,
    "reasons" JSONB NOT NULL,
    "conflicts" JSONB NOT NULL,
    "rejectedCandidates" JSONB NOT NULL,
    "sourceDocuments" JSONB NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_identity_matches_pkey" PRIMARY KEY ("matchId")
);

-- CreateTable
CREATE TABLE "inmate_review_queue" (
    "reviewId" TEXT NOT NULL,
    "importRecordId" TEXT NOT NULL,
    "matchId" TEXT,
    "batchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "candidateInmateId" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_review_queue_pkey" PRIMARY KEY ("reviewId")
);

-- CreateTable
CREATE TABLE "inmate_booking_observations" (
    "observationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "documentId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourcePage" INTEGER,
    "sourceRow" INTEGER,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rosterDate" TIMESTAMP(3),
    "housingLocation" TEXT,
    "bailAmountCents" BIGINT,
    "releasedAt" TIMESTAMP(3),
    "courtDate" TIMESTAMP(3),
    "custodyStatus" TEXT,
    "chargeSetHash" TEXT,
    "chargeCount" INTEGER,

    CONSTRAINT "inmate_booking_observations_pkey" PRIMARY KEY ("observationId")
);

-- CreateTable
CREATE TABLE "inmate_source_conflicts" (
    "conflictId" TEXT NOT NULL,
    "bookingId" TEXT,
    "inmateId" TEXT,
    "field" TEXT NOT NULL,
    "valueA" TEXT,
    "sourceA" TEXT NOT NULL,
    "observationAId" TEXT,
    "valueB" TEXT,
    "sourceB" TEXT NOT NULL,
    "observationBId" TEXT,
    "rosterDate" TIMESTAMP(3),
    "resolution" TEXT NOT NULL DEFAULT 'unknown',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT,

    CONSTRAINT "inmate_source_conflicts_pkey" PRIMARY KEY ("conflictId")
);

-- CreateTable
CREATE TABLE "inmate_change_events" (
    "eventId" TEXT NOT NULL,
    "inmateId" TEXT,
    "bookingId" TEXT,
    "batchId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "field" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "material" BOOLEAN NOT NULL DEFAULT true,
    "observationId" TEXT,
    "rosterDate" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_change_events_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "inmate_watch_list_matches" (
    "matchId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "inmateId" TEXT NOT NULL,
    "bookingId" TEXT,
    "batchId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "rosterDate" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "inmate_watch_list_matches_pkey" PRIMARY KEY ("matchId")
);

-- CreateTable
CREATE TABLE "inmate_notifications" (
    "notificationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "inmateId" TEXT,
    "batchId" TEXT,
    "referenceId" TEXT,
    "readById" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_notifications_pkey" PRIMARY KEY ("notificationId")
);

-- CreateTable
CREATE TABLE "inmate_intelligence_reports" (
    "reportId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "renderedHtml" TEXT,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_intelligence_reports_pkey" PRIMARY KEY ("reportId")
);

-- CreateIndex
CREATE UNIQUE INDEX "inmate_facilities_code_key" ON "inmate_facilities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "inmate_source_documents_sha256_key" ON "inmate_source_documents"("sha256");

-- CreateIndex
CREATE INDEX "inmate_source_documents_facilityCode_rosterDate_idx" ON "inmate_source_documents"("facilityCode", "rosterDate");

-- CreateIndex
CREATE INDEX "inmate_identity_matches_outcome_tier_idx" ON "inmate_identity_matches"("outcome", "tier");

-- CreateIndex
CREATE INDEX "inmate_identity_matches_inmateId_idx" ON "inmate_identity_matches"("inmateId");

-- CreateIndex
CREATE INDEX "inmate_identity_matches_importRecordId_idx" ON "inmate_identity_matches"("importRecordId");

-- CreateIndex
CREATE INDEX "inmate_identity_matches_humanReviewRequired_decidedAt_idx" ON "inmate_identity_matches"("humanReviewRequired", "decidedAt");

-- CreateIndex
CREATE UNIQUE INDEX "inmate_review_queue_importRecordId_key" ON "inmate_review_queue"("importRecordId");

-- CreateIndex
CREATE INDEX "inmate_review_queue_status_createdAt_idx" ON "inmate_review_queue"("status", "createdAt");

-- CreateIndex
CREATE INDEX "inmate_review_queue_batchId_idx" ON "inmate_review_queue"("batchId");

-- CreateIndex
CREATE INDEX "inmate_booking_observations_bookingId_observedAt_idx" ON "inmate_booking_observations"("bookingId", "observedAt");

-- CreateIndex
CREATE INDEX "inmate_booking_observations_batchId_idx" ON "inmate_booking_observations"("batchId");

-- CreateIndex
CREATE INDEX "inmate_source_conflicts_resolution_detectedAt_idx" ON "inmate_source_conflicts"("resolution", "detectedAt");

-- CreateIndex
CREATE INDEX "inmate_source_conflicts_bookingId_idx" ON "inmate_source_conflicts"("bookingId");

-- CreateIndex
CREATE INDEX "inmate_source_conflicts_field_idx" ON "inmate_source_conflicts"("field");

-- CreateIndex
CREATE INDEX "inmate_change_events_batchId_changeType_idx" ON "inmate_change_events"("batchId", "changeType");

-- CreateIndex
CREATE INDEX "inmate_change_events_inmateId_detectedAt_idx" ON "inmate_change_events"("inmateId", "detectedAt");

-- CreateIndex
CREATE INDEX "inmate_change_events_changeType_rosterDate_idx" ON "inmate_change_events"("changeType", "rosterDate");

-- CreateIndex
CREATE INDEX "inmate_watch_list_matches_entryId_detectedAt_idx" ON "inmate_watch_list_matches"("entryId", "detectedAt");

-- CreateIndex
CREATE INDEX "inmate_watch_list_matches_acknowledgedAt_idx" ON "inmate_watch_list_matches"("acknowledgedAt");

-- CreateIndex
CREATE INDEX "inmate_notifications_kind_createdAt_idx" ON "inmate_notifications"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "inmate_notifications_readAt_idx" ON "inmate_notifications"("readAt");

-- CreateIndex
CREATE INDEX "inmate_intelligence_reports_reportType_generatedAt_idx" ON "inmate_intelligence_reports"("reportType", "generatedAt");

-- AddForeignKey
ALTER TABLE "inmate_ingestion_batches" ADD CONSTRAINT "inmate_ingestion_batches_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "inmate_source_documents"("documentId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inmate_source_documents" ADD CONSTRAINT "inmate_source_documents_facilityCode_fkey" FOREIGN KEY ("facilityCode") REFERENCES "inmate_facilities"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inmate_booking_observations" ADD CONSTRAINT "inmate_booking_observations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "inmate_bookings"("bookingId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inmate_watch_list_matches" ADD CONSTRAINT "inmate_watch_list_matches_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "inmate_watch_list_entries"("entryId") ON DELETE CASCADE ON UPDATE CASCADE;
