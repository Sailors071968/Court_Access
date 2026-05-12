-- Phase H.1: Full Operational Defense Platform Integration + Unified Attorney Command Environment
-- 10 tables for unified case state, cross-layer orchestration, evidence lifecycle,
-- litigation milestones, unified search, evidence relationships, workspace sync,
-- role-based workflows, audit logging, and litigation lifecycle. Additive only.

-- 1. Unified Case State
CREATE TABLE "unified_case_states" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "currentPhase" TEXT NOT NULL,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "contradictionCount" INTEGER NOT NULL DEFAULT 0,
    "burdenFractureCount" INTEGER NOT NULL DEFAULT 0,
    "constitutionalIssueCount" INTEGER NOT NULL DEFAULT 0,
    "discoveryIssueCount" INTEGER NOT NULL DEFAULT 0,
    "suppressionIssueCount" INTEGER NOT NULL DEFAULT 0,
    "preservationStatus" TEXT NOT NULL,
    "overallRiskLevel" TEXT NOT NULL,
    "lastAnalysisDate" TEXT,
    "stateSnapshot" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "unified_case_states_pkey" PRIMARY KEY ("id")
);

-- 2. Cross-Layer Orchestration
CREATE TABLE "cross_layer_orchestrations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "orchestrationType" TEXT NOT NULL,
    "layersExecuted" TEXT NOT NULL,
    "layerResults" TEXT NOT NULL,
    "executionOrder" TEXT NOT NULL,
    "totalDuration" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "errorDetails" TEXT,
    "triggeredBy" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cross_layer_orchestrations_pkey" PRIMARY KEY ("id")
);

-- 3. Evidence Lifecycle Tracker
CREATE TABLE "evidence_lifecycle_trackers" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "evidenceDescription" TEXT NOT NULL,
    "currentStage" TEXT NOT NULL,
    "stageHistory" TEXT NOT NULL,
    "linkedLayers" TEXT NOT NULL,
    "layerCount" INTEGER NOT NULL DEFAULT 0,
    "constitutionalRelevance" BOOLEAN NOT NULL DEFAULT false,
    "discoveryRelevance" BOOLEAN NOT NULL DEFAULT false,
    "trialRelevance" BOOLEAN NOT NULL DEFAULT false,
    "appellateRelevance" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_lifecycle_trackers_pkey" PRIMARY KEY ("id")
);

-- 4. Litigation Milestones
CREATE TABLE "litigation_milestones" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "milestoneType" TEXT NOT NULL,
    "milestoneDate" TEXT,
    "status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prerequisitesMet" BOOLEAN NOT NULL DEFAULT false,
    "prerequisiteDetails" TEXT,
    "nextMilestone" TEXT,
    "daysUntilDeadline" INTEGER,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "litigation_milestones_pkey" PRIMARY KEY ("id")
);

-- 5. Unified Search Index
CREATE TABLE "unified_search_indexes" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceLayer" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "searchableText" TEXT NOT NULL,
    "speakerOrWitness" TEXT,
    "amendment" TEXT,
    "severity" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "unified_search_indexes_pkey" PRIMARY KEY ("id")
);

-- 6. Evidence Relationship Explorer
CREATE TABLE "evidence_relationship_explorers" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceEvidenceId" TEXT NOT NULL,
    "targetEvidenceId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "relationshipStrength" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "discoveredByLayer" TEXT NOT NULL,
    "provenanceChain" TEXT NOT NULL,
    "bidirectional" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_relationship_explorers_pkey" PRIMARY KEY ("id")
);

-- 7. Workspace Sync State
CREATE TABLE "workspace_sync_states" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activePane" TEXT NOT NULL,
    "paneStates" TEXT NOT NULL,
    "lastSyncTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selectedEvidenceIds" TEXT,
    "selectedWitnesses" TEXT,
    "filterPresets" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workspace_sync_states_pkey" PRIMARY KEY ("id")
);

-- 8. Role-Based Workflows
CREATE TABLE "role_based_workflows" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionLevel" TEXT NOT NULL,
    "allowedLayers" TEXT NOT NULL,
    "workflowStage" TEXT NOT NULL,
    "assignedTasks" TEXT NOT NULL,
    "completedTasks" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_based_workflows_pkey" PRIMARY KEY ("id")
);

-- 9. Audit Action Logs (immutable)
CREATE TABLE "audit_action_logs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionTarget" TEXT NOT NULL,
    "actionDetails" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "previousState" TEXT,
    "newState" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_action_logs_pkey" PRIMARY KEY ("id")
);

-- 10. Litigation Lifecycle Tracker
CREATE TABLE "litigation_lifecycle_trackers" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "lifecyclePhase" TEXT NOT NULL,
    "phaseStatus" TEXT NOT NULL,
    "entryDate" TEXT,
    "exitDate" TEXT,
    "keyEvents" TEXT NOT NULL,
    "pendingActions" TEXT NOT NULL,
    "completedActions" TEXT NOT NULL,
    "riskFactors" TEXT NOT NULL,
    "phaseOutcome" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "litigation_lifecycle_trackers_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "unified_case_states_caseId_key" ON "unified_case_states"("caseId");
CREATE INDEX "unified_case_states_caseId_idx" ON "unified_case_states"("caseId");
CREATE INDEX "unified_case_states_currentPhase_idx" ON "unified_case_states"("currentPhase");
CREATE INDEX "unified_case_states_overallRiskLevel_idx" ON "unified_case_states"("overallRiskLevel");

CREATE INDEX "cross_layer_orchestrations_caseId_idx" ON "cross_layer_orchestrations"("caseId");
CREATE INDEX "cross_layer_orchestrations_orchestrationType_idx" ON "cross_layer_orchestrations"("orchestrationType");
CREATE INDEX "cross_layer_orchestrations_status_idx" ON "cross_layer_orchestrations"("status");

CREATE INDEX "evidence_lifecycle_trackers_caseId_idx" ON "evidence_lifecycle_trackers"("caseId");
CREATE INDEX "evidence_lifecycle_trackers_currentStage_idx" ON "evidence_lifecycle_trackers"("currentStage");
CREATE INDEX "evidence_lifecycle_trackers_evidenceId_idx" ON "evidence_lifecycle_trackers"("evidenceId");

CREATE INDEX "litigation_milestones_caseId_idx" ON "litigation_milestones"("caseId");
CREATE INDEX "litigation_milestones_milestoneType_idx" ON "litigation_milestones"("milestoneType");
CREATE INDEX "litigation_milestones_status_idx" ON "litigation_milestones"("status");

CREATE INDEX "unified_search_indexes_caseId_idx" ON "unified_search_indexes"("caseId");
CREATE INDEX "unified_search_indexes_sourceLayer_idx" ON "unified_search_indexes"("sourceLayer");
CREATE INDEX "unified_search_indexes_speakerOrWitness_idx" ON "unified_search_indexes"("speakerOrWitness");

CREATE INDEX "evidence_relationship_explorers_caseId_idx" ON "evidence_relationship_explorers"("caseId");
CREATE INDEX "evidence_relationship_explorers_sourceEvidenceId_idx" ON "evidence_relationship_explorers"("sourceEvidenceId");
CREATE INDEX "evidence_relationship_explorers_targetEvidenceId_idx" ON "evidence_relationship_explorers"("targetEvidenceId");
CREATE INDEX "evidence_relationship_explorers_relationshipType_idx" ON "evidence_relationship_explorers"("relationshipType");

CREATE INDEX "workspace_sync_states_caseId_idx" ON "workspace_sync_states"("caseId");
CREATE INDEX "workspace_sync_states_userId_idx" ON "workspace_sync_states"("userId");

CREATE INDEX "role_based_workflows_caseId_idx" ON "role_based_workflows"("caseId");
CREATE INDEX "role_based_workflows_userId_idx" ON "role_based_workflows"("userId");
CREATE INDEX "role_based_workflows_role_idx" ON "role_based_workflows"("role");

CREATE INDEX "audit_action_logs_caseId_idx" ON "audit_action_logs"("caseId");
CREATE INDEX "audit_action_logs_userId_idx" ON "audit_action_logs"("userId");
CREATE INDEX "audit_action_logs_actionType_idx" ON "audit_action_logs"("actionType");
CREATE INDEX "audit_action_logs_createdAt_idx" ON "audit_action_logs"("createdAt");

CREATE INDEX "litigation_lifecycle_trackers_caseId_idx" ON "litigation_lifecycle_trackers"("caseId");
CREATE INDEX "litigation_lifecycle_trackers_lifecyclePhase_idx" ON "litigation_lifecycle_trackers"("lifecyclePhase");
CREATE INDEX "litigation_lifecycle_trackers_phaseStatus_idx" ON "litigation_lifecycle_trackers"("phaseStatus");
