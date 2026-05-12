-- Phase M.2: Unified Ecosystem Orchestration + Deterministic Platform Convergence
-- 10 tables for ecosystem orchestration, subsystem coordination, convergence sync,
-- state harmonization, orchestration manifests, coordination replay,
-- orchestration validation, convergence certification, completeness tracking, lineage sync.

-- 1. Unified Ecosystem Orchestrations
CREATE TABLE "unified_ecosystem_orchestrations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "orchestrationScope" TEXT NOT NULL,
    "subsystemsTotal" INTEGER NOT NULL DEFAULT 0,
    "subsystemsOrchestrated" INTEGER NOT NULL DEFAULT 0,
    "orchestrationStatus" TEXT NOT NULL,
    "orchestrationHash" TEXT NOT NULL,
    "orchestrationPlan" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "unified_ecosystem_orchestrations_pkey" PRIMARY KEY ("id")
);

-- 2. Cross-Subsystem Lifecycle Coordinations
CREATE TABLE "cross_subsystem_lifecycle_coordinations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceSubsystem" TEXT NOT NULL,
    "targetSubsystem" TEXT NOT NULL,
    "coordinationStatus" TEXT NOT NULL,
    "lifecyclePhase" TEXT NOT NULL,
    "coordinationHash" TEXT NOT NULL,
    "coordinationDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cross_subsystem_lifecycle_coordinations_pkey" PRIMARY KEY ("id")
);

-- 3. Platform Convergence Synchronizations
CREATE TABLE "platform_convergence_synchronizations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "convergenceDomain" TEXT NOT NULL,
    "layersTotal" INTEGER NOT NULL DEFAULT 0,
    "layersConverged" INTEGER NOT NULL DEFAULT 0,
    "convergenceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "convergenceStatus" TEXT NOT NULL,
    "convergenceHash" TEXT NOT NULL,
    "convergenceDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_convergence_synchronizations_pkey" PRIMARY KEY ("id")
);

-- 4. Ecosystem State Harmonizations
CREATE TABLE "ecosystem_state_harmonizations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "componentState" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "previousStateHash" TEXT,
    "stateConsistent" BOOLEAN NOT NULL DEFAULT true,
    "harmonizationDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ecosystem_state_harmonizations_pkey" PRIMARY KEY ("id")
);

-- 5. Unified Orchestration Manifests
CREATE TABLE "unified_orchestration_manifests" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "manifestScope" TEXT NOT NULL,
    "entriesCount" INTEGER NOT NULL DEFAULT 0,
    "entriesVerified" INTEGER NOT NULL DEFAULT 0,
    "manifestHash" TEXT NOT NULL,
    "manifestComplete" BOOLEAN NOT NULL DEFAULT false,
    "generatedBy" TEXT NOT NULL,
    "manifestEntries" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "unified_orchestration_manifests_pkey" PRIMARY KEY ("id")
);

-- 6. Deterministic Coordination Replays
CREATE TABLE "deterministic_coordination_replays" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "replayScope" TEXT NOT NULL,
    "originalHash" TEXT NOT NULL,
    "replayHash" TEXT NOT NULL,
    "hashesMatch" BOOLEAN NOT NULL DEFAULT false,
    "stepsReplayed" INTEGER NOT NULL DEFAULT 0,
    "replayDurationMs" INTEGER NOT NULL DEFAULT 0,
    "discrepancies" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deterministic_coordination_replays_pkey" PRIMARY KEY ("id")
);

-- 7. Cross-Layer Orchestration Validations
CREATE TABLE "cross_layer_orchestration_validations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceLayer" TEXT NOT NULL,
    "targetLayer" TEXT NOT NULL,
    "validationsTotal" INTEGER NOT NULL DEFAULT 0,
    "validationsPassed" INTEGER NOT NULL DEFAULT 0,
    "validationsFailed" INTEGER NOT NULL DEFAULT 0,
    "validationStatus" TEXT NOT NULL,
    "validationHash" TEXT NOT NULL,
    "validationDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cross_layer_orchestration_validations_pkey" PRIMARY KEY ("id")
);

-- 8. Final Convergence Certifications
CREATE TABLE "final_convergence_certifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "certificationScope" TEXT NOT NULL,
    "rulesTotal" INTEGER NOT NULL DEFAULT 0,
    "rulesPassed" INTEGER NOT NULL DEFAULT 0,
    "rulesFailed" INTEGER NOT NULL DEFAULT 0,
    "convergenceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "certificationStatus" TEXT NOT NULL,
    "certifiedBy" TEXT,
    "certifiedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "final_convergence_certifications_pkey" PRIMARY KEY ("id")
);

-- 9. Operational Completeness Trackings
CREATE TABLE "operational_completeness_trackings" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "domainName" TEXT NOT NULL,
    "capabilitiesTotal" INTEGER NOT NULL DEFAULT 0,
    "capabilitiesActive" INTEGER NOT NULL DEFAULT 0,
    "completenessRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completenessStatus" TEXT NOT NULL,
    "domainHash" TEXT NOT NULL,
    "domainDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_completeness_trackings_pkey" PRIMARY KEY ("id")
);

-- 10. Ecosystem Lineage Synchronizations
CREATE TABLE "ecosystem_lineage_synchronizations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "lineageSource" TEXT NOT NULL,
    "lineageTarget" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "targetVersion" TEXT NOT NULL,
    "syncStatus" TEXT NOT NULL,
    "lineageHash" TEXT NOT NULL,
    "syncDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ecosystem_lineage_synchronizations_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "unified_ecosystem_orchestrations_caseId_idx" ON "unified_ecosystem_orchestrations"("caseId");
CREATE INDEX "unified_ecosystem_orchestrations_orchestrationScope_idx" ON "unified_ecosystem_orchestrations"("orchestrationScope");
CREATE INDEX "unified_ecosystem_orchestrations_orchestrationStatus_idx" ON "unified_ecosystem_orchestrations"("orchestrationStatus");

CREATE INDEX "cross_subsystem_lifecycle_coordinations_caseId_idx" ON "cross_subsystem_lifecycle_coordinations"("caseId");
CREATE INDEX "cross_subsystem_lifecycle_coordinations_sourceSubsystem_idx" ON "cross_subsystem_lifecycle_coordinations"("sourceSubsystem");
CREATE INDEX "cross_subsystem_lifecycle_coordinations_coordinationStatus_idx" ON "cross_subsystem_lifecycle_coordinations"("coordinationStatus");

CREATE INDEX "platform_convergence_synchronizations_caseId_idx" ON "platform_convergence_synchronizations"("caseId");
CREATE INDEX "platform_convergence_synchronizations_convergenceDomain_idx" ON "platform_convergence_synchronizations"("convergenceDomain");
CREATE INDEX "platform_convergence_synchronizations_convergenceStatus_idx" ON "platform_convergence_synchronizations"("convergenceStatus");

CREATE INDEX "ecosystem_state_harmonizations_caseId_idx" ON "ecosystem_state_harmonizations"("caseId");
CREATE INDEX "ecosystem_state_harmonizations_componentName_idx" ON "ecosystem_state_harmonizations"("componentName");
CREATE INDEX "ecosystem_state_harmonizations_componentState_idx" ON "ecosystem_state_harmonizations"("componentState");

CREATE INDEX "unified_orchestration_manifests_caseId_idx" ON "unified_orchestration_manifests"("caseId");
CREATE INDEX "unified_orchestration_manifests_manifestScope_idx" ON "unified_orchestration_manifests"("manifestScope");
CREATE INDEX "unified_orchestration_manifests_manifestComplete_idx" ON "unified_orchestration_manifests"("manifestComplete");

CREATE INDEX "deterministic_coordination_replays_caseId_idx" ON "deterministic_coordination_replays"("caseId");
CREATE INDEX "deterministic_coordination_replays_replayScope_idx" ON "deterministic_coordination_replays"("replayScope");
CREATE INDEX "deterministic_coordination_replays_hashesMatch_idx" ON "deterministic_coordination_replays"("hashesMatch");

CREATE INDEX "cross_layer_orchestration_validations_caseId_idx" ON "cross_layer_orchestration_validations"("caseId");
CREATE INDEX "cross_layer_orchestration_validations_sourceLayer_idx" ON "cross_layer_orchestration_validations"("sourceLayer");
CREATE INDEX "cross_layer_orchestration_validations_validationStatus_idx" ON "cross_layer_orchestration_validations"("validationStatus");

CREATE INDEX "final_convergence_certifications_caseId_idx" ON "final_convergence_certifications"("caseId");
CREATE INDEX "final_convergence_certifications_certificationScope_idx" ON "final_convergence_certifications"("certificationScope");
CREATE INDEX "final_convergence_certifications_certificationStatus_idx" ON "final_convergence_certifications"("certificationStatus");

CREATE INDEX "operational_completeness_trackings_caseId_idx" ON "operational_completeness_trackings"("caseId");
CREATE INDEX "operational_completeness_trackings_domainName_idx" ON "operational_completeness_trackings"("domainName");
CREATE INDEX "operational_completeness_trackings_completenessStatus_idx" ON "operational_completeness_trackings"("completenessStatus");

CREATE INDEX "ecosystem_lineage_synchronizations_caseId_idx" ON "ecosystem_lineage_synchronizations"("caseId");
CREATE INDEX "ecosystem_lineage_synchronizations_lineageSource_idx" ON "ecosystem_lineage_synchronizations"("lineageSource");
CREATE INDEX "ecosystem_lineage_synchronizations_syncStatus_idx" ON "ecosystem_lineage_synchronizations"("syncStatus");
