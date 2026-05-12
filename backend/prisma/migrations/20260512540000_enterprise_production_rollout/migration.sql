-- Phase P.1: Controlled Enterprise Production Rollout + Operational Stewardship
-- 10 tables for institutional rollout, operations monitoring, support workflows,
-- attorney onboarding, incident governance, survivability oversight, SLA tracking,
-- workflow telemetry, stewardship manifests, readiness certification.

-- 1. Controlled Institutional Rollouts
CREATE TABLE "controlled_institutional_rollouts" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "rolloutStage" TEXT NOT NULL,
    "stageOrder" INTEGER NOT NULL DEFAULT 0,
    "stageStatus" TEXT NOT NULL,
    "governanceApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "rolloutHash" TEXT NOT NULL,
    "rolloutDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "controlled_institutional_rollouts_pkey" PRIMARY KEY ("id")
);

-- 2. Production Operations Monitors
CREATE TABLE "production_operations_monitors" (
    "id" TEXT NOT NULL,
    "operationDomain" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monitorStatus" TEXT NOT NULL,
    "trendDirection" TEXT NOT NULL,
    "alertsTriggered" INTEGER NOT NULL DEFAULT 0,
    "monitorHash" TEXT NOT NULL,
    "monitorDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_operations_monitors_pkey" PRIMARY KEY ("id")
);

-- 3. Enterprise Support Workflows
CREATE TABLE "enterprise_support_workflows" (
    "id" TEXT NOT NULL,
    "supportCategory" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "assignedTeam" TEXT,
    "workflowStatus" TEXT NOT NULL,
    "slaTargetMs" INTEGER NOT NULL DEFAULT 0,
    "slaActualMs" INTEGER NOT NULL DEFAULT 0,
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "workflowHash" TEXT NOT NULL,
    "workflowDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "enterprise_support_workflows_pkey" PRIMARY KEY ("id")
);

-- 4. Attorney Onboarding Operations
CREATE TABLE "attorney_onboarding_operations" (
    "id" TEXT NOT NULL,
    "attorneyId" TEXT NOT NULL,
    "attorneyName" TEXT NOT NULL,
    "onboardingStep" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL DEFAULT 0,
    "stepStatus" TEXT NOT NULL,
    "institutionId" TEXT,
    "onboardingHash" TEXT NOT NULL,
    "onboardingDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attorney_onboarding_operations_pkey" PRIMARY KEY ("id")
);

-- 5. Production Incident Governance
CREATE TABLE "production_incident_governance" (
    "id" TEXT NOT NULL,
    "incidentCategory" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "incidentStatus" TEXT NOT NULL,
    "detectedAt" TEXT NOT NULL,
    "resolvedAt" TEXT,
    "responseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "rootCause" TEXT,
    "preventionAction" TEXT,
    "incidentHash" TEXT NOT NULL,
    "incidentDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_incident_governance_pkey" PRIMARY KEY ("id")
);

-- 6. Operational Survivability Oversight
CREATE TABLE "operational_survivability_oversight" (
    "id" TEXT NOT NULL,
    "oversightDomain" TEXT NOT NULL,
    "oversightScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceLinks" TEXT NOT NULL,
    "lastAssessmentDate" TEXT NOT NULL,
    "nextAssessmentDate" TEXT NOT NULL,
    "oversightStatus" TEXT NOT NULL,
    "oversightHash" TEXT NOT NULL,
    "oversightDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_survivability_oversight_pkey" PRIMARY KEY ("id")
);

-- 7. Institutional SLA Tracking
CREATE TABLE "institutional_sla_tracking" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "slaMetric" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "slaMet" BOOLEAN NOT NULL DEFAULT false,
    "measurementPeriod" TEXT NOT NULL,
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "slaHash" TEXT NOT NULL,
    "slaDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "institutional_sla_tracking_pkey" PRIMARY KEY ("id")
);

-- 8. Real-World Workflow Telemetry
CREATE TABLE "real_world_workflow_telemetry" (
    "id" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "avgDurationMs" INTEGER NOT NULL DEFAULT 0,
    "p95DurationMs" INTEGER NOT NULL DEFAULT 0,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "userSatisfaction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "telemetryPeriod" TEXT NOT NULL,
    "telemetryHash" TEXT NOT NULL,
    "telemetryDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "real_world_workflow_telemetry_pkey" PRIMARY KEY ("id")
);

-- 9. Production Stewardship Manifests P1
CREATE TABLE "production_stewardship_manifests_p1" (
    "id" TEXT NOT NULL,
    "stewardshipDomain" TEXT NOT NULL,
    "maturityLevel" TEXT NOT NULL,
    "currentScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "manifestHash" TEXT NOT NULL,
    "manifestDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_stewardship_manifests_p1_pkey" PRIMARY KEY ("id")
);

-- 10. Enterprise Readiness Certifications
CREATE TABLE "enterprise_readiness_certifications" (
    "id" TEXT NOT NULL,
    "certificationArea" TEXT NOT NULL,
    "certificationStatus" TEXT NOT NULL,
    "gatesTotal" INTEGER NOT NULL DEFAULT 0,
    "gatesPassed" INTEGER NOT NULL DEFAULT 0,
    "certificationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "certifiedBy" TEXT,
    "certificationHash" TEXT NOT NULL,
    "certificationDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "enterprise_readiness_certifications_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "controlled_institutional_rollouts_institutionId_idx" ON "controlled_institutional_rollouts"("institutionId");
CREATE INDEX "controlled_institutional_rollouts_rolloutStage_idx" ON "controlled_institutional_rollouts"("rolloutStage");
CREATE INDEX "controlled_institutional_rollouts_environment_idx" ON "controlled_institutional_rollouts"("environment");

CREATE INDEX "production_operations_monitors_operationDomain_idx" ON "production_operations_monitors"("operationDomain");
CREATE INDEX "production_operations_monitors_monitorStatus_idx" ON "production_operations_monitors"("monitorStatus");
CREATE INDEX "production_operations_monitors_environment_idx" ON "production_operations_monitors"("environment");

CREATE INDEX "enterprise_support_workflows_supportCategory_idx" ON "enterprise_support_workflows"("supportCategory");
CREATE INDEX "enterprise_support_workflows_workflowStatus_idx" ON "enterprise_support_workflows"("workflowStatus");
CREATE INDEX "enterprise_support_workflows_environment_idx" ON "enterprise_support_workflows"("environment");

CREATE INDEX "attorney_onboarding_operations_attorneyId_idx" ON "attorney_onboarding_operations"("attorneyId");
CREATE INDEX "attorney_onboarding_operations_onboardingStep_idx" ON "attorney_onboarding_operations"("onboardingStep");
CREATE INDEX "attorney_onboarding_operations_environment_idx" ON "attorney_onboarding_operations"("environment");

CREATE INDEX "production_incident_governance_incidentCategory_idx" ON "production_incident_governance"("incidentCategory");
CREATE INDEX "production_incident_governance_severity_idx" ON "production_incident_governance"("severity");
CREATE INDEX "production_incident_governance_environment_idx" ON "production_incident_governance"("environment");

CREATE INDEX "operational_survivability_oversight_oversightDomain_idx" ON "operational_survivability_oversight"("oversightDomain");
CREATE INDEX "operational_survivability_oversight_oversightStatus_idx" ON "operational_survivability_oversight"("oversightStatus");
CREATE INDEX "operational_survivability_oversight_environment_idx" ON "operational_survivability_oversight"("environment");

CREATE INDEX "institutional_sla_tracking_institutionId_idx" ON "institutional_sla_tracking"("institutionId");
CREATE INDEX "institutional_sla_tracking_slaMetric_idx" ON "institutional_sla_tracking"("slaMetric");
CREATE INDEX "institutional_sla_tracking_environment_idx" ON "institutional_sla_tracking"("environment");

CREATE INDEX "real_world_workflow_telemetry_workflowName_idx" ON "real_world_workflow_telemetry"("workflowName");
CREATE INDEX "real_world_workflow_telemetry_telemetryPeriod_idx" ON "real_world_workflow_telemetry"("telemetryPeriod");
CREATE INDEX "real_world_workflow_telemetry_environment_idx" ON "real_world_workflow_telemetry"("environment");

CREATE INDEX "production_stewardship_manifests_p1_stewardshipDomain_idx" ON "production_stewardship_manifests_p1"("stewardshipDomain");
CREATE INDEX "production_stewardship_manifests_p1_maturityLevel_idx" ON "production_stewardship_manifests_p1"("maturityLevel");
CREATE INDEX "production_stewardship_manifests_p1_environment_idx" ON "production_stewardship_manifests_p1"("environment");

CREATE INDEX "enterprise_readiness_certifications_certificationArea_idx" ON "enterprise_readiness_certifications"("certificationArea");
CREATE INDEX "enterprise_readiness_certifications_certificationStatus_idx" ON "enterprise_readiness_certifications"("certificationStatus");
CREATE INDEX "enterprise_readiness_certifications_environment_idx" ON "enterprise_readiness_certifications"("environment");
