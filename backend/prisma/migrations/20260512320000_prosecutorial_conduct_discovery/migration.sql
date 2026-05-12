-- Phase G.2: Prosecutorial Conduct Intelligence + Discovery Integrity Framework
-- 10 tables for discovery tracking, Brady/Giglio materiality, disclosure chronology,
-- late disclosure, missing evidence, prosecutorial conduct, preservation, witness benefits,
-- and violation escalation. Additive only — no existing tables modified.

-- 1. Discovery Disclosure Tracker
CREATE TABLE "discovery_disclosure_trackers" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "disclosureType" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "disclosedBy" TEXT NOT NULL,
    "disclosureDate" TEXT,
    "dueDate" TEXT,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "daysPastDue" INTEGER NOT NULL DEFAULT 0,
    "completeness" TEXT NOT NULL,
    "evidenceIds" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "discovery_disclosure_trackers_pkey" PRIMARY KEY ("id")
);

-- 2. Brady Materiality Framework
CREATE TABLE "brady_materiality_frameworks" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "bradyIssueId" TEXT,
    "evidenceItem" TEXT NOT NULL,
    "materialityType" TEXT NOT NULL,
    "materialityLevel" TEXT NOT NULL,
    "favorability" TEXT NOT NULL,
    "suppressionFound" BOOLEAN NOT NULL DEFAULT false,
    "prejudiceAnalysis" TEXT NOT NULL,
    "kylesAnalysis" TEXT,
    "legalBasis" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brady_materiality_frameworks_pkey" PRIMARY KEY ("id")
);

-- 3. Giglio Impeachment Disclosure Tracking
CREATE TABLE "giglio_impeachment_disclosures" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "disclosureType" TEXT NOT NULL,
    "disclosed" BOOLEAN NOT NULL DEFAULT false,
    "disclosureTimeliness" TEXT NOT NULL,
    "impeachmentValue" TEXT NOT NULL,
    "materialityToDefense" TEXT NOT NULL,
    "napiueApplicable" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "giglio_impeachment_disclosures_pkey" PRIMARY KEY ("id")
);

-- 4. Disclosure Chronology (immutable)
CREATE TABLE "disclosure_chronologies" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" TEXT,
    "description" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "documentsProduced" INTEGER NOT NULL DEFAULT 0,
    "pagesProduced" INTEGER NOT NULL DEFAULT 0,
    "sequenceNumber" INTEGER NOT NULL DEFAULT 0,
    "complianceStatus" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "disclosure_chronologies_pkey" PRIMARY KEY ("id")
);

-- 5. Late Disclosure Detection
CREATE TABLE "late_disclosure_detections" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "disclosureTrackerId" TEXT,
    "itemDescription" TEXT NOT NULL,
    "originalDueDate" TEXT,
    "actualDisclosureDate" TEXT,
    "daysLate" INTEGER NOT NULL DEFAULT 0,
    "prejudiceToDefense" TEXT NOT NULL,
    "trialPhaseAtDisclosure" TEXT,
    "defenseRemedy" TEXT NOT NULL,
    "motionFiled" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "late_disclosure_detections_pkey" PRIMARY KEY ("id")
);

-- 6. Missing Evidence Auditing
CREATE TABLE "missing_evidence_audits" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceDescription" TEXT NOT NULL,
    "evidenceCategory" TEXT NOT NULL,
    "expectedSource" TEXT NOT NULL,
    "requestedDate" TEXT,
    "responseReceived" BOOLEAN NOT NULL DEFAULT false,
    "explanationGiven" TEXT,
    "badFaithIndicators" TEXT NOT NULL,
    "arizonaVYoungblood" BOOLEAN NOT NULL DEFAULT false,
    "materialityAssessment" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "missing_evidence_audits_pkey" PRIMARY KEY ("id")
);

-- 7. Prosecutorial Conduct Index
CREATE TABLE "prosecutorial_conduct_indexes" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "conductType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "evidenceBasis" TEXT NOT NULL,
    "patternIndicator" BOOLEAN NOT NULL DEFAULT false,
    "harmlessOrPrejudicial" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prosecutorial_conduct_indexes_pkey" PRIMARY KEY ("id")
);

-- 8. Disclosure Preservation Graph (immutable)
CREATE TABLE "disclosure_preservation_graphs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "disclosureType" TEXT NOT NULL,
    "preservationChain" TEXT NOT NULL,
    "chainLength" INTEGER NOT NULL DEFAULT 0,
    "currentStatus" TEXT NOT NULL,
    "requestDate" TEXT,
    "lastProductionDate" TEXT,
    "outstandingItems" INTEGER NOT NULL DEFAULT 0,
    "riskOfSpoliation" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "disclosure_preservation_graphs_pkey" PRIMARY KEY ("id")
);

-- 9. Witness Benefit Disclosure Tracking
CREATE TABLE "witness_benefit_disclosures" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "benefitType" TEXT NOT NULL,
    "benefitDescription" TEXT NOT NULL,
    "disclosed" BOOLEAN NOT NULL DEFAULT false,
    "disclosureDate" TEXT,
    "disclosureTimeliness" TEXT NOT NULL,
    "impeachmentRelevance" TEXT NOT NULL,
    "giglioApplicable" BOOLEAN NOT NULL DEFAULT true,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "witness_benefit_disclosures_pkey" PRIMARY KEY ("id")
);

-- 10. Discovery Violation Escalation Framework
CREATE TABLE "discovery_violation_escalations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "violationType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "escalationLevel" TEXT NOT NULL,
    "currentPhase" TEXT NOT NULL,
    "prejudiceAssessment" TEXT NOT NULL,
    "remedySought" TEXT NOT NULL,
    "legalAuthority" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "discovery_violation_escalations_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "discovery_disclosure_trackers_caseId_idx" ON "discovery_disclosure_trackers"("caseId");
CREATE INDEX "discovery_disclosure_trackers_disclosureType_idx" ON "discovery_disclosure_trackers"("disclosureType");
CREATE INDEX "discovery_disclosure_trackers_isLate_idx" ON "discovery_disclosure_trackers"("isLate");

CREATE INDEX "brady_materiality_frameworks_caseId_idx" ON "brady_materiality_frameworks"("caseId");
CREATE INDEX "brady_materiality_frameworks_materialityLevel_idx" ON "brady_materiality_frameworks"("materialityLevel");
CREATE INDEX "brady_materiality_frameworks_suppressionFound_idx" ON "brady_materiality_frameworks"("suppressionFound");

CREATE INDEX "giglio_impeachment_disclosures_caseId_idx" ON "giglio_impeachment_disclosures"("caseId");
CREATE INDEX "giglio_impeachment_disclosures_witnessName_idx" ON "giglio_impeachment_disclosures"("witnessName");
CREATE INDEX "giglio_impeachment_disclosures_disclosed_idx" ON "giglio_impeachment_disclosures"("disclosed");

CREATE INDEX "disclosure_chronologies_caseId_idx" ON "disclosure_chronologies"("caseId");
CREATE INDEX "disclosure_chronologies_eventType_idx" ON "disclosure_chronologies"("eventType");
CREATE INDEX "disclosure_chronologies_sequenceNumber_idx" ON "disclosure_chronologies"("sequenceNumber");

CREATE INDEX "late_disclosure_detections_caseId_idx" ON "late_disclosure_detections"("caseId");
CREATE INDEX "late_disclosure_detections_daysLate_idx" ON "late_disclosure_detections"("daysLate");
CREATE INDEX "late_disclosure_detections_prejudiceToDefense_idx" ON "late_disclosure_detections"("prejudiceToDefense");

CREATE INDEX "missing_evidence_audits_caseId_idx" ON "missing_evidence_audits"("caseId");
CREATE INDEX "missing_evidence_audits_evidenceCategory_idx" ON "missing_evidence_audits"("evidenceCategory");
CREATE INDEX "missing_evidence_audits_materialityAssessment_idx" ON "missing_evidence_audits"("materialityAssessment");

CREATE INDEX "prosecutorial_conduct_indexes_caseId_idx" ON "prosecutorial_conduct_indexes"("caseId");
CREATE INDEX "prosecutorial_conduct_indexes_conductType_idx" ON "prosecutorial_conduct_indexes"("conductType");
CREATE INDEX "prosecutorial_conduct_indexes_severity_idx" ON "prosecutorial_conduct_indexes"("severity");

CREATE INDEX "disclosure_preservation_graphs_caseId_idx" ON "disclosure_preservation_graphs"("caseId");
CREATE INDEX "disclosure_preservation_graphs_currentStatus_idx" ON "disclosure_preservation_graphs"("currentStatus");

CREATE INDEX "witness_benefit_disclosures_caseId_idx" ON "witness_benefit_disclosures"("caseId");
CREATE INDEX "witness_benefit_disclosures_witnessName_idx" ON "witness_benefit_disclosures"("witnessName");
CREATE INDEX "witness_benefit_disclosures_disclosed_idx" ON "witness_benefit_disclosures"("disclosed");

CREATE INDEX "discovery_violation_escalations_caseId_idx" ON "discovery_violation_escalations"("caseId");
CREATE INDEX "discovery_violation_escalations_violationType_idx" ON "discovery_violation_escalations"("violationType");
CREATE INDEX "discovery_violation_escalations_escalationLevel_idx" ON "discovery_violation_escalations"("escalationLevel");
