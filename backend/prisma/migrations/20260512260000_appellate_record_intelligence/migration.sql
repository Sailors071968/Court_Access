-- Phase E.1: Appellate Record Intelligence + Error Preservation Framework
-- Additive only. No existing tables modified.

-- ErrorPreservationRecord
CREATE TABLE "error_preservation_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "errorDescription" TEXT NOT NULL,
    "preservedBy" TEXT NOT NULL,
    "preservationStatus" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "trialPhase" TEXT NOT NULL,
    "rulingDescription" TEXT,
    "rulingDate" TEXT,
    "judgeResponse" TEXT,
    "citedText" TEXT,
    "citedPage" INTEGER,
    "citedLine" INTEGER,
    "citedDocument" TEXT,
    "appellateRelevance" TEXT NOT NULL,
    "standardOfReview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "error_preservation_records_pkey" PRIMARY KEY ("id")
);

-- ObjectionHistoryEntry
CREATE TABLE "objection_history_entries" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "objectionType" TEXT NOT NULL,
    "evidenceCodeSection" TEXT,
    "objectedTo" TEXT NOT NULL,
    "objectedBy" TEXT NOT NULL DEFAULT 'defense',
    "ruling" TEXT NOT NULL,
    "trialPhase" TEXT NOT NULL,
    "witnessOnStand" TEXT,
    "citedText" TEXT,
    "citedPage" INTEGER,
    "citedLine" INTEGER,
    "citedDocument" TEXT,
    "followUpAction" TEXT,
    "preservedForAppeal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "objection_history_entries_pkey" PRIMARY KEY ("id")
);

-- HarmlessPrejudicialError
CREATE TABLE "harmless_prejudicial_errors" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "errorPreservationId" TEXT,
    "errorDescription" TEXT NOT NULL,
    "errorClassification" TEXT NOT NULL,
    "prejudiceLevel" TEXT NOT NULL,
    "chapmanAnalysis" TEXT NOT NULL,
    "watsonAnalysis" TEXT,
    "affectedElements" TEXT NOT NULL,
    "strengthOfRemaining" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "cumulativeEffect" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "harmless_prejudicial_errors_pkey" PRIMARY KEY ("id")
);

-- WaiverForfeitureIssue
CREATE TABLE "waiver_forfeiture_issues" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "issueDescription" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "detectionMethod" TEXT NOT NULL,
    "trialPhase" TEXT NOT NULL,
    "potentialAppellateIssue" TEXT NOT NULL,
    "exceptionApplicable" TEXT,
    "exceptionAnalysis" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "waiver_forfeiture_issues_pkey" PRIMARY KEY ("id")
);

-- ConstitutionalClaimPreservation
CREATE TABLE "constitutional_claim_preservations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "constitutionalIssueId" TEXT,
    "amendment" TEXT NOT NULL,
    "claimType" TEXT NOT NULL,
    "preservationStatus" TEXT NOT NULL,
    "preservationMethod" TEXT NOT NULL,
    "federalStateDistinction" TEXT NOT NULL,
    "standardOfReview" TEXT NOT NULL,
    "appellateStrength" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "constitutional_claim_preservations_pkey" PRIMARY KEY ("id")
);

-- RecordCompletenessEntry
CREATE TABLE "record_completeness_entries" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "importance" TEXT NOT NULL,
    "appellateImpact" TEXT NOT NULL,
    "settlementNeeded" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "record_completeness_entries_pkey" PRIMARY KEY ("id")
);

-- AppellateIssueIndex
CREATE TABLE "appellate_issue_indexes" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "issueTitle" TEXT NOT NULL,
    "issueCategory" TEXT NOT NULL,
    "preservationStatus" TEXT NOT NULL,
    "standardOfReview" TEXT NOT NULL,
    "prejudiceAnalysis" TEXT NOT NULL,
    "meritStrength" TEXT NOT NULL,
    "appellateRanking" INTEGER NOT NULL DEFAULT 0,
    "supportingRecords" TEXT NOT NULL,
    "opposingArguments" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appellate_issue_indexes_pkey" PRIMARY KEY ("id")
);

-- InstructionalError
CREATE TABLE "instructional_errors" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instructionId" TEXT,
    "instructionNumber" INTEGER,
    "errorType" TEXT NOT NULL,
    "errorDescription" TEXT NOT NULL,
    "requestedInstruction" TEXT,
    "givenInstruction" TEXT,
    "legalBasis" TEXT NOT NULL,
    "prejudiceLevel" TEXT NOT NULL,
    "preservedByObjection" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "instructional_errors_pkey" PRIMARY KEY ("id")
);

-- ProsecutorialMisconductEntry
CREATE TABLE "prosecutorial_misconduct_entries" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "misconductType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "trialPhase" TEXT NOT NULL,
    "citedText" TEXT,
    "citedPage" INTEGER,
    "citedLine" INTEGER,
    "citedDocument" TEXT,
    "objectionMade" BOOLEAN NOT NULL DEFAULT false,
    "objectionRuling" TEXT,
    "curativeInstruction" BOOLEAN NOT NULL DEFAULT false,
    "prejudiceLevel" TEXT NOT NULL,
    "preservedForAppeal" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prosecutorial_misconduct_entries_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "error_preservation_records_caseId_idx" ON "error_preservation_records"("caseId");
CREATE INDEX "error_preservation_records_errorType_idx" ON "error_preservation_records"("errorType");
CREATE INDEX "error_preservation_records_preservationStatus_idx" ON "error_preservation_records"("preservationStatus");
CREATE INDEX "error_preservation_records_appellateRelevance_idx" ON "error_preservation_records"("appellateRelevance");

CREATE INDEX "objection_history_entries_caseId_idx" ON "objection_history_entries"("caseId");
CREATE INDEX "objection_history_entries_objectionType_idx" ON "objection_history_entries"("objectionType");
CREATE INDEX "objection_history_entries_ruling_idx" ON "objection_history_entries"("ruling");
CREATE INDEX "objection_history_entries_preservedForAppeal_idx" ON "objection_history_entries"("preservedForAppeal");

CREATE INDEX "harmless_prejudicial_errors_caseId_idx" ON "harmless_prejudicial_errors"("caseId");
CREATE INDEX "harmless_prejudicial_errors_prejudiceLevel_idx" ON "harmless_prejudicial_errors"("prejudiceLevel");
CREATE INDEX "harmless_prejudicial_errors_errorClassification_idx" ON "harmless_prejudicial_errors"("errorClassification");

CREATE INDEX "waiver_forfeiture_issues_caseId_idx" ON "waiver_forfeiture_issues"("caseId");
CREATE INDEX "waiver_forfeiture_issues_issueType_idx" ON "waiver_forfeiture_issues"("issueType");
CREATE INDEX "waiver_forfeiture_issues_detectionMethod_idx" ON "waiver_forfeiture_issues"("detectionMethod");

CREATE INDEX "constitutional_claim_preservations_caseId_idx" ON "constitutional_claim_preservations"("caseId");
CREATE INDEX "constitutional_claim_preservations_amendment_idx" ON "constitutional_claim_preservations"("amendment");
CREATE INDEX "constitutional_claim_preservations_preservationStatus_idx" ON "constitutional_claim_preservations"("preservationStatus");
CREATE INDEX "constitutional_claim_preservations_appellateStrength_idx" ON "constitutional_claim_preservations"("appellateStrength");

CREATE INDEX "record_completeness_entries_caseId_idx" ON "record_completeness_entries"("caseId");
CREATE INDEX "record_completeness_entries_recordType_idx" ON "record_completeness_entries"("recordType");
CREATE INDEX "record_completeness_entries_status_idx" ON "record_completeness_entries"("status");

CREATE INDEX "appellate_issue_indexes_caseId_idx" ON "appellate_issue_indexes"("caseId");
CREATE INDEX "appellate_issue_indexes_issueCategory_idx" ON "appellate_issue_indexes"("issueCategory");
CREATE INDEX "appellate_issue_indexes_meritStrength_idx" ON "appellate_issue_indexes"("meritStrength");
CREATE INDEX "appellate_issue_indexes_appellateRanking_idx" ON "appellate_issue_indexes"("appellateRanking");

CREATE INDEX "instructional_errors_caseId_idx" ON "instructional_errors"("caseId");
CREATE INDEX "instructional_errors_errorType_idx" ON "instructional_errors"("errorType");
CREATE INDEX "instructional_errors_prejudiceLevel_idx" ON "instructional_errors"("prejudiceLevel");

CREATE INDEX "prosecutorial_misconduct_entries_caseId_idx" ON "prosecutorial_misconduct_entries"("caseId");
CREATE INDEX "prosecutorial_misconduct_entries_misconductType_idx" ON "prosecutorial_misconduct_entries"("misconductType");
CREATE INDEX "prosecutorial_misconduct_entries_prejudiceLevel_idx" ON "prosecutorial_misconduct_entries"("prejudiceLevel");
CREATE INDEX "prosecutorial_misconduct_entries_preservedForAppeal_idx" ON "prosecutorial_misconduct_entries"("preservedForAppeal");
