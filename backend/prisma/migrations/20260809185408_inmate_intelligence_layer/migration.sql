-- AlterTable
ALTER TABLE "inmate_ingestion_batches" ADD COLUMN     "normalizationVersion" TEXT,
ADD COLUMN     "ocrVersion" TEXT,
ADD COLUMN     "parserProfileId" TEXT,
ADD COLUMN     "parserVersion" INTEGER;

-- CreateTable
CREATE TABLE "inmate_intelligence_items" (
    "itemId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "subjectKind" TEXT NOT NULL,
    "subjectId" TEXT,
    "relatedKind" TEXT,
    "relatedId" TEXT,
    "confidence" INTEGER NOT NULL,
    "rule" TEXT,
    "explanation" TEXT NOT NULL,
    "disposition" TEXT NOT NULL DEFAULT 'proposed',
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "evidenceObservationIds" TEXT[],
    "inputs" JSONB,
    "payload" JSONB,
    "detailTable" TEXT,
    "detailId" TEXT,
    "ruleVersion" TEXT,
    "confidenceVersion" TEXT,
    "parserProfileId" TEXT,
    "parserVersion" TEXT,
    "normalizationVersion" TEXT,
    "nameKeyVersion" TEXT,
    "runId" TEXT,
    "supersedesId" TEXT,
    "supersededById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_intelligence_items_pkey" PRIMARY KEY ("itemId")
);

-- CreateTable
CREATE TABLE "inmate_intelligence_events" (
    "eventId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromDisposition" TEXT,
    "toDisposition" TEXT,
    "actorId" TEXT,
    "actorEngineVersion" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_intelligence_events_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "inmate_intelligence_runs" (
    "runId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'reprocess',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scope" JSONB,
    "baselineRunId" TEXT,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsUnchanged" INTEGER NOT NULL DEFAULT 0,
    "itemsChanged" INTEGER NOT NULL DEFAULT 0,
    "itemsNew" INTEGER NOT NULL DEFAULT 0,
    "itemsWithdrawn" INTEGER NOT NULL DEFAULT 0,
    "comparison" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "triggeredById" TEXT,
    "promotedById" TEXT,
    "promotedAt" TIMESTAMP(3),

    CONSTRAINT "inmate_intelligence_runs_pkey" PRIMARY KEY ("runId")
);

-- CreateTable
CREATE TABLE "inmate_parser_profiles" (
    "profileId" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "columnMap" JSONB NOT NULL,
    "parseOptions" JSONB,
    "normalizationVersion" TEXT,
    "ocrVersion" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "changeNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_parser_profiles_pkey" PRIMARY KEY ("profileId")
);

-- CreateIndex
CREATE INDEX "inmate_intelligence_items_disposition_reviewRequired_create_idx" ON "inmate_intelligence_items"("disposition", "reviewRequired", "createdAt");

-- CreateIndex
CREATE INDEX "inmate_intelligence_items_engine_engineVersion_createdAt_idx" ON "inmate_intelligence_items"("engine", "engineVersion", "createdAt");

-- CreateIndex
CREATE INDEX "inmate_intelligence_items_type_createdAt_idx" ON "inmate_intelligence_items"("type", "createdAt");

-- CreateIndex
CREATE INDEX "inmate_intelligence_items_subjectKind_subjectId_idx" ON "inmate_intelligence_items"("subjectKind", "subjectId");

-- CreateIndex
CREATE INDEX "inmate_intelligence_items_runId_idx" ON "inmate_intelligence_items"("runId");

-- CreateIndex
CREATE INDEX "inmate_intelligence_items_supersededById_idx" ON "inmate_intelligence_items"("supersededById");

-- CreateIndex
CREATE INDEX "inmate_intelligence_items_batchId_idx" ON "inmate_intelligence_items"("batchId");

-- CreateIndex
CREATE INDEX "inmate_intelligence_events_itemId_createdAt_idx" ON "inmate_intelligence_events"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "inmate_intelligence_events_action_createdAt_idx" ON "inmate_intelligence_events"("action", "createdAt");

-- CreateIndex
CREATE INDEX "inmate_intelligence_runs_engine_status_startedAt_idx" ON "inmate_intelligence_runs"("engine", "status", "startedAt");

-- CreateIndex
CREATE INDEX "inmate_intelligence_runs_mode_status_idx" ON "inmate_intelligence_runs"("mode", "status");

-- CreateIndex
CREATE INDEX "inmate_parser_profiles_facility_sourceType_active_idx" ON "inmate_parser_profiles"("facility", "sourceType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "inmate_parser_profiles_facility_sourceType_version_key" ON "inmate_parser_profiles"("facility", "sourceType", "version");

-- AddForeignKey
ALTER TABLE "inmate_intelligence_items" ADD CONSTRAINT "inmate_intelligence_items_runId_fkey" FOREIGN KEY ("runId") REFERENCES "inmate_intelligence_runs"("runId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inmate_intelligence_events" ADD CONSTRAINT "inmate_intelligence_events_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inmate_intelligence_items"("itemId") ON DELETE CASCADE ON UPDATE CASCADE;
