-- Phase E.2: Habeas / Post-Conviction Intelligence + Innocence Review Framework
-- Additive only. No existing tables modified.

CREATE TABLE "newly_discovered_evidence" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "discoveryDate" TEXT,
    "discoverySource" TEXT NOT NULL,
    "materialityAssessment" TEXT NOT NULL,
    "unavailableAtTrial" BOOLEAN NOT NULL DEFAULT true,
    "diligenceShown" BOOLEAN NOT NULL DEFAULT true,
    "probableOutcomeChange" TEXT NOT NULL,
    "legalStandard" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "newly_discovered_evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "actual_innocence_indicators" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "indicatorType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "supportingEvidence" TEXT NOT NULL,
    "contraryEvidence" TEXT NOT NULL,
    "schlupStandard" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "actual_innocence_indicators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ineffective_assistance_issues" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "deficiencyType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stricklandDeficiency" TEXT NOT NULL,
    "stricklandPrejudice" TEXT NOT NULL,
    "trialPhase" TEXT NOT NULL,
    "relatedObjectionId" TEXT,
    "relatedMotionId" TEXT,
    "meritAssessment" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ineffective_assistance_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brady_giglio_reassessments" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "originalBradyIssueId" TEXT,
    "reassessmentType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "materialityAnalysis" TEXT NOT NULL,
    "favorabilityAnalysis" TEXT NOT NULL,
    "suppressionAnalysis" TEXT NOT NULL,
    "cumulativeWithOther" BOOLEAN NOT NULL DEFAULT false,
    "kylesBagleyStandard" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brady_giglio_reassessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forensic_reliability_reassessments" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "forensicType" TEXT NOT NULL,
    "originalConclusion" TEXT NOT NULL,
    "currentScientificStatus" TEXT NOT NULL,
    "reliabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "nasReport2009Relevant" BOOLEAN NOT NULL DEFAULT false,
    "pcatRelevant" BOOLEAN NOT NULL DEFAULT false,
    "examinerQualifications" TEXT,
    "labAccreditation" TEXT,
    "retestingRecommended" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forensic_reliability_reassessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "witness_recantations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "originalTestimony" TEXT NOT NULL,
    "recantedTestimony" TEXT NOT NULL,
    "recantationDate" TEXT,
    "recantationContext" TEXT NOT NULL,
    "credibilityOfRecantation" TEXT NOT NULL,
    "materialityToConviction" TEXT NOT NULL,
    "corroboration" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "witness_recantations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cumulative_constitutional_errors" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "errorIds" TEXT NOT NULL,
    "totalErrors" INTEGER NOT NULL DEFAULT 0,
    "cumulativePrejudice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "prejudiceLevel" TEXT NOT NULL,
    "individuallyHarmless" INTEGER NOT NULL DEFAULT 0,
    "collectivelyPrejudicial" BOOLEAN NOT NULL DEFAULT false,
    "hillAnalysis" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cumulative_constitutional_errors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "post_conviction_timelines" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "legalSignificance" TEXT NOT NULL,
    "deadlineImplication" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "post_conviction_timelines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dna_forensic_testing_issues" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "evidenceDescription" TEXT NOT NULL,
    "currentStatus" TEXT NOT NULL,
    "pc1405Applicable" BOOLEAN NOT NULL DEFAULT false,
    "testingRecommendation" TEXT NOT NULL,
    "potentialOutcome" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dna_forensic_testing_issues_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "newly_discovered_evidence_caseId_idx" ON "newly_discovered_evidence"("caseId");
CREATE INDEX "newly_discovered_evidence_evidenceType_idx" ON "newly_discovered_evidence"("evidenceType");
CREATE INDEX "newly_discovered_evidence_materialityAssessment_idx" ON "newly_discovered_evidence"("materialityAssessment");

CREATE INDEX "actual_innocence_indicators_caseId_idx" ON "actual_innocence_indicators"("caseId");
CREATE INDEX "actual_innocence_indicators_indicatorType_idx" ON "actual_innocence_indicators"("indicatorType");
CREATE INDEX "actual_innocence_indicators_strength_idx" ON "actual_innocence_indicators"("strength");

CREATE INDEX "ineffective_assistance_issues_caseId_idx" ON "ineffective_assistance_issues"("caseId");
CREATE INDEX "ineffective_assistance_issues_deficiencyType_idx" ON "ineffective_assistance_issues"("deficiencyType");
CREATE INDEX "ineffective_assistance_issues_meritAssessment_idx" ON "ineffective_assistance_issues"("meritAssessment");

CREATE INDEX "brady_giglio_reassessments_caseId_idx" ON "brady_giglio_reassessments"("caseId");
CREATE INDEX "brady_giglio_reassessments_reassessmentType_idx" ON "brady_giglio_reassessments"("reassessmentType");

CREATE INDEX "forensic_reliability_reassessments_caseId_idx" ON "forensic_reliability_reassessments"("caseId");
CREATE INDEX "forensic_reliability_reassessments_forensicType_idx" ON "forensic_reliability_reassessments"("forensicType");
CREATE INDEX "forensic_reliability_reassessments_currentScientificStatus_idx" ON "forensic_reliability_reassessments"("currentScientificStatus");

CREATE INDEX "witness_recantations_caseId_idx" ON "witness_recantations"("caseId");
CREATE INDEX "witness_recantations_credibilityOfRecantation_idx" ON "witness_recantations"("credibilityOfRecantation");
CREATE INDEX "witness_recantations_materialityToConviction_idx" ON "witness_recantations"("materialityToConviction");

CREATE INDEX "cumulative_constitutional_errors_caseId_idx" ON "cumulative_constitutional_errors"("caseId");
CREATE INDEX "cumulative_constitutional_errors_prejudiceLevel_idx" ON "cumulative_constitutional_errors"("prejudiceLevel");

CREATE INDEX "post_conviction_timelines_caseId_idx" ON "post_conviction_timelines"("caseId");
CREATE INDEX "post_conviction_timelines_eventType_idx" ON "post_conviction_timelines"("eventType");

CREATE INDEX "dna_forensic_testing_issues_caseId_idx" ON "dna_forensic_testing_issues"("caseId");
CREATE INDEX "dna_forensic_testing_issues_issueType_idx" ON "dna_forensic_testing_issues"("issueType");
CREATE INDEX "dna_forensic_testing_issues_currentStatus_idx" ON "dna_forensic_testing_issues"("currentStatus");
