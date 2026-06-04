-- Phase I.3: Production Hardening + Operational Certification Framework
-- 10 tables for deployment certification, environment integrity, release reproducibility,
-- rollback assurance, runtime config, readiness scoring, validation suites,
-- deployment manifests, dependency integrity, and release lineage. Additive only.

-- 1. Deployment Certification Workflows
CREATE TABLE "deployment_certification_workflows" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "certificationSteps" TEXT NOT NULL,
    "stepsPassed" INTEGER NOT NULL DEFAULT 0,
    "stepsFailed" INTEGER NOT NULL DEFAULT 0,
    "certificationStatus" TEXT NOT NULL,
    "certifiedBy" TEXT,
    "certifiedAt" TEXT,
    "releaseVersion" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deployment_certification_workflows_pkey" PRIMARY KEY ("id")
);

-- 2. Environment Integrity Verifications
CREATE TABLE "environment_integrity_verifications" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "configHash" TEXT NOT NULL,
    "expectedHash" TEXT NOT NULL,
    "hashMatch" BOOLEAN NOT NULL DEFAULT false,
    "componentsVerified" TEXT NOT NULL,
    "componentsPassed" INTEGER NOT NULL DEFAULT 0,
    "componentsFailed" INTEGER NOT NULL DEFAULT 0,
    "driftDetected" BOOLEAN NOT NULL DEFAULT false,
    "driftDetails" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "environment_integrity_verifications_pkey" PRIMARY KEY ("id")
);

-- 3. Release Reproducibility Validations
CREATE TABLE "release_reproducibility_validations" (
    "id" TEXT NOT NULL,
    "releaseVersion" TEXT NOT NULL,
    "buildHash" TEXT NOT NULL,
    "sourceBranch" TEXT NOT NULL,
    "sourceCommit" TEXT NOT NULL,
    "reproducible" BOOLEAN NOT NULL DEFAULT false,
    "reproductionAttempts" INTEGER NOT NULL DEFAULT 1,
    "reproductionResults" TEXT NOT NULL,
    "artifactInventory" TEXT NOT NULL,
    "validatedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "release_reproducibility_validations_pkey" PRIMARY KEY ("id")
);

-- 4. Rollback Assurance Records
CREATE TABLE "rollback_assurance_records" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "rollbackTarget" TEXT NOT NULL,
    "rollbackType" TEXT NOT NULL,
    "preRollbackSnapshot" TEXT NOT NULL,
    "rollbackSteps" TEXT NOT NULL,
    "rollbackVerified" BOOLEAN NOT NULL DEFAULT false,
    "estimatedDowntime" TEXT NOT NULL,
    "dataPreservation" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rollback_assurance_records_pkey" PRIMARY KEY ("id")
);

-- 5. Runtime Configuration Verifications
CREATE TABLE "runtime_configuration_verifications" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "configKey" TEXT NOT NULL,
    "configValueHash" TEXT NOT NULL,
    "expectedValueHash" TEXT NOT NULL,
    "isMatch" BOOLEAN NOT NULL DEFAULT false,
    "configCategory" TEXT NOT NULL,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "runtime_configuration_verifications_pkey" PRIMARY KEY ("id")
);

-- 6. Production Readiness Scores
CREATE TABLE "production_readiness_scores" (
    "id" TEXT NOT NULL,
    "releaseVersion" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "categoryScores" TEXT NOT NULL,
    "checksPerformed" INTEGER NOT NULL DEFAULT 0,
    "checksPassed" INTEGER NOT NULL DEFAULT 0,
    "checksFailed" INTEGER NOT NULL DEFAULT 0,
    "readinessStatus" TEXT NOT NULL,
    "blockers" TEXT,
    "approvedBy" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_readiness_scores_pkey" PRIMARY KEY ("id")
);

-- 7. Operational Validation Suites
CREATE TABLE "operational_validation_suites" (
    "id" TEXT NOT NULL,
    "suiteName" TEXT NOT NULL,
    "suiteType" TEXT NOT NULL,
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "testsPassed" INTEGER NOT NULL DEFAULT 0,
    "testsFailed" INTEGER NOT NULL DEFAULT 0,
    "testsSkipped" INTEGER NOT NULL DEFAULT 0,
    "executionDuration" INTEGER NOT NULL DEFAULT 0,
    "testResults" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_validation_suites_pkey" PRIMARY KEY ("id")
);

-- 8. Deployment Audit Manifests
CREATE TABLE "deployment_audit_manifests" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "releaseVersion" TEXT NOT NULL,
    "deployedBy" TEXT NOT NULL,
    "deployedAt" TEXT NOT NULL,
    "artifactHashes" TEXT NOT NULL,
    "configSnapshot" TEXT NOT NULL,
    "migrationHistory" TEXT NOT NULL,
    "serviceStatuses" TEXT NOT NULL,
    "rollbackAvailable" BOOLEAN NOT NULL DEFAULT true,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deployment_audit_manifests_pkey" PRIMARY KEY ("id")
);

-- 9. Dependency Integrity Verifications
CREATE TABLE "dependency_integrity_verifications" (
    "id" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "packageVersion" TEXT NOT NULL,
    "expectedHash" TEXT NOT NULL,
    "actualHash" TEXT NOT NULL,
    "hashMatch" BOOLEAN NOT NULL DEFAULT false,
    "dependencyType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "vulnerabilitiesKnown" INTEGER NOT NULL DEFAULT 0,
    "lastVerifiedAt" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dependency_integrity_verifications_pkey" PRIMARY KEY ("id")
);

-- 10. Release Lineage Records
CREATE TABLE "release_lineage_records" (
    "id" TEXT NOT NULL,
    "releaseVersion" TEXT NOT NULL,
    "previousVersion" TEXT,
    "changeType" TEXT NOT NULL,
    "commitRange" TEXT NOT NULL,
    "totalCommits" INTEGER NOT NULL DEFAULT 0,
    "totalFilesChanged" INTEGER NOT NULL DEFAULT 0,
    "migrationsIncluded" TEXT NOT NULL,
    "releaseNotes" TEXT NOT NULL,
    "releaseHash" TEXT NOT NULL,
    "approvedBy" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "release_lineage_records_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "deployment_certification_workflows_deploymentId_idx" ON "deployment_certification_workflows"("deploymentId");
CREATE INDEX "deployment_certification_workflows_environment_idx" ON "deployment_certification_workflows"("environment");
CREATE INDEX "deployment_certification_workflows_certificationStatus_idx" ON "deployment_certification_workflows"("certificationStatus");

CREATE INDEX "environment_integrity_verifications_environment_idx" ON "environment_integrity_verifications"("environment");
CREATE INDEX "environment_integrity_verifications_hashMatch_idx" ON "environment_integrity_verifications"("hashMatch");
CREATE INDEX "environment_integrity_verifications_driftDetected_idx" ON "environment_integrity_verifications"("driftDetected");

CREATE INDEX "release_reproducibility_validations_releaseVersion_idx" ON "release_reproducibility_validations"("releaseVersion");
CREATE INDEX "release_reproducibility_validations_reproducible_idx" ON "release_reproducibility_validations"("reproducible");
CREATE INDEX "release_reproducibility_validations_sourceBranch_idx" ON "release_reproducibility_validations"("sourceBranch");

CREATE INDEX "rollback_assurance_records_deploymentId_idx" ON "rollback_assurance_records"("deploymentId");
CREATE INDEX "rollback_assurance_records_rollbackType_idx" ON "rollback_assurance_records"("rollbackType");
CREATE INDEX "rollback_assurance_records_rollbackVerified_idx" ON "rollback_assurance_records"("rollbackVerified");

CREATE INDEX "runtime_configuration_verifications_environment_idx" ON "runtime_configuration_verifications"("environment");
CREATE INDEX "runtime_configuration_verifications_configCategory_idx" ON "runtime_configuration_verifications"("configCategory");
CREATE INDEX "runtime_configuration_verifications_isMatch_idx" ON "runtime_configuration_verifications"("isMatch");

CREATE INDEX "production_readiness_scores_releaseVersion_idx" ON "production_readiness_scores"("releaseVersion");
CREATE INDEX "production_readiness_scores_readinessStatus_idx" ON "production_readiness_scores"("readinessStatus");
CREATE INDEX "production_readiness_scores_overallScore_idx" ON "production_readiness_scores"("overallScore");

CREATE INDEX "operational_validation_suites_suiteType_idx" ON "operational_validation_suites"("suiteType");
CREATE INDEX "operational_validation_suites_environment_idx" ON "operational_validation_suites"("environment");

CREATE INDEX "deployment_audit_manifests_deploymentId_idx" ON "deployment_audit_manifests"("deploymentId");
CREATE INDEX "deployment_audit_manifests_releaseVersion_idx" ON "deployment_audit_manifests"("releaseVersion");
CREATE INDEX "deployment_audit_manifests_deployedAt_idx" ON "deployment_audit_manifests"("deployedAt");

CREATE INDEX "dependency_integrity_verifications_packageName_idx" ON "dependency_integrity_verifications"("packageName");
CREATE INDEX "dependency_integrity_verifications_hashMatch_idx" ON "dependency_integrity_verifications"("hashMatch");
CREATE INDEX "dependency_integrity_verifications_dependencyType_idx" ON "dependency_integrity_verifications"("dependencyType");

CREATE INDEX "release_lineage_records_releaseVersion_idx" ON "release_lineage_records"("releaseVersion");
CREATE INDEX "release_lineage_records_changeType_idx" ON "release_lineage_records"("changeType");
CREATE INDEX "release_lineage_records_previousVersion_idx" ON "release_lineage_records"("previousVersion");
