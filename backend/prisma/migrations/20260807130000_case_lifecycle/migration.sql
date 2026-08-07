-- CreateTable
CREATE TABLE "case_stage_events" (
    "caseStageEventId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "previousStage" TEXT,
    "source" TEXT NOT NULL DEFAULT 'inferred',
    "basis" TEXT NOT NULL,
    "overriddenById" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_stage_events_pkey" PRIMARY KEY ("caseStageEventId")
);

-- CreateIndex
CREATE INDEX "case_stage_events_caseId_occurredAt_idx" ON "case_stage_events"("caseId", "occurredAt");

