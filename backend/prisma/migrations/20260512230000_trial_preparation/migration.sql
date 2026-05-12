-- Phase D.5: Trial Preparation + Litigation Packet Generation
-- Additive only. No existing tables modified.

-- TrialExhibit
CREATE TABLE "trial_exhibits" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "exhibitNumber" TEXT NOT NULL,
    "exhibitType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "relatedIds" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "trial_exhibits_pkey" PRIMARY KEY ("id")
);

-- WitnessAttackSheet
CREATE TABLE "witness_attack_sheets" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "credibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "inconsistencySummary" TEXT NOT NULL,
    "contradictionSummary" TEXT NOT NULL,
    "crossExamTopics" TEXT NOT NULL,
    "impeachmentSequence" TEXT NOT NULL,
    "priorStatements" TEXT NOT NULL,
    "keyQuotations" TEXT NOT NULL,
    "timelineConflicts" TEXT NOT NULL,
    "overallAssessment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "witness_attack_sheets_pkey" PRIMARY KEY ("id")
);

-- CalcrimFailureMatrix
CREATE TABLE "calcrim_failure_matrices" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "instructionNumber" INTEGER NOT NULL,
    "chargeTitle" TEXT NOT NULL,
    "totalElements" INTEGER NOT NULL DEFAULT 0,
    "elementAnalysis" TEXT NOT NULL,
    "overallStatus" TEXT NOT NULL,
    "prosecutionGaps" TEXT NOT NULL,
    "defenseArguments" TEXT NOT NULL,
    "motionBasis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "calcrim_failure_matrices_pkey" PRIMARY KEY ("id")
);

-- HearingPrepPacket
CREATE TABLE "hearing_prep_packets" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "hearingType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "keyIssues" TEXT NOT NULL,
    "witnessOrder" TEXT NOT NULL,
    "exhibitList" TEXT NOT NULL,
    "motionsSummary" TEXT NOT NULL,
    "contradictionHighlights" TEXT NOT NULL,
    "burdenAnalysis" TEXT NOT NULL,
    "timelineIssues" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hearing_prep_packets_pkey" PRIMARY KEY ("id")
);

-- TrialNotebook
CREATE TABLE "trial_notebooks" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sections" TEXT NOT NULL,
    "exhibitIndex" TEXT NOT NULL,
    "witnessIndex" TEXT NOT NULL,
    "motionIndex" TEXT NOT NULL,
    "contradictionIndex" TEXT NOT NULL,
    "burdenSummary" TEXT NOT NULL,
    "timelineSummary" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "trial_notebooks_pkey" PRIMARY KEY ("id")
);

-- ExportJob
CREATE TABLE "export_jobs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceId" TEXT,
    "fileName" TEXT,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- Indexes: trial_exhibits
CREATE UNIQUE INDEX "trial_exhibits_caseId_exhibitNumber_key" ON "trial_exhibits"("caseId", "exhibitNumber");
CREATE INDEX "trial_exhibits_caseId_idx" ON "trial_exhibits"("caseId");
CREATE INDEX "trial_exhibits_exhibitType_idx" ON "trial_exhibits"("exhibitType");
CREATE INDEX "trial_exhibits_status_idx" ON "trial_exhibits"("status");

-- Indexes: witness_attack_sheets
CREATE UNIQUE INDEX "witness_attack_sheets_caseId_witnessName_key" ON "witness_attack_sheets"("caseId", "witnessName");
CREATE INDEX "witness_attack_sheets_caseId_idx" ON "witness_attack_sheets"("caseId");
CREATE INDEX "witness_attack_sheets_witnessName_idx" ON "witness_attack_sheets"("witnessName");

-- Indexes: calcrim_failure_matrices
CREATE UNIQUE INDEX "calcrim_failure_matrices_caseId_instructionId_key" ON "calcrim_failure_matrices"("caseId", "instructionId");
CREATE INDEX "calcrim_failure_matrices_caseId_idx" ON "calcrim_failure_matrices"("caseId");
CREATE INDEX "calcrim_failure_matrices_overallStatus_idx" ON "calcrim_failure_matrices"("overallStatus");

-- Indexes: hearing_prep_packets
CREATE INDEX "hearing_prep_packets_caseId_idx" ON "hearing_prep_packets"("caseId");
CREATE INDEX "hearing_prep_packets_hearingType_idx" ON "hearing_prep_packets"("hearingType");

-- Indexes: trial_notebooks
CREATE INDEX "trial_notebooks_caseId_idx" ON "trial_notebooks"("caseId");

-- Indexes: export_jobs
CREATE INDEX "export_jobs_caseId_idx" ON "export_jobs"("caseId");
CREATE INDEX "export_jobs_exportType_idx" ON "export_jobs"("exportType");
CREATE INDEX "export_jobs_status_idx" ON "export_jobs"("status");
