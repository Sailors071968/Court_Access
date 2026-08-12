-- AlterTable
ALTER TABLE "inmate_ingestion_batches" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "lifecycleState" TEXT NOT NULL DEFAULT 'uploaded';

-- AlterTable
ALTER TABLE "inmate_intelligence_reports" ADD COLUMN     "approvalNote" TEXT,
ADD COLUMN     "approvalState" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "batchIds" TEXT[],
ADD COLUMN     "printCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "printedAt" TIMESTAMP(3),
ADD COLUMN     "printedById" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "supersedeReason" TEXT,
ADD COLUMN     "supersedesReportId" TEXT;

-- CreateTable
CREATE TABLE "inmate_batch_transitions" (
    "transitionId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "parserProfileId" TEXT,
    "parserVersion" INTEGER,
    "normalizationVersion" TEXT,
    "resolverVersion" TEXT,
    "mergePolicyVersion" TEXT,
    "durationMs" INTEGER,
    "metrics" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_batch_transitions_pkey" PRIMARY KEY ("transitionId")
);

-- CreateTable
CREATE TABLE "inmate_batch_comparisons" (
    "comparisonId" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "baselineBatchId" TEXT NOT NULL,
    "currentBatchId" TEXT NOT NULL,
    "baselineRosterDate" TIMESTAMP(3),
    "currentRosterDate" TIMESTAMP(3),
    "newInmates" INTEGER NOT NULL DEFAULT 0,
    "releases" INTEGER NOT NULL DEFAULT 0,
    "returns" INTEGER NOT NULL DEFAULT 0,
    "housingMoves" INTEGER NOT NULL DEFAULT 0,
    "bailChanges" INTEGER NOT NULL DEFAULT 0,
    "chargeChanges" INTEGER NOT NULL DEFAULT 0,
    "courtChanges" INTEGER NOT NULL DEFAULT 0,
    "departures" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB NOT NULL,
    "detailTruncated" BOOLEAN NOT NULL DEFAULT false,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_batch_comparisons_pkey" PRIMARY KEY ("comparisonId")
);

-- CreateIndex
CREATE INDEX "inmate_batch_transitions_batchId_occurredAt_idx" ON "inmate_batch_transitions"("batchId", "occurredAt");

-- CreateIndex
CREATE INDEX "inmate_batch_transitions_toState_occurredAt_idx" ON "inmate_batch_transitions"("toState", "occurredAt");

-- CreateIndex
CREATE INDEX "inmate_batch_comparisons_facility_generatedAt_idx" ON "inmate_batch_comparisons"("facility", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "inmate_batch_comparisons_baselineBatchId_currentBatchId_key" ON "inmate_batch_comparisons"("baselineBatchId", "currentBatchId");
