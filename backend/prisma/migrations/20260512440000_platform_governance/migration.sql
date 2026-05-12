-- Phase M.1: Unified Platform Doctrine + Controlled Release Governance Framework
-- 10 tables for operational doctrine, release governance, feature enablement,
-- policy harmonization, administrative certification, platform stewardship,
-- governance synchronization, release integrity, cross-layer policy, doctrine lineage.

-- 1. Unified Operational Doctrines
CREATE TABLE "unified_operational_doctrines" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "doctrineName" TEXT NOT NULL,
    "doctrineVersion" TEXT NOT NULL,
    "doctrineStatus" TEXT NOT NULL,
    "rulesCount" INTEGER NOT NULL DEFAULT 0,
    "rulesEnforced" INTEGER NOT NULL DEFAULT 0,
    "doctrineHash" TEXT NOT NULL,
    "doctrineRules" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "unified_operational_doctrines_pkey" PRIMARY KEY ("id")
);

-- 2. Release Governance Workflows
CREATE TABLE "release_governance_workflows" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "releaseVersion" TEXT NOT NULL,
    "releaseType" TEXT NOT NULL,
    "releaseStatus" TEXT NOT NULL,
    "approvalSteps" INTEGER NOT NULL DEFAULT 0,
    "stepsCompleted" INTEGER NOT NULL DEFAULT 0,
    "releaseHash" TEXT NOT NULL,
    "approvalChain" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "release_governance_workflows_pkey" PRIMARY KEY ("id")
);

-- 3. Controlled Feature Enablements
CREATE TABLE "controlled_feature_enablements" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "featureScope" TEXT NOT NULL,
    "permissionRequired" TEXT NOT NULL,
    "enablementStatus" TEXT NOT NULL,
    "enabledBy" TEXT,
    "enabledAt" TEXT,
    "featureConfig" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "controlled_feature_enablements_pkey" PRIMARY KEY ("id")
);

-- 4. Operational Policy Harmonizations
CREATE TABLE "operational_policy_harmonizations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "policyDomain" TEXT NOT NULL,
    "policiesTotal" INTEGER NOT NULL DEFAULT 0,
    "policiesHarmonized" INTEGER NOT NULL DEFAULT 0,
    "conflictsDetected" INTEGER NOT NULL DEFAULT 0,
    "harmonizationStatus" TEXT NOT NULL,
    "policyHash" TEXT NOT NULL,
    "policyDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_policy_harmonizations_pkey" PRIMARY KEY ("id")
);

-- 5. Administrative Action Certifications
CREATE TABLE "administrative_action_certifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionPerformedBy" TEXT NOT NULL,
    "actionHash" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "certificationStatus" TEXT NOT NULL,
    "certifiedBy" TEXT,
    "certifiedAt" TEXT,
    "actionDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "administrative_action_certifications_pkey" PRIMARY KEY ("id")
);

-- 6. Platform Stewardship Trackings
CREATE TABLE "platform_stewardship_trackings" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "stewardshipArea" TEXT NOT NULL,
    "stewardStatus" TEXT NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "issuesOpen" INTEGER NOT NULL DEFAULT 0,
    "issuesResolved" INTEGER NOT NULL DEFAULT 0,
    "stewardHash" TEXT NOT NULL,
    "stewardDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_stewardship_trackings_pkey" PRIMARY KEY ("id")
);

-- 7. Governance Synchronization Engines
CREATE TABLE "governance_synchronization_engines" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceGovernance" TEXT NOT NULL,
    "targetGovernance" TEXT NOT NULL,
    "syncStatus" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "targetHash" TEXT NOT NULL,
    "hashesMatch" BOOLEAN NOT NULL DEFAULT false,
    "syncDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "governance_synchronization_engines_pkey" PRIMARY KEY ("id")
);

-- 8. Release Integrity Verifications
CREATE TABLE "release_integrity_verifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "releaseVersion" TEXT NOT NULL,
    "verificationScope" TEXT NOT NULL,
    "originalHash" TEXT NOT NULL,
    "verifiedHash" TEXT NOT NULL,
    "hashesMatch" BOOLEAN NOT NULL DEFAULT false,
    "componentsVerified" INTEGER NOT NULL DEFAULT 0,
    "verificationDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "release_integrity_verifications_pkey" PRIMARY KEY ("id")
);

-- 9. Cross-Layer Policy Validations
CREATE TABLE "cross_layer_policy_validations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceLayer" TEXT NOT NULL,
    "targetLayer" TEXT NOT NULL,
    "policiesValidated" INTEGER NOT NULL DEFAULT 0,
    "policiesPassed" INTEGER NOT NULL DEFAULT 0,
    "policiesFailed" INTEGER NOT NULL DEFAULT 0,
    "validationStatus" TEXT NOT NULL,
    "validationHash" TEXT NOT NULL,
    "validationDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cross_layer_policy_validations_pkey" PRIMARY KEY ("id")
);

-- 10. Doctrine Lineage Trackings
CREATE TABLE "doctrine_lineage_trackings" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "doctrineName" TEXT NOT NULL,
    "lineageVersion" TEXT NOT NULL,
    "previousVersion" TEXT,
    "changeType" TEXT NOT NULL,
    "changeJustification" TEXT NOT NULL,
    "lineageHash" TEXT NOT NULL,
    "previousHash" TEXT,
    "changeDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doctrine_lineage_trackings_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "unified_operational_doctrines_caseId_idx" ON "unified_operational_doctrines"("caseId");
CREATE INDEX "unified_operational_doctrines_doctrineName_idx" ON "unified_operational_doctrines"("doctrineName");
CREATE INDEX "unified_operational_doctrines_doctrineStatus_idx" ON "unified_operational_doctrines"("doctrineStatus");

CREATE INDEX "release_governance_workflows_caseId_idx" ON "release_governance_workflows"("caseId");
CREATE INDEX "release_governance_workflows_releaseType_idx" ON "release_governance_workflows"("releaseType");
CREATE INDEX "release_governance_workflows_releaseStatus_idx" ON "release_governance_workflows"("releaseStatus");

CREATE INDEX "controlled_feature_enablements_caseId_idx" ON "controlled_feature_enablements"("caseId");
CREATE INDEX "controlled_feature_enablements_featureName_idx" ON "controlled_feature_enablements"("featureName");
CREATE INDEX "controlled_feature_enablements_enablementStatus_idx" ON "controlled_feature_enablements"("enablementStatus");

CREATE INDEX "operational_policy_harmonizations_caseId_idx" ON "operational_policy_harmonizations"("caseId");
CREATE INDEX "operational_policy_harmonizations_policyDomain_idx" ON "operational_policy_harmonizations"("policyDomain");
CREATE INDEX "operational_policy_harmonizations_harmonizationStatus_idx" ON "operational_policy_harmonizations"("harmonizationStatus");

CREATE INDEX "administrative_action_certifications_caseId_idx" ON "administrative_action_certifications"("caseId");
CREATE INDEX "administrative_action_certifications_actionType_idx" ON "administrative_action_certifications"("actionType");
CREATE INDEX "administrative_action_certifications_certificationStatus_idx" ON "administrative_action_certifications"("certificationStatus");

CREATE INDEX "platform_stewardship_trackings_caseId_idx" ON "platform_stewardship_trackings"("caseId");
CREATE INDEX "platform_stewardship_trackings_stewardshipArea_idx" ON "platform_stewardship_trackings"("stewardshipArea");
CREATE INDEX "platform_stewardship_trackings_stewardStatus_idx" ON "platform_stewardship_trackings"("stewardStatus");

CREATE INDEX "governance_synchronization_engines_caseId_idx" ON "governance_synchronization_engines"("caseId");
CREATE INDEX "governance_synchronization_engines_sourceGovernance_idx" ON "governance_synchronization_engines"("sourceGovernance");
CREATE INDEX "governance_synchronization_engines_syncStatus_idx" ON "governance_synchronization_engines"("syncStatus");

CREATE INDEX "release_integrity_verifications_caseId_idx" ON "release_integrity_verifications"("caseId");
CREATE INDEX "release_integrity_verifications_releaseVersion_idx" ON "release_integrity_verifications"("releaseVersion");
CREATE INDEX "release_integrity_verifications_hashesMatch_idx" ON "release_integrity_verifications"("hashesMatch");

CREATE INDEX "cross_layer_policy_validations_caseId_idx" ON "cross_layer_policy_validations"("caseId");
CREATE INDEX "cross_layer_policy_validations_sourceLayer_idx" ON "cross_layer_policy_validations"("sourceLayer");
CREATE INDEX "cross_layer_policy_validations_validationStatus_idx" ON "cross_layer_policy_validations"("validationStatus");

CREATE INDEX "doctrine_lineage_trackings_caseId_idx" ON "doctrine_lineage_trackings"("caseId");
CREATE INDEX "doctrine_lineage_trackings_doctrineName_idx" ON "doctrine_lineage_trackings"("doctrineName");
CREATE INDEX "doctrine_lineage_trackings_changeType_idx" ON "doctrine_lineage_trackings"("changeType");
