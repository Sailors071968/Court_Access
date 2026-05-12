-- Phase K.2: Independent Expert Review + Litigation Defensibility Framework
-- 10 tables for expert review workflows, adversarial simulations, defensibility scoring,
-- reproducibility review, audit trace reconstruction, evidentiary challenges,
-- cross-expert verification, validation manifests, exception handling, review certification.

-- 1. Independent Expert Review Workflows
CREATE TABLE "independent_expert_review_workflows" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "expertSpecialty" TEXT NOT NULL,
    "reviewScope" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL,
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "criticalFindings" INTEGER NOT NULL DEFAULT 0,
    "reviewResult" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "independent_expert_review_workflows_pkey" PRIMARY KEY ("id")
);

-- 2. Adversarial Challenge Simulations
CREATE TABLE "adversarial_challenge_simulations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "challengeType" TEXT NOT NULL,
    "challengeTarget" TEXT NOT NULL,
    "targetRecordId" TEXT NOT NULL,
    "simulationResult" TEXT NOT NULL,
    "vulnerabilitiesFound" INTEGER NOT NULL DEFAULT 0,
    "strengthScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "challengeDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "adversarial_challenge_simulations_pkey" PRIMARY KEY ("id")
);

-- 3. Litigation Defensibility Scores
CREATE TABLE "litigation_defensibility_scores" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "scoringScope" TEXT NOT NULL,
    "rulesEvaluated" INTEGER NOT NULL DEFAULT 0,
    "rulesPassed" INTEGER NOT NULL DEFAULT 0,
    "rulesFailed" INTEGER NOT NULL DEFAULT 0,
    "defensibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defensibilityStatus" TEXT NOT NULL,
    "weaknesses" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "litigation_defensibility_scores_pkey" PRIMARY KEY ("id")
);

-- 4. External Reproducibility Reviews
CREATE TABLE "external_reproducibility_reviews" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "originalHash" TEXT NOT NULL,
    "reproducedHash" TEXT NOT NULL,
    "hashesMatch" BOOLEAN NOT NULL DEFAULT false,
    "methodologyVerified" BOOLEAN NOT NULL DEFAULT false,
    "dataIntegrityVerified" BOOLEAN NOT NULL DEFAULT false,
    "reviewNotes" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_reproducibility_reviews_pkey" PRIMARY KEY ("id")
);

-- 5. Expert Audit Trace Reconstructions
CREATE TABLE "expert_audit_trace_reconstructions" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "traceScope" TEXT NOT NULL,
    "stepsReconstructed" INTEGER NOT NULL DEFAULT 0,
    "stepsVerified" INTEGER NOT NULL DEFAULT 0,
    "gapsFound" INTEGER NOT NULL DEFAULT 0,
    "reconstructionHash" TEXT NOT NULL,
    "reconstructionStatus" TEXT NOT NULL,
    "traceDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expert_audit_trace_reconstructions_pkey" PRIMARY KEY ("id")
);

-- 6. Evidentiary Challenges
CREATE TABLE "evidentiary_challenges" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "challengeSource" TEXT NOT NULL,
    "challengedRecordId" TEXT NOT NULL,
    "challengeBasis" TEXT NOT NULL,
    "challengeOutcome" TEXT NOT NULL,
    "supportingCitations" TEXT NOT NULL,
    "responseCitations" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidentiary_challenges_pkey" PRIMARY KEY ("id")
);

-- 7. Cross-Expert Verifications
CREATE TABLE "cross_expert_verifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "primaryExpertId" TEXT NOT NULL,
    "secondaryExpertId" TEXT NOT NULL,
    "verificationScope" TEXT NOT NULL,
    "agreementLevel" TEXT NOT NULL,
    "discrepancies" TEXT,
    "verificationHash" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cross_expert_verifications_pkey" PRIMARY KEY ("id")
);

-- 8. Independent Validation Manifests
CREATE TABLE "independent_validation_manifests" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "manifestScope" TEXT NOT NULL,
    "entriesCount" INTEGER NOT NULL DEFAULT 0,
    "entriesVerified" INTEGER NOT NULL DEFAULT 0,
    "manifestHash" TEXT NOT NULL,
    "manifestComplete" BOOLEAN NOT NULL DEFAULT false,
    "validatorId" TEXT NOT NULL,
    "manifestEntries" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "independent_validation_manifests_pkey" PRIMARY KEY ("id")
);

-- 9. Defensibility Exception Records
CREATE TABLE "defensibility_exception_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "exceptionType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "affectedRecordId" TEXT NOT NULL,
    "mitigationApplied" BOOLEAN NOT NULL DEFAULT false,
    "mitigationDescription" TEXT,
    "exceptionStatus" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "defensibility_exception_records_pkey" PRIMARY KEY ("id")
);

-- 10. External Review Certifications
CREATE TABLE "external_review_certifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "certificationScope" TEXT NOT NULL,
    "reviewsCompleted" INTEGER NOT NULL DEFAULT 0,
    "reviewsPassed" INTEGER NOT NULL DEFAULT 0,
    "certificationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "certificationStatus" TEXT NOT NULL,
    "certifiedBy" TEXT,
    "certifiedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_review_certifications_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "independent_expert_review_workflows_caseId_idx" ON "independent_expert_review_workflows"("caseId");
CREATE INDEX "independent_expert_review_workflows_expertId_idx" ON "independent_expert_review_workflows"("expertId");
CREATE INDEX "independent_expert_review_workflows_reviewStatus_idx" ON "independent_expert_review_workflows"("reviewStatus");

CREATE INDEX "adversarial_challenge_simulations_caseId_idx" ON "adversarial_challenge_simulations"("caseId");
CREATE INDEX "adversarial_challenge_simulations_challengeType_idx" ON "adversarial_challenge_simulations"("challengeType");
CREATE INDEX "adversarial_challenge_simulations_simulationResult_idx" ON "adversarial_challenge_simulations"("simulationResult");

CREATE INDEX "litigation_defensibility_scores_caseId_idx" ON "litigation_defensibility_scores"("caseId");
CREATE INDEX "litigation_defensibility_scores_scoringScope_idx" ON "litigation_defensibility_scores"("scoringScope");
CREATE INDEX "litigation_defensibility_scores_defensibilityStatus_idx" ON "litigation_defensibility_scores"("defensibilityStatus");

CREATE INDEX "external_reproducibility_reviews_caseId_idx" ON "external_reproducibility_reviews"("caseId");
CREATE INDEX "external_reproducibility_reviews_reviewerId_idx" ON "external_reproducibility_reviews"("reviewerId");
CREATE INDEX "external_reproducibility_reviews_hashesMatch_idx" ON "external_reproducibility_reviews"("hashesMatch");

CREATE INDEX "expert_audit_trace_reconstructions_caseId_idx" ON "expert_audit_trace_reconstructions"("caseId");
CREATE INDEX "expert_audit_trace_reconstructions_traceScope_idx" ON "expert_audit_trace_reconstructions"("traceScope");
CREATE INDEX "expert_audit_trace_reconstructions_reconstructionStatus_idx" ON "expert_audit_trace_reconstructions"("reconstructionStatus");

CREATE INDEX "evidentiary_challenges_caseId_idx" ON "evidentiary_challenges"("caseId");
CREATE INDEX "evidentiary_challenges_challengeSource_idx" ON "evidentiary_challenges"("challengeSource");
CREATE INDEX "evidentiary_challenges_challengeOutcome_idx" ON "evidentiary_challenges"("challengeOutcome");

CREATE INDEX "cross_expert_verifications_caseId_idx" ON "cross_expert_verifications"("caseId");
CREATE INDEX "cross_expert_verifications_primaryExpertId_idx" ON "cross_expert_verifications"("primaryExpertId");
CREATE INDEX "cross_expert_verifications_agreementLevel_idx" ON "cross_expert_verifications"("agreementLevel");

CREATE INDEX "independent_validation_manifests_caseId_idx" ON "independent_validation_manifests"("caseId");
CREATE INDEX "independent_validation_manifests_manifestScope_idx" ON "independent_validation_manifests"("manifestScope");
CREATE INDEX "independent_validation_manifests_manifestComplete_idx" ON "independent_validation_manifests"("manifestComplete");

CREATE INDEX "defensibility_exception_records_caseId_idx" ON "defensibility_exception_records"("caseId");
CREATE INDEX "defensibility_exception_records_exceptionType_idx" ON "defensibility_exception_records"("exceptionType");
CREATE INDEX "defensibility_exception_records_exceptionStatus_idx" ON "defensibility_exception_records"("exceptionStatus");

CREATE INDEX "external_review_certifications_caseId_idx" ON "external_review_certifications"("caseId");
CREATE INDEX "external_review_certifications_certificationScope_idx" ON "external_review_certifications"("certificationScope");
CREATE INDEX "external_review_certifications_certificationStatus_idx" ON "external_review_certifications"("certificationStatus");
