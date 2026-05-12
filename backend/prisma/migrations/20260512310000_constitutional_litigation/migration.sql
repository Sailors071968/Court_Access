-- Phase G.1: Constitutional Litigation Intelligence + Structural Rights Analysis
-- 10 tables for Fourth/Fifth/Sixth Amendment, due process, structural error,
-- suppression, search/seizure, interrogation, confrontation witness, preservation graph.
-- Additive only — no existing tables modified.

-- 1. Fourth Amendment Issue Framework
CREATE TABLE "fourth_amendment_issues" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "legalStandard" TEXT NOT NULL,
    "officerIdentifier" TEXT,
    "locationDescription" TEXT,
    "searchDate" TEXT,
    "warrantPresent" BOOLEAN NOT NULL DEFAULT false,
    "warrantDeficiency" TEXT,
    "consentVoluntary" BOOLEAN,
    "exclusionaryRuleApplicable" BOOLEAN NOT NULL DEFAULT true,
    "fruitOfPoisonousTree" BOOLEAN NOT NULL DEFAULT false,
    "goodFaithException" BOOLEAN NOT NULL DEFAULT false,
    "suppressionViability" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fourth_amendment_issues_pkey" PRIMARY KEY ("id")
);

-- 2. Fifth Amendment Issue Tracking
CREATE TABLE "fifth_amendment_issues" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "mirandaAdvisement" TEXT,
    "custodialStatus" TEXT,
    "interrogationContext" TEXT,
    "voluntariness" TEXT,
    "statementUsed" BOOLEAN NOT NULL DEFAULT false,
    "suppressionViability" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fifth_amendment_issues_pkey" PRIMARY KEY ("id")
);

-- 3. Sixth Amendment Confrontation Analysis
CREATE TABLE "sixth_amendment_confrontations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "confrontationType" TEXT NOT NULL,
    "testimonialStatus" TEXT NOT NULL,
    "crossExaminationAvailable" BOOLEAN NOT NULL DEFAULT true,
    "crawfordApplicable" BOOLEAN NOT NULL DEFAULT false,
    "brutonIssue" BOOLEAN NOT NULL DEFAULT false,
    "melbourneIssue" BOOLEAN NOT NULL DEFAULT false,
    "reliabilityAnalysis" TEXT,
    "confrontationViability" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sixth_amendment_confrontations_pkey" PRIMARY KEY ("id")
);

-- 4. Due Process Integrity Analysis
CREATE TABLE "due_process_integrity_issues" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amendment" TEXT NOT NULL,
    "substantiveOrProcedural" TEXT NOT NULL,
    "prejudiceLevel" TEXT NOT NULL,
    "remedyAvailable" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "due_process_integrity_issues_pkey" PRIMARY KEY ("id")
);

-- 5. Structural Error Categorization
CREATE TABLE "structural_error_categories" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "autoReversible" BOOLEAN NOT NULL DEFAULT true,
    "harmlessAnalysisRequired" BOOLEAN NOT NULL DEFAULT false,
    "constitutionalBasis" TEXT NOT NULL,
    "caseAuthority" TEXT NOT NULL,
    "trialPhase" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "structural_error_categories_pkey" PRIMARY KEY ("id")
);

-- 6. Suppression Issue Mapping
CREATE TABLE "suppression_issue_maps" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceDescription" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "constitutionalBasis" TEXT NOT NULL,
    "suppressionGround" TEXT NOT NULL,
    "motionFiled" BOOLEAN NOT NULL DEFAULT false,
    "motionRuling" TEXT,
    "alternativeAdmission" TEXT,
    "impactIfSuppressed" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "suppression_issue_maps_pkey" PRIMARY KEY ("id")
);

-- 7. Search/Seizure Chronology
CREATE TABLE "search_seizure_chronologies" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" TEXT,
    "eventTime" TEXT,
    "location" TEXT,
    "officerIdentifier" TEXT,
    "legalJustification" TEXT,
    "evidenceObtained" TEXT,
    "sequenceNumber" INTEGER NOT NULL DEFAULT 0,
    "constitutionalIssue" BOOLEAN NOT NULL DEFAULT false,
    "issueDescription" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "search_seizure_chronologies_pkey" PRIMARY KEY ("id")
);

-- 8. Custodial Interrogation Tracking
CREATE TABLE "custodial_interrogations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "interrogationDate" TEXT,
    "location" TEXT,
    "officerIdentifier" TEXT,
    "duration" TEXT,
    "mirandaGiven" BOOLEAN NOT NULL DEFAULT false,
    "mirandaWaiver" TEXT,
    "invocationOfRights" TEXT,
    "postInvocationQuestioning" BOOLEAN NOT NULL DEFAULT false,
    "coercionIndicators" TEXT NOT NULL,
    "statementObtained" BOOLEAN NOT NULL DEFAULT false,
    "voluntarinessAssessment" TEXT NOT NULL,
    "suppressionViability" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custodial_interrogations_pkey" PRIMARY KEY ("id")
);

-- 9. Confrontation Clause Witness Index
CREATE TABLE "confrontation_witness_indexes" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "witnessType" TEXT NOT NULL,
    "testimonialStatements" INTEGER NOT NULL DEFAULT 0,
    "crossExaminationOccurred" BOOLEAN NOT NULL DEFAULT false,
    "confrontationSatisfied" BOOLEAN NOT NULL DEFAULT true,
    "crawfordIssue" BOOLEAN NOT NULL DEFAULT false,
    "brutonIssue" BOOLEAN NOT NULL DEFAULT false,
    "forfeiture" BOOLEAN NOT NULL DEFAULT false,
    "reliabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "confrontation_witness_indexes_pkey" PRIMARY KEY ("id")
);

-- 10. Constitutional Preservation Graph
CREATE TABLE "constitutional_preservation_graphs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "amendment" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "preservationChain" TEXT NOT NULL,
    "chainLength" INTEGER NOT NULL DEFAULT 0,
    "currentStatus" TEXT NOT NULL,
    "firstPreservationDate" TEXT,
    "lastPreservationDate" TEXT,
    "riskOfForfeiture" BOOLEAN NOT NULL DEFAULT false,
    "requiredActions" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "constitutional_preservation_graphs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "fourth_amendment_issues_caseId_idx" ON "fourth_amendment_issues"("caseId");
CREATE INDEX "fourth_amendment_issues_issueType_idx" ON "fourth_amendment_issues"("issueType");
CREATE INDEX "fourth_amendment_issues_suppressionViability_idx" ON "fourth_amendment_issues"("suppressionViability");

CREATE INDEX "fifth_amendment_issues_caseId_idx" ON "fifth_amendment_issues"("caseId");
CREATE INDEX "fifth_amendment_issues_issueType_idx" ON "fifth_amendment_issues"("issueType");

CREATE INDEX "sixth_amendment_confrontations_caseId_idx" ON "sixth_amendment_confrontations"("caseId");
CREATE INDEX "sixth_amendment_confrontations_witnessName_idx" ON "sixth_amendment_confrontations"("witnessName");
CREATE INDEX "sixth_amendment_confrontations_confrontationType_idx" ON "sixth_amendment_confrontations"("confrontationType");

CREATE INDEX "due_process_integrity_issues_caseId_idx" ON "due_process_integrity_issues"("caseId");
CREATE INDEX "due_process_integrity_issues_issueType_idx" ON "due_process_integrity_issues"("issueType");
CREATE INDEX "due_process_integrity_issues_prejudiceLevel_idx" ON "due_process_integrity_issues"("prejudiceLevel");

CREATE INDEX "structural_error_categories_caseId_idx" ON "structural_error_categories"("caseId");
CREATE INDEX "structural_error_categories_errorType_idx" ON "structural_error_categories"("errorType");

CREATE INDEX "suppression_issue_maps_caseId_idx" ON "suppression_issue_maps"("caseId");
CREATE INDEX "suppression_issue_maps_constitutionalBasis_idx" ON "suppression_issue_maps"("constitutionalBasis");
CREATE INDEX "suppression_issue_maps_suppressionGround_idx" ON "suppression_issue_maps"("suppressionGround");

CREATE INDEX "search_seizure_chronologies_caseId_idx" ON "search_seizure_chronologies"("caseId");
CREATE INDEX "search_seizure_chronologies_eventType_idx" ON "search_seizure_chronologies"("eventType");
CREATE INDEX "search_seizure_chronologies_sequenceNumber_idx" ON "search_seizure_chronologies"("sequenceNumber");

CREATE INDEX "custodial_interrogations_caseId_idx" ON "custodial_interrogations"("caseId");
CREATE INDEX "custodial_interrogations_voluntarinessAssessment_idx" ON "custodial_interrogations"("voluntarinessAssessment");

CREATE INDEX "confrontation_witness_indexes_caseId_idx" ON "confrontation_witness_indexes"("caseId");
CREATE INDEX "confrontation_witness_indexes_witnessName_idx" ON "confrontation_witness_indexes"("witnessName");
CREATE INDEX "confrontation_witness_indexes_confrontationSatisfied_idx" ON "confrontation_witness_indexes"("confrontationSatisfied");

CREATE INDEX "constitutional_preservation_graphs_caseId_idx" ON "constitutional_preservation_graphs"("caseId");
CREATE INDEX "constitutional_preservation_graphs_amendment_idx" ON "constitutional_preservation_graphs"("amendment");
CREATE INDEX "constitutional_preservation_graphs_currentStatus_idx" ON "constitutional_preservation_graphs"("currentStatus");
