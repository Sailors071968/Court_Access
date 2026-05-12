-- Phase N.1: Platform Stabilization, Validation & Controlled Production Readiness
-- 10 tables for integration testing, regression validation, performance benchmarking,
-- stability verification, deployment rehearsal, workflow simulation,
-- security hardening, production certification, golden-case corpus, red-team validation.

-- 1. Integration Test Records
CREATE TABLE "integration_test_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "testSuite" TEXT NOT NULL,
    "testsTotal" INTEGER NOT NULL DEFAULT 0,
    "testsPassed" INTEGER NOT NULL DEFAULT 0,
    "testsFailed" INTEGER NOT NULL DEFAULT 0,
    "testStatus" TEXT NOT NULL,
    "testHash" TEXT NOT NULL,
    "testDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_test_records_pkey" PRIMARY KEY ("id")
);

-- 2. Regression Validation Records
CREATE TABLE "regression_validation_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "validationLayer" TEXT NOT NULL,
    "baselineHash" TEXT NOT NULL,
    "currentHash" TEXT NOT NULL,
    "hashesMatch" BOOLEAN NOT NULL DEFAULT false,
    "regressionDetected" BOOLEAN NOT NULL DEFAULT false,
    "validationDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "regression_validation_records_pkey" PRIMARY KEY ("id")
);

-- 3. Performance Benchmark Records
CREATE TABLE "performance_benchmark_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "benchmarkName" TEXT NOT NULL,
    "operationsCount" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "p95LatencyMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "throughputPerSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "benchmarkStatus" TEXT NOT NULL,
    "benchmarkDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "performance_benchmark_records_pkey" PRIMARY KEY ("id")
);

-- 4. Stability Verification Records
CREATE TABLE "stability_verification_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "stabilityDomain" TEXT NOT NULL,
    "uptimePercentage" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recoveryTimeMs" INTEGER NOT NULL DEFAULT 0,
    "stabilityStatus" TEXT NOT NULL,
    "stabilityHash" TEXT NOT NULL,
    "stabilityDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stability_verification_records_pkey" PRIMARY KEY ("id")
);

-- 5. Deployment Rehearsal Records
CREATE TABLE "deployment_rehearsal_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "rehearsalType" TEXT NOT NULL,
    "stepsTotal" INTEGER NOT NULL DEFAULT 0,
    "stepsCompleted" INTEGER NOT NULL DEFAULT 0,
    "rehearsalStatus" TEXT NOT NULL,
    "rehearsalHash" TEXT NOT NULL,
    "rehearsalLog" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deployment_rehearsal_records_pkey" PRIMARY KEY ("id")
);

-- 6. Workflow Simulation Records
CREATE TABLE "workflow_simulation_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "simulationSteps" INTEGER NOT NULL DEFAULT 0,
    "stepsSucceeded" INTEGER NOT NULL DEFAULT 0,
    "stepsFailed" INTEGER NOT NULL DEFAULT 0,
    "simulationStatus" TEXT NOT NULL,
    "simulationHash" TEXT NOT NULL,
    "simulationDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_simulation_records_pkey" PRIMARY KEY ("id")
);

-- 7. Security Hardening Validations
CREATE TABLE "security_hardening_validations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "securityDomain" TEXT NOT NULL,
    "checksTotal" INTEGER NOT NULL DEFAULT 0,
    "checksPassed" INTEGER NOT NULL DEFAULT 0,
    "checksFailed" INTEGER NOT NULL DEFAULT 0,
    "securityStatus" TEXT NOT NULL,
    "securityHash" TEXT NOT NULL,
    "securityDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_hardening_validations_pkey" PRIMARY KEY ("id")
);

-- 8. Production Certification Records
CREATE TABLE "production_certification_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "certificationScope" TEXT NOT NULL,
    "rulesTotal" INTEGER NOT NULL DEFAULT 0,
    "rulesPassed" INTEGER NOT NULL DEFAULT 0,
    "certificationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "certificationStatus" TEXT NOT NULL,
    "certifiedBy" TEXT,
    "certifiedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_certification_records_pkey" PRIMARY KEY ("id")
);

-- 9. Golden-Case Validation Corpus
CREATE TABLE "golden_case_validation_corpus" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "corpusName" TEXT NOT NULL,
    "datasetSize" INTEGER NOT NULL DEFAULT 0,
    "expectedOutputHash" TEXT NOT NULL,
    "actualOutputHash" TEXT NOT NULL,
    "hashesMatch" BOOLEAN NOT NULL DEFAULT false,
    "driftDetected" BOOLEAN NOT NULL DEFAULT false,
    "corpusDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "golden_case_validation_corpus_pkey" PRIMARY KEY ("id")
);

-- 10. Red-Team Validation Records
CREATE TABLE "red_team_validation_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "redTeamArea" TEXT NOT NULL,
    "attackVector" TEXT NOT NULL,
    "systemSurvived" BOOLEAN NOT NULL DEFAULT true,
    "integrityPreserved" BOOLEAN NOT NULL DEFAULT true,
    "validationHash" TEXT NOT NULL,
    "validationDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "red_team_validation_records_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "integration_test_records_caseId_idx" ON "integration_test_records"("caseId");
CREATE INDEX "integration_test_records_testSuite_idx" ON "integration_test_records"("testSuite");
CREATE INDEX "integration_test_records_testStatus_idx" ON "integration_test_records"("testStatus");

CREATE INDEX "regression_validation_records_caseId_idx" ON "regression_validation_records"("caseId");
CREATE INDEX "regression_validation_records_validationLayer_idx" ON "regression_validation_records"("validationLayer");
CREATE INDEX "regression_validation_records_regressionDetected_idx" ON "regression_validation_records"("regressionDetected");

CREATE INDEX "performance_benchmark_records_caseId_idx" ON "performance_benchmark_records"("caseId");
CREATE INDEX "performance_benchmark_records_benchmarkName_idx" ON "performance_benchmark_records"("benchmarkName");
CREATE INDEX "performance_benchmark_records_benchmarkStatus_idx" ON "performance_benchmark_records"("benchmarkStatus");

CREATE INDEX "stability_verification_records_caseId_idx" ON "stability_verification_records"("caseId");
CREATE INDEX "stability_verification_records_stabilityDomain_idx" ON "stability_verification_records"("stabilityDomain");
CREATE INDEX "stability_verification_records_stabilityStatus_idx" ON "stability_verification_records"("stabilityStatus");

CREATE INDEX "deployment_rehearsal_records_caseId_idx" ON "deployment_rehearsal_records"("caseId");
CREATE INDEX "deployment_rehearsal_records_rehearsalType_idx" ON "deployment_rehearsal_records"("rehearsalType");
CREATE INDEX "deployment_rehearsal_records_rehearsalStatus_idx" ON "deployment_rehearsal_records"("rehearsalStatus");

CREATE INDEX "workflow_simulation_records_caseId_idx" ON "workflow_simulation_records"("caseId");
CREATE INDEX "workflow_simulation_records_workflowName_idx" ON "workflow_simulation_records"("workflowName");
CREATE INDEX "workflow_simulation_records_simulationStatus_idx" ON "workflow_simulation_records"("simulationStatus");

CREATE INDEX "security_hardening_validations_caseId_idx" ON "security_hardening_validations"("caseId");
CREATE INDEX "security_hardening_validations_securityDomain_idx" ON "security_hardening_validations"("securityDomain");
CREATE INDEX "security_hardening_validations_securityStatus_idx" ON "security_hardening_validations"("securityStatus");

CREATE INDEX "production_certification_records_caseId_idx" ON "production_certification_records"("caseId");
CREATE INDEX "production_certification_records_certificationScope_idx" ON "production_certification_records"("certificationScope");
CREATE INDEX "production_certification_records_certificationStatus_idx" ON "production_certification_records"("certificationStatus");

CREATE INDEX "golden_case_validation_corpus_caseId_idx" ON "golden_case_validation_corpus"("caseId");
CREATE INDEX "golden_case_validation_corpus_corpusName_idx" ON "golden_case_validation_corpus"("corpusName");
CREATE INDEX "golden_case_validation_corpus_driftDetected_idx" ON "golden_case_validation_corpus"("driftDetected");

CREATE INDEX "red_team_validation_records_caseId_idx" ON "red_team_validation_records"("caseId");
CREATE INDEX "red_team_validation_records_redTeamArea_idx" ON "red_team_validation_records"("redTeamArea");
CREATE INDEX "red_team_validation_records_systemSurvived_idx" ON "red_team_validation_records"("systemSurvived");
