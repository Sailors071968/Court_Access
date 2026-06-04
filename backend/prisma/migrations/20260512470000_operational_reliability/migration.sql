-- Phase N.2: Golden-Case Validation + Operational Reliability Framework
-- 10 tables for golden-case corpus, deterministic replay, cross-layer regression,
-- load/stability testing, survivability testing, UI/UX refinement,
-- release gate checks, certification manifests, expected outputs, reliability scores.

-- 1. Golden-Case Corpus Entries
CREATE TABLE "golden_case_corpus_entries" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "caseName" TEXT NOT NULL,
    "expectedContradictions" INTEGER NOT NULL DEFAULT 0,
    "expectedBurdenFractures" INTEGER NOT NULL DEFAULT 0,
    "expectedCalcrimMappings" INTEGER NOT NULL DEFAULT 0,
    "expectedOutputHash" TEXT NOT NULL,
    "expectedExportHash" TEXT NOT NULL,
    "corpusDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "golden_case_corpus_entries_pkey" PRIMARY KEY ("id")
);

-- 2. Deterministic Replay Runs
CREATE TABLE "deterministic_replay_runs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "corpusEntryId" TEXT NOT NULL,
    "replayIteration" INTEGER NOT NULL DEFAULT 1,
    "outputHash" TEXT NOT NULL,
    "exportHash" TEXT NOT NULL,
    "orchestrationHash" TEXT NOT NULL,
    "telemetryHash" TEXT NOT NULL,
    "allHashesMatch" BOOLEAN NOT NULL DEFAULT false,
    "driftDetected" BOOLEAN NOT NULL DEFAULT false,
    "replayDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deterministic_replay_runs_pkey" PRIMARY KEY ("id")
);

-- 3. Cross-Layer Regression Runs
CREATE TABLE "cross_layer_regression_runs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "regressionLayer" TEXT NOT NULL,
    "baselineHash" TEXT NOT NULL,
    "currentHash" TEXT NOT NULL,
    "hashesMatch" BOOLEAN NOT NULL DEFAULT false,
    "regressionDetected" BOOLEAN NOT NULL DEFAULT false,
    "layerDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cross_layer_regression_runs_pkey" PRIMARY KEY ("id")
);

-- 4. Load/Stability Test Runs
CREATE TABLE "load_stability_test_runs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "testArea" TEXT NOT NULL,
    "concurrentOps" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "p95LatencyMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "testStatus" TEXT NOT NULL,
    "testHash" TEXT NOT NULL,
    "testDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "load_stability_test_runs_pkey" PRIMARY KEY ("id")
);

-- 5. Survivability Test Runs
CREATE TABLE "survivability_test_runs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "failureScenario" TEXT NOT NULL,
    "injectionType" TEXT NOT NULL,
    "systemRecovered" BOOLEAN NOT NULL DEFAULT true,
    "dataIntact" BOOLEAN NOT NULL DEFAULT true,
    "recoveryTimeMs" INTEGER NOT NULL DEFAULT 0,
    "survivabilityHash" TEXT NOT NULL,
    "testDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "survivability_test_runs_pkey" PRIMARY KEY ("id")
);

-- 6. UI/UX Refinement Entries
CREATE TABLE "ui_ux_refinement_entries" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "focusArea" TEXT NOT NULL,
    "currentScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "improvementApplied" BOOLEAN NOT NULL DEFAULT false,
    "refinementDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ui_ux_refinement_entries_pkey" PRIMARY KEY ("id")
);

-- 7. Release Gate Checks
CREATE TABLE "release_gate_checks" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "gateName" TEXT NOT NULL,
    "gateStatus" TEXT NOT NULL,
    "gateHash" TEXT NOT NULL,
    "blockerDetails" TEXT,
    "gateDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "release_gate_checks_pkey" PRIMARY KEY ("id")
);

-- 8. Certification Manifest Entries
CREATE TABLE "certification_manifest_entries" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "manifestArea" TEXT NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "manifestDetails" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "certification_manifest_entries_pkey" PRIMARY KEY ("id")
);

-- 9. Corpus Expected Outputs
CREATE TABLE "corpus_expected_outputs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "corpusEntryId" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "expectedValue" TEXT NOT NULL,
    "expectedHash" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "corpus_expected_outputs_pkey" PRIMARY KEY ("id")
);

-- 10. Operational Reliability Scores
CREATE TABLE "operational_reliability_scores" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "scoreDomain" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "scoreStatus" TEXT NOT NULL,
    "scoreHash" TEXT NOT NULL,
    "scoreDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_reliability_scores_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "golden_case_corpus_entries_caseId_idx" ON "golden_case_corpus_entries"("caseId");
CREATE INDEX "golden_case_corpus_entries_caseType_idx" ON "golden_case_corpus_entries"("caseType");

CREATE INDEX "deterministic_replay_runs_caseId_idx" ON "deterministic_replay_runs"("caseId");
CREATE INDEX "deterministic_replay_runs_corpusEntryId_idx" ON "deterministic_replay_runs"("corpusEntryId");
CREATE INDEX "deterministic_replay_runs_driftDetected_idx" ON "deterministic_replay_runs"("driftDetected");

CREATE INDEX "cross_layer_regression_runs_caseId_idx" ON "cross_layer_regression_runs"("caseId");
CREATE INDEX "cross_layer_regression_runs_regressionLayer_idx" ON "cross_layer_regression_runs"("regressionLayer");
CREATE INDEX "cross_layer_regression_runs_regressionDetected_idx" ON "cross_layer_regression_runs"("regressionDetected");

CREATE INDEX "load_stability_test_runs_caseId_idx" ON "load_stability_test_runs"("caseId");
CREATE INDEX "load_stability_test_runs_testArea_idx" ON "load_stability_test_runs"("testArea");
CREATE INDEX "load_stability_test_runs_testStatus_idx" ON "load_stability_test_runs"("testStatus");

CREATE INDEX "survivability_test_runs_caseId_idx" ON "survivability_test_runs"("caseId");
CREATE INDEX "survivability_test_runs_failureScenario_idx" ON "survivability_test_runs"("failureScenario");
CREATE INDEX "survivability_test_runs_systemRecovered_idx" ON "survivability_test_runs"("systemRecovered");

CREATE INDEX "ui_ux_refinement_entries_caseId_idx" ON "ui_ux_refinement_entries"("caseId");
CREATE INDEX "ui_ux_refinement_entries_focusArea_idx" ON "ui_ux_refinement_entries"("focusArea");
CREATE INDEX "ui_ux_refinement_entries_improvementApplied_idx" ON "ui_ux_refinement_entries"("improvementApplied");

CREATE INDEX "release_gate_checks_caseId_idx" ON "release_gate_checks"("caseId");
CREATE INDEX "release_gate_checks_gateName_idx" ON "release_gate_checks"("gateName");
CREATE INDEX "release_gate_checks_gateStatus_idx" ON "release_gate_checks"("gateStatus");

CREATE INDEX "certification_manifest_entries_caseId_idx" ON "certification_manifest_entries"("caseId");
CREATE INDEX "certification_manifest_entries_manifestArea_idx" ON "certification_manifest_entries"("manifestArea");
CREATE INDEX "certification_manifest_entries_verified_idx" ON "certification_manifest_entries"("verified");

CREATE INDEX "corpus_expected_outputs_caseId_idx" ON "corpus_expected_outputs"("caseId");
CREATE INDEX "corpus_expected_outputs_corpusEntryId_idx" ON "corpus_expected_outputs"("corpusEntryId");
CREATE INDEX "corpus_expected_outputs_outputType_idx" ON "corpus_expected_outputs"("outputType");

CREATE INDEX "operational_reliability_scores_caseId_idx" ON "operational_reliability_scores"("caseId");
CREATE INDEX "operational_reliability_scores_scoreDomain_idx" ON "operational_reliability_scores"("scoreDomain");
CREATE INDEX "operational_reliability_scores_scoreStatus_idx" ON "operational_reliability_scores"("scoreStatus");
