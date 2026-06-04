-- Phase N.4: Controlled Production Readiness + Operational Maturation
-- 10 tables for attorney reviews, UI/UX optimization, infrastructure tuning,
-- deployment maturity, telemetry refinement, readiness scoring,
-- onboarding rehearsals, stability runs, candidate certification, maturity manifests.

-- 1. Attorney Pilot Reviews
CREATE TABLE "attorney_pilot_reviews" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewerRole" TEXT NOT NULL,
    "workflowReviewed" TEXT NOT NULL,
    "usabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accuracyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "speedScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feedbackNotes" TEXT NOT NULL,
    "reviewHash" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attorney_pilot_reviews_pkey" PRIMARY KEY ("id")
);

-- 2. UI/UX Optimization Cycles
CREATE TABLE "ui_ux_optimization_cycles" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "optimizationArea" TEXT NOT NULL,
    "cycleName" TEXT NOT NULL,
    "beforeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "afterScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "improvementPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cycleStatus" TEXT NOT NULL,
    "cycleDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ui_ux_optimization_cycles_pkey" PRIMARY KEY ("id")
);

-- 3. Infrastructure Tuning Entries
CREATE TABLE "infrastructure_tuning_entries" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tuningDomain" TEXT NOT NULL,
    "metricBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metricAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "improvementPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tuningStatus" TEXT NOT NULL,
    "tuningHash" TEXT NOT NULL,
    "tuningDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "infrastructure_tuning_entries_pkey" PRIMARY KEY ("id")
);

-- 4. Deployment Maturity Checks
CREATE TABLE "deployment_maturity_checks" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "maturityDomain" TEXT NOT NULL,
    "maturityLevel" TEXT NOT NULL,
    "checksTotal" INTEGER NOT NULL DEFAULT 0,
    "checksPassed" INTEGER NOT NULL DEFAULT 0,
    "maturityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maturityHash" TEXT NOT NULL,
    "maturityDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deployment_maturity_checks_pkey" PRIMARY KEY ("id")
);

-- 5. Telemetry Refinement Entries
CREATE TABLE "telemetry_refinement_entries" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "telemetryArea" TEXT NOT NULL,
    "signalToNoiseRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coveragePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refinementStatus" TEXT NOT NULL,
    "refinementHash" TEXT NOT NULL,
    "refinementDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telemetry_refinement_entries_pkey" PRIMARY KEY ("id")
);

-- 6. Maturation Readiness Scores
CREATE TABLE "maturation_readiness_scores" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "scoreDomain" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "meetsThreshold" BOOLEAN NOT NULL DEFAULT false,
    "scoreStatus" TEXT NOT NULL,
    "scoreHash" TEXT NOT NULL,
    "scoreDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maturation_readiness_scores_pkey" PRIMARY KEY ("id")
);

-- 7. Institutional Onboarding Rehearsals
CREATE TABLE "institutional_onboarding_rehearsals" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "onboardingPhase" TEXT NOT NULL,
    "stepsTotal" INTEGER NOT NULL DEFAULT 0,
    "stepsCompleted" INTEGER NOT NULL DEFAULT 0,
    "rehearsalStatus" TEXT NOT NULL,
    "governanceApproved" BOOLEAN NOT NULL DEFAULT false,
    "rehearsalHash" TEXT NOT NULL,
    "rehearsalDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "institutional_onboarding_rehearsals_pkey" PRIMARY KEY ("id")
);

-- 8. Long-Duration Stability Runs
CREATE TABLE "long_duration_stability_runs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "testDurationHours" INTEGER NOT NULL DEFAULT 0,
    "requestsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorsEncountered" INTEGER NOT NULL DEFAULT 0,
    "uptimePercentage" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "memoryLeakDetected" BOOLEAN NOT NULL DEFAULT false,
    "performanceDegraded" BOOLEAN NOT NULL DEFAULT false,
    "stabilityStatus" TEXT NOT NULL,
    "stabilityHash" TEXT NOT NULL,
    "stabilityDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "long_duration_stability_runs_pkey" PRIMARY KEY ("id")
);

-- 9. Production Candidate Certifications
CREATE TABLE "production_candidate_certifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "candidateVersion" TEXT NOT NULL,
    "certificationScope" TEXT NOT NULL,
    "rulesTotal" INTEGER NOT NULL DEFAULT 0,
    "rulesPassed" INTEGER NOT NULL DEFAULT 0,
    "certificationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "certificationStatus" TEXT NOT NULL,
    "certifiedBy" TEXT,
    "certifiedAt" TEXT,
    "certificationHash" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_candidate_certifications_pkey" PRIMARY KEY ("id")
);

-- 10. Operational Maturity Manifests
CREATE TABLE "operational_maturity_manifests" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "manifestArea" TEXT NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "maturityLevel" TEXT NOT NULL,
    "manifestDetails" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_maturity_manifests_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "attorney_pilot_reviews_caseId_idx" ON "attorney_pilot_reviews"("caseId");
CREATE INDEX "attorney_pilot_reviews_reviewerId_idx" ON "attorney_pilot_reviews"("reviewerId");
CREATE INDEX "attorney_pilot_reviews_workflowReviewed_idx" ON "attorney_pilot_reviews"("workflowReviewed");

CREATE INDEX "ui_ux_optimization_cycles_caseId_idx" ON "ui_ux_optimization_cycles"("caseId");
CREATE INDEX "ui_ux_optimization_cycles_optimizationArea_idx" ON "ui_ux_optimization_cycles"("optimizationArea");
CREATE INDEX "ui_ux_optimization_cycles_cycleStatus_idx" ON "ui_ux_optimization_cycles"("cycleStatus");

CREATE INDEX "infrastructure_tuning_entries_caseId_idx" ON "infrastructure_tuning_entries"("caseId");
CREATE INDEX "infrastructure_tuning_entries_tuningDomain_idx" ON "infrastructure_tuning_entries"("tuningDomain");
CREATE INDEX "infrastructure_tuning_entries_tuningStatus_idx" ON "infrastructure_tuning_entries"("tuningStatus");

CREATE INDEX "deployment_maturity_checks_caseId_idx" ON "deployment_maturity_checks"("caseId");
CREATE INDEX "deployment_maturity_checks_maturityDomain_idx" ON "deployment_maturity_checks"("maturityDomain");
CREATE INDEX "deployment_maturity_checks_maturityLevel_idx" ON "deployment_maturity_checks"("maturityLevel");

CREATE INDEX "telemetry_refinement_entries_caseId_idx" ON "telemetry_refinement_entries"("caseId");
CREATE INDEX "telemetry_refinement_entries_telemetryArea_idx" ON "telemetry_refinement_entries"("telemetryArea");
CREATE INDEX "telemetry_refinement_entries_refinementStatus_idx" ON "telemetry_refinement_entries"("refinementStatus");

CREATE INDEX "maturation_readiness_scores_caseId_idx" ON "maturation_readiness_scores"("caseId");
CREATE INDEX "maturation_readiness_scores_scoreDomain_idx" ON "maturation_readiness_scores"("scoreDomain");
CREATE INDEX "maturation_readiness_scores_scoreStatus_idx" ON "maturation_readiness_scores"("scoreStatus");

CREATE INDEX "institutional_onboarding_rehearsals_caseId_idx" ON "institutional_onboarding_rehearsals"("caseId");
CREATE INDEX "institutional_onboarding_rehearsals_onboardingPhase_idx" ON "institutional_onboarding_rehearsals"("onboardingPhase");
CREATE INDEX "institutional_onboarding_rehearsals_rehearsalStatus_idx" ON "institutional_onboarding_rehearsals"("rehearsalStatus");

CREATE INDEX "long_duration_stability_runs_caseId_idx" ON "long_duration_stability_runs"("caseId");
CREATE INDEX "long_duration_stability_runs_stabilityStatus_idx" ON "long_duration_stability_runs"("stabilityStatus");

CREATE INDEX "production_candidate_certifications_caseId_idx" ON "production_candidate_certifications"("caseId");
CREATE INDEX "production_candidate_certifications_candidateVersion_idx" ON "production_candidate_certifications"("candidateVersion");
CREATE INDEX "production_candidate_certifications_certificationStatus_idx" ON "production_candidate_certifications"("certificationStatus");

CREATE INDEX "operational_maturity_manifests_caseId_idx" ON "operational_maturity_manifests"("caseId");
CREATE INDEX "operational_maturity_manifests_manifestArea_idx" ON "operational_maturity_manifests"("manifestArea");
CREATE INDEX "operational_maturity_manifests_verified_idx" ON "operational_maturity_manifests"("verified");
