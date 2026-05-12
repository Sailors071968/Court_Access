-- Phase N.3: Controlled Pilot Deployment + Real-World Operational Validation
-- 10 tables for historical replay pilots, internal user pilots, attorney telemetry,
-- workflow friction, export validation, survivability drills, rollback rehearsals,
-- feature enablement, issue triage, pilot certification.

-- 1. Historical Case Replay Pilots
CREATE TABLE "historical_case_replay_pilots" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "historicalCaseRef" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "replayStatus" TEXT NOT NULL,
    "outputMatchBaseline" BOOLEAN NOT NULL DEFAULT false,
    "contradictionsFound" INTEGER NOT NULL DEFAULT 0,
    "burdensFound" INTEGER NOT NULL DEFAULT 0,
    "replayHash" TEXT NOT NULL,
    "replayDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historical_case_replay_pilots_pkey" PRIMARY KEY ("id")
);

-- 2. Internal User Pilots
CREATE TABLE "internal_user_pilots" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "pilotScope" TEXT NOT NULL,
    "permissionLevel" TEXT NOT NULL,
    "pilotStatus" TEXT NOT NULL,
    "feedbackScore" DOUBLE PRECISION,
    "pilotDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "internal_user_pilots_pkey" PRIMARY KEY ("id")
);

-- 3. Attorney Usability Telemetry
CREATE TABLE "attorney_usability_telemetry" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "actionCount" INTEGER NOT NULL DEFAULT 0,
    "sessionDurationMs" INTEGER NOT NULL DEFAULT 0,
    "frictionEvents" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "telemetryHash" TEXT NOT NULL,
    "telemetryDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attorney_usability_telemetry_pkey" PRIMARY KEY ("id")
);

-- 4. Workflow Friction Entries
CREATE TABLE "workflow_friction_entries" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "workflowStep" TEXT NOT NULL,
    "frictionType" TEXT NOT NULL,
    "severityLevel" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolutionDetails" TEXT,
    "frictionDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_friction_entries_pkey" PRIMARY KEY ("id")
);

-- 5. Real-World Export Validations
CREATE TABLE "real_world_export_validations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "exportHash" TEXT NOT NULL,
    "baselineHash" TEXT NOT NULL,
    "hashesMatch" BOOLEAN NOT NULL DEFAULT false,
    "exportSize" INTEGER NOT NULL DEFAULT 0,
    "validationStatus" TEXT NOT NULL,
    "exportDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "real_world_export_validations_pkey" PRIMARY KEY ("id")
);

-- 6. Production Survivability Drills
CREATE TABLE "production_survivability_drills" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "drillType" TEXT NOT NULL,
    "drillStatus" TEXT NOT NULL,
    "recoveryTimeMs" INTEGER NOT NULL DEFAULT 0,
    "dataIntegrityVerified" BOOLEAN NOT NULL DEFAULT true,
    "servicesContinued" BOOLEAN NOT NULL DEFAULT true,
    "drillHash" TEXT NOT NULL,
    "drillDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_survivability_drills_pkey" PRIMARY KEY ("id")
);

-- 7. Pilot Rollback Rehearsals
CREATE TABLE "pilot_rollback_rehearsals" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "rollbackScope" TEXT NOT NULL,
    "rollbackSteps" INTEGER NOT NULL DEFAULT 0,
    "stepsCompleted" INTEGER NOT NULL DEFAULT 0,
    "rollbackStatus" TEXT NOT NULL,
    "dataPreserved" BOOLEAN NOT NULL DEFAULT true,
    "rollbackHash" TEXT NOT NULL,
    "rollbackDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pilot_rollback_rehearsals_pkey" PRIMARY KEY ("id")
);

-- 8. Pilot Feature Enablements
CREATE TABLE "pilot_feature_enablements" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "featureScope" TEXT NOT NULL,
    "governanceApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "enablementStatus" TEXT NOT NULL,
    "enablementHash" TEXT NOT NULL,
    "enablementDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pilot_feature_enablements_pkey" PRIMARY KEY ("id")
);

-- 9. Operational Issue Triages
CREATE TABLE "operational_issue_triages" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "issueSeverity" TEXT NOT NULL,
    "issueStatus" TEXT NOT NULL,
    "affectedWorkflow" TEXT NOT NULL,
    "resolutionHash" TEXT,
    "issueDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_issue_triages_pkey" PRIMARY KEY ("id")
);

-- 10. Pilot Certification Manifests
CREATE TABLE "pilot_certification_manifests" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "certificationArea" TEXT NOT NULL,
    "certificationHash" TEXT NOT NULL,
    "certified" BOOLEAN NOT NULL DEFAULT false,
    "certifiedBy" TEXT,
    "certifiedAt" TEXT,
    "manifestDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pilot_certification_manifests_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "historical_case_replay_pilots_caseId_idx" ON "historical_case_replay_pilots"("caseId");
CREATE INDEX "historical_case_replay_pilots_caseType_idx" ON "historical_case_replay_pilots"("caseType");
CREATE INDEX "historical_case_replay_pilots_replayStatus_idx" ON "historical_case_replay_pilots"("replayStatus");

CREATE INDEX "internal_user_pilots_caseId_idx" ON "internal_user_pilots"("caseId");
CREATE INDEX "internal_user_pilots_userId_idx" ON "internal_user_pilots"("userId");
CREATE INDEX "internal_user_pilots_pilotStatus_idx" ON "internal_user_pilots"("pilotStatus");

CREATE INDEX "attorney_usability_telemetry_caseId_idx" ON "attorney_usability_telemetry"("caseId");
CREATE INDEX "attorney_usability_telemetry_workflowName_idx" ON "attorney_usability_telemetry"("workflowName");
CREATE INDEX "attorney_usability_telemetry_sessionId_idx" ON "attorney_usability_telemetry"("sessionId");

CREATE INDEX "workflow_friction_entries_caseId_idx" ON "workflow_friction_entries"("caseId");
CREATE INDEX "workflow_friction_entries_workflowStep_idx" ON "workflow_friction_entries"("workflowStep");
CREATE INDEX "workflow_friction_entries_severityLevel_idx" ON "workflow_friction_entries"("severityLevel");

CREATE INDEX "real_world_export_validations_caseId_idx" ON "real_world_export_validations"("caseId");
CREATE INDEX "real_world_export_validations_exportType_idx" ON "real_world_export_validations"("exportType");
CREATE INDEX "real_world_export_validations_validationStatus_idx" ON "real_world_export_validations"("validationStatus");

CREATE INDEX "production_survivability_drills_caseId_idx" ON "production_survivability_drills"("caseId");
CREATE INDEX "production_survivability_drills_drillType_idx" ON "production_survivability_drills"("drillType");
CREATE INDEX "production_survivability_drills_drillStatus_idx" ON "production_survivability_drills"("drillStatus");

CREATE INDEX "pilot_rollback_rehearsals_caseId_idx" ON "pilot_rollback_rehearsals"("caseId");
CREATE INDEX "pilot_rollback_rehearsals_rollbackScope_idx" ON "pilot_rollback_rehearsals"("rollbackScope");
CREATE INDEX "pilot_rollback_rehearsals_rollbackStatus_idx" ON "pilot_rollback_rehearsals"("rollbackStatus");

CREATE INDEX "pilot_feature_enablements_caseId_idx" ON "pilot_feature_enablements"("caseId");
CREATE INDEX "pilot_feature_enablements_featureName_idx" ON "pilot_feature_enablements"("featureName");
CREATE INDEX "pilot_feature_enablements_enablementStatus_idx" ON "pilot_feature_enablements"("enablementStatus");

CREATE INDEX "operational_issue_triages_caseId_idx" ON "operational_issue_triages"("caseId");
CREATE INDEX "operational_issue_triages_issueType_idx" ON "operational_issue_triages"("issueType");
CREATE INDEX "operational_issue_triages_issueStatus_idx" ON "operational_issue_triages"("issueStatus");

CREATE INDEX "pilot_certification_manifests_caseId_idx" ON "pilot_certification_manifests"("caseId");
CREATE INDEX "pilot_certification_manifests_certificationArea_idx" ON "pilot_certification_manifests"("certificationArea");
CREATE INDEX "pilot_certification_manifests_certified_idx" ON "pilot_certification_manifests"("certified");
