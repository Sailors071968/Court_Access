-- Phase J.1: Long-Term Continuity + Institutional Resilience Framework
-- 10 tables for evidence preservation, disaster recovery, continuity workflows,
-- multi-region integrity, archival survivability, recovery governance,
-- continuity manifests, retention lifecycle, recovery simulation, preservation certification.

-- 1. Long-Term Evidence Preservations
CREATE TABLE "long_term_evidence_preservations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceRecordId" TEXT NOT NULL,
    "preservationType" TEXT NOT NULL,
    "preservationFormat" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "preservedAt" TEXT NOT NULL,
    "expiresAt" TEXT,
    "storageLocation" TEXT NOT NULL,
    "integrityVerified" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "long_term_evidence_preservations_pkey" PRIMARY KEY ("id")
);

-- 2. Disaster Recovery Orchestrations
CREATE TABLE "disaster_recovery_orchestrations" (
    "id" TEXT NOT NULL,
    "scenarioType" TEXT NOT NULL,
    "recoveryPlan" TEXT NOT NULL,
    "estimatedRecoveryTime" TEXT NOT NULL,
    "lastTestedAt" TEXT,
    "testResult" TEXT NOT NULL,
    "dataIntegrityCheck" BOOLEAN NOT NULL DEFAULT false,
    "servicesRecovered" TEXT NOT NULL,
    "recoveryPriority" INTEGER NOT NULL DEFAULT 1,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "disaster_recovery_orchestrations_pkey" PRIMARY KEY ("id")
);

-- 3. Continuity of Operations Workflows
CREATE TABLE "continuity_of_operations_workflows" (
    "id" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "workflowType" TEXT NOT NULL,
    "triggerCondition" TEXT NOT NULL,
    "executionSteps" TEXT NOT NULL,
    "stepsPassed" INTEGER NOT NULL DEFAULT 0,
    "stepsFailed" INTEGER NOT NULL DEFAULT 0,
    "workflowStatus" TEXT NOT NULL,
    "lastExecutedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "continuity_of_operations_workflows_pkey" PRIMARY KEY ("id")
);

-- 4. Multi-Region Integrity Verifications
CREATE TABLE "multi_region_integrity_verifications" (
    "id" TEXT NOT NULL,
    "primaryRegion" TEXT NOT NULL,
    "secondaryRegion" TEXT NOT NULL,
    "datasetType" TEXT NOT NULL,
    "primaryHash" TEXT NOT NULL,
    "secondaryHash" TEXT NOT NULL,
    "hashConsistent" BOOLEAN NOT NULL DEFAULT false,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TEXT,
    "syncLatency" INTEGER NOT NULL DEFAULT 0,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "multi_region_integrity_verifications_pkey" PRIMARY KEY ("id")
);

-- 5. Archival Survivability Validations
CREATE TABLE "archival_survivability_validations" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "archiveType" TEXT NOT NULL,
    "survivabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "checksPerformed" TEXT NOT NULL,
    "checksPassed" INTEGER NOT NULL DEFAULT 0,
    "checksFailed" INTEGER NOT NULL DEFAULT 0,
    "integrityHash" TEXT NOT NULL,
    "storageRedundancy" INTEGER NOT NULL DEFAULT 1,
    "lastValidatedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "archival_survivability_validations_pkey" PRIMARY KEY ("id")
);

-- 6. Recovery Governance Trackings
CREATE TABLE "recovery_governance_trackings" (
    "id" TEXT NOT NULL,
    "recoveryEventId" TEXT NOT NULL,
    "recoveryType" TEXT NOT NULL,
    "authorizedBy" TEXT NOT NULL,
    "authorizationLevel" TEXT NOT NULL,
    "recoveryScope" TEXT NOT NULL,
    "preRecoveryState" TEXT NOT NULL,
    "postRecoveryState" TEXT NOT NULL,
    "dataIntegrityVerified" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recovery_governance_trackings_pkey" PRIMARY KEY ("id")
);

-- 7. Institutional Continuity Manifests
CREATE TABLE "institutional_continuity_manifests" (
    "id" TEXT NOT NULL,
    "manifestVersion" TEXT NOT NULL DEFAULT '1.0',
    "systemComponents" TEXT NOT NULL,
    "criticalPaths" TEXT NOT NULL,
    "singlePointsOfFailure" TEXT NOT NULL,
    "redundancyLevel" TEXT NOT NULL,
    "lastReviewedAt" TEXT,
    "reviewedBy" TEXT,
    "manifestHash" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "institutional_continuity_manifests_pkey" PRIMARY KEY ("id")
);

-- 8. Retention Lifecycle Managements
CREATE TABLE "retention_lifecycle_managements" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "dataType" TEXT NOT NULL,
    "retentionPolicy" TEXT NOT NULL,
    "retentionStartDate" TEXT NOT NULL,
    "retentionEndDate" TEXT,
    "currentStatus" TEXT NOT NULL,
    "complianceVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastAuditedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "retention_lifecycle_managements_pkey" PRIMARY KEY ("id")
);

-- 9. Recovery Simulation Frameworks
CREATE TABLE "recovery_simulation_frameworks" (
    "id" TEXT NOT NULL,
    "simulationType" TEXT NOT NULL,
    "simulationScope" TEXT NOT NULL,
    "startedAt" TEXT NOT NULL,
    "completedAt" TEXT,
    "recoveryTimeActual" INTEGER NOT NULL DEFAULT 0,
    "dataLossDetected" BOOLEAN NOT NULL DEFAULT false,
    "servicesImpacted" TEXT NOT NULL,
    "testsPassed" INTEGER NOT NULL DEFAULT 0,
    "testsFailed" INTEGER NOT NULL DEFAULT 0,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recovery_simulation_frameworks_pkey" PRIMARY KEY ("id")
);

-- 10. Preservation Certifications
CREATE TABLE "preservation_certifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "certificationScope" TEXT NOT NULL,
    "evidenceRecordsCount" INTEGER NOT NULL DEFAULT 0,
    "preservedRecordsCount" INTEGER NOT NULL DEFAULT 0,
    "preservationRate" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "integrityVerified" BOOLEAN NOT NULL DEFAULT false,
    "certificationStatus" TEXT NOT NULL,
    "certifiedBy" TEXT,
    "certifiedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "preservation_certifications_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "long_term_evidence_preservations_caseId_idx" ON "long_term_evidence_preservations"("caseId");
CREATE INDEX "long_term_evidence_preservations_preservationType_idx" ON "long_term_evidence_preservations"("preservationType");
CREATE INDEX "long_term_evidence_preservations_storageLocation_idx" ON "long_term_evidence_preservations"("storageLocation");

CREATE INDEX "disaster_recovery_orchestrations_scenarioType_idx" ON "disaster_recovery_orchestrations"("scenarioType");
CREATE INDEX "disaster_recovery_orchestrations_testResult_idx" ON "disaster_recovery_orchestrations"("testResult");
CREATE INDEX "disaster_recovery_orchestrations_recoveryPriority_idx" ON "disaster_recovery_orchestrations"("recoveryPriority");

CREATE INDEX "continuity_of_operations_workflows_workflowType_idx" ON "continuity_of_operations_workflows"("workflowType");
CREATE INDEX "continuity_of_operations_workflows_workflowStatus_idx" ON "continuity_of_operations_workflows"("workflowStatus");

CREATE INDEX "multi_region_integrity_verifications_primaryRegion_idx" ON "multi_region_integrity_verifications"("primaryRegion");
CREATE INDEX "multi_region_integrity_verifications_datasetType_idx" ON "multi_region_integrity_verifications"("datasetType");
CREATE INDEX "multi_region_integrity_verifications_hashConsistent_idx" ON "multi_region_integrity_verifications"("hashConsistent");

CREATE INDEX "archival_survivability_validations_archiveId_idx" ON "archival_survivability_validations"("archiveId");
CREATE INDEX "archival_survivability_validations_archiveType_idx" ON "archival_survivability_validations"("archiveType");
CREATE INDEX "archival_survivability_validations_survivabilityScore_idx" ON "archival_survivability_validations"("survivabilityScore");

CREATE INDEX "recovery_governance_trackings_recoveryEventId_idx" ON "recovery_governance_trackings"("recoveryEventId");
CREATE INDEX "recovery_governance_trackings_recoveryType_idx" ON "recovery_governance_trackings"("recoveryType");
CREATE INDEX "recovery_governance_trackings_authorizationLevel_idx" ON "recovery_governance_trackings"("authorizationLevel");

CREATE INDEX "institutional_continuity_manifests_redundancyLevel_idx" ON "institutional_continuity_manifests"("redundancyLevel");
CREATE INDEX "institutional_continuity_manifests_manifestVersion_idx" ON "institutional_continuity_manifests"("manifestVersion");

CREATE INDEX "retention_lifecycle_managements_caseId_idx" ON "retention_lifecycle_managements"("caseId");
CREATE INDEX "retention_lifecycle_managements_dataType_idx" ON "retention_lifecycle_managements"("dataType");
CREATE INDEX "retention_lifecycle_managements_currentStatus_idx" ON "retention_lifecycle_managements"("currentStatus");

CREATE INDEX "recovery_simulation_frameworks_simulationType_idx" ON "recovery_simulation_frameworks"("simulationType");
CREATE INDEX "recovery_simulation_frameworks_simulationScope_idx" ON "recovery_simulation_frameworks"("simulationScope");
CREATE INDEX "recovery_simulation_frameworks_dataLossDetected_idx" ON "recovery_simulation_frameworks"("dataLossDetected");

CREATE INDEX "preservation_certifications_caseId_idx" ON "preservation_certifications"("caseId");
CREATE INDEX "preservation_certifications_certificationStatus_idx" ON "preservation_certifications"("certificationStatus");
CREATE INDEX "preservation_certifications_certificationScope_idx" ON "preservation_certifications"("certificationScope");
