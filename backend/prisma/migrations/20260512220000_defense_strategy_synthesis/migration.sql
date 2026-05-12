-- Phase D.4: Defense Strategy Synthesis + Attorney Intelligence Workspace
-- Additive only. No existing tables modified.

-- DefenseIssue
CREATE TABLE "defense_issues" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instructionId" TEXT,
    "elementId" TEXT,
    "issueType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "supportingIds" TEXT NOT NULL,
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "prosecutionImpact" TEXT NOT NULL,
    "defenseAction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defense_issues_pkey" PRIMARY KEY ("id")
);

-- MotionOpportunity
CREATE TABLE "motion_opportunities" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "motionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "factualBasis" TEXT NOT NULL,
    "supportingIds" TEXT NOT NULL,
    "citationSummary" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'identified',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motion_opportunities_pkey" PRIMARY KEY ("id")
);

-- ImpeachmentPacket
CREATE TABLE "impeachment_packets" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "totalInconsistencies" INTEGER NOT NULL DEFAULT 0,
    "totalContradictions" INTEGER NOT NULL DEFAULT 0,
    "credibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "impeachmentItems" TEXT NOT NULL,
    "crossExamTopics" TEXT NOT NULL,
    "priorStatementConflicts" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impeachment_packets_pkey" PRIMARY KEY ("id")
);

-- BurdenCollapseScore
CREATE TABLE "burden_collapse_scores" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "instructionNumber" INTEGER NOT NULL,
    "totalElements" INTEGER NOT NULL DEFAULT 0,
    "unsupportedElements" INTEGER NOT NULL DEFAULT 0,
    "contradictedElements" INTEGER NOT NULL DEFAULT 0,
    "weakElements" INTEGER NOT NULL DEFAULT 0,
    "strongElements" INTEGER NOT NULL DEFAULT 0,
    "collapseScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "collapseLevel" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "elementDetails" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "burden_collapse_scores_pkey" PRIMARY KEY ("id")
);

-- JuryReasonableDoubtStructure
CREATE TABLE "jury_reasonable_doubt_structures" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instructionId" TEXT,
    "doubtCategory" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "supportingCitations" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "juryInstruction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jury_reasonable_doubt_structures_pkey" PRIMARY KEY ("id")
);

-- Indexes: defense_issues
CREATE INDEX "defense_issues_caseId_idx" ON "defense_issues"("caseId");
CREATE INDEX "defense_issues_priority_idx" ON "defense_issues"("priority");
CREATE INDEX "defense_issues_severity_idx" ON "defense_issues"("severity");
CREATE INDEX "defense_issues_issueType_idx" ON "defense_issues"("issueType");
CREATE INDEX "defense_issues_status_idx" ON "defense_issues"("status");

-- Indexes: motion_opportunities
CREATE INDEX "motion_opportunities_caseId_idx" ON "motion_opportunities"("caseId");
CREATE INDEX "motion_opportunities_motionType_idx" ON "motion_opportunities"("motionType");
CREATE INDEX "motion_opportunities_strength_idx" ON "motion_opportunities"("strength");
CREATE INDEX "motion_opportunities_priority_idx" ON "motion_opportunities"("priority");

-- Indexes: impeachment_packets
CREATE UNIQUE INDEX "impeachment_packets_caseId_witnessName_key" ON "impeachment_packets"("caseId", "witnessName");
CREATE INDEX "impeachment_packets_caseId_idx" ON "impeachment_packets"("caseId");
CREATE INDEX "impeachment_packets_witnessName_idx" ON "impeachment_packets"("witnessName");
CREATE INDEX "impeachment_packets_credibilityScore_idx" ON "impeachment_packets"("credibilityScore");

-- Indexes: burden_collapse_scores
CREATE UNIQUE INDEX "burden_collapse_scores_caseId_instructionId_key" ON "burden_collapse_scores"("caseId", "instructionId");
CREATE INDEX "burden_collapse_scores_caseId_idx" ON "burden_collapse_scores"("caseId");
CREATE INDEX "burden_collapse_scores_collapseScore_idx" ON "burden_collapse_scores"("collapseScore");
CREATE INDEX "burden_collapse_scores_collapseLevel_idx" ON "burden_collapse_scores"("collapseLevel");

-- Indexes: jury_reasonable_doubt_structures
CREATE INDEX "jury_reasonable_doubt_structures_caseId_idx" ON "jury_reasonable_doubt_structures"("caseId");
CREATE INDEX "jury_reasonable_doubt_structures_doubtCategory_idx" ON "jury_reasonable_doubt_structures"("doubtCategory");
CREATE INDEX "jury_reasonable_doubt_structures_strength_idx" ON "jury_reasonable_doubt_structures"("strength");
