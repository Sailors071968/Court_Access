-- Phase N.5: Controlled Production Enablement + Enterprise Rollout Governance
-- 10 tables for staged rollout, onboarding execution, monitoring readiness,
-- incident response, support workflows, rollout certification, rollback governance,
-- long-term support, enablement controls, stewardship manifests.

-- 1. Staged Rollout Workflows
CREATE TABLE "staged_rollout_workflows" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "rolloutStage" TEXT NOT NULL,
    "targetPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "governanceApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "rolloutStatus" TEXT NOT NULL,
    "rolloutHash" TEXT NOT NULL,
    "rolloutDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staged_rollout_workflows_pkey" PRIMARY KEY ("id")
);

-- 2. Enterprise Onboarding Executions
CREATE TABLE "enterprise_onboarding_executions" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "onboardingPhase" TEXT NOT NULL,
    "stepsTotal" INTEGER NOT NULL DEFAULT 0,
    "stepsCompleted" INTEGER NOT NULL DEFAULT 0,
    "executionStatus" TEXT NOT NULL,
    "executionHash" TEXT NOT NULL,
    "executionDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "enterprise_onboarding_executions_pkey" PRIMARY KEY ("id")
);

-- 3. Production Monitoring Readiness
CREATE TABLE "production_monitoring_readiness" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "monitoringDomain" TEXT NOT NULL,
    "dashboardConfigured" BOOLEAN NOT NULL DEFAULT false,
    "alertsConfigured" BOOLEAN NOT NULL DEFAULT false,
    "thresholdDefined" BOOLEAN NOT NULL DEFAULT false,
    "readinessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "readinessStatus" TEXT NOT NULL,
    "monitoringDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_monitoring_readiness_pkey" PRIMARY KEY ("id")
);

-- 4. Incident Response Orchestrations
CREATE TABLE "incident_response_orchestrations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "incidentType" TEXT NOT NULL,
    "severityLevel" TEXT NOT NULL,
    "responseSteps" INTEGER NOT NULL DEFAULT 0,
    "stepsCompleted" INTEGER NOT NULL DEFAULT 0,
    "responseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "resolutionStatus" TEXT NOT NULL,
    "responseHash" TEXT NOT NULL,
    "responseDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incident_response_orchestrations_pkey" PRIMARY KEY ("id")
);

-- 5. Operational Support Workflows
CREATE TABLE "operational_support_workflows" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "supportCategory" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "priorityLevel" TEXT NOT NULL,
    "slaTargetMs" INTEGER NOT NULL DEFAULT 0,
    "actualResponseMs" INTEGER NOT NULL DEFAULT 0,
    "slaMetric" BOOLEAN NOT NULL DEFAULT false,
    "supportStatus" TEXT NOT NULL,
    "supportHash" TEXT NOT NULL,
    "supportDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_support_workflows_pkey" PRIMARY KEY ("id")
);

-- 6. Enterprise Rollout Certifications
CREATE TABLE "enterprise_rollout_certifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "certificationGate" TEXT NOT NULL,
    "gateStatus" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "verifiedBy" TEXT,
    "verifiedAt" TEXT,
    "certificationDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "enterprise_rollout_certifications_pkey" PRIMARY KEY ("id")
);

-- 7. Production Rollback Governance
CREATE TABLE "production_rollback_governance" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "rollbackTrigger" TEXT NOT NULL,
    "rollbackScope" TEXT NOT NULL,
    "rollbackSteps" INTEGER NOT NULL DEFAULT 0,
    "stepsCompleted" INTEGER NOT NULL DEFAULT 0,
    "dataPreserved" BOOLEAN NOT NULL DEFAULT false,
    "governanceApproved" BOOLEAN NOT NULL DEFAULT false,
    "rollbackStatus" TEXT NOT NULL,
    "rollbackHash" TEXT NOT NULL,
    "rollbackDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_rollback_governance_pkey" PRIMARY KEY ("id")
);

-- 8. Long-Term Support Tracking
CREATE TABLE "long_term_support_tracking" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "supportArea" TEXT NOT NULL,
    "lastVerifiedAt" TEXT NOT NULL,
    "nextScheduledAt" TEXT NOT NULL,
    "trackingStatus" TEXT NOT NULL,
    "evidenceLinked" BOOLEAN NOT NULL DEFAULT false,
    "trackingHash" TEXT NOT NULL,
    "trackingDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "long_term_support_tracking_pkey" PRIMARY KEY ("id")
);

-- 9. Institutional Enablement Controls
CREATE TABLE "institutional_enablement_controls" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "featureScope" TEXT NOT NULL,
    "permissionLevel" TEXT NOT NULL,
    "enablementStatus" TEXT NOT NULL,
    "governanceApproved" BOOLEAN NOT NULL DEFAULT false,
    "enablementHash" TEXT NOT NULL,
    "enablementDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "institutional_enablement_controls_pkey" PRIMARY KEY ("id")
);

-- 10. Production Stewardship Manifests
CREATE TABLE "production_stewardship_manifests" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "stewardshipArea" TEXT NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "stewardshipLevel" TEXT NOT NULL,
    "manifestDetails" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_stewardship_manifests_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "staged_rollout_workflows_caseId_idx" ON "staged_rollout_workflows"("caseId");
CREATE INDEX "staged_rollout_workflows_rolloutStage_idx" ON "staged_rollout_workflows"("rolloutStage");
CREATE INDEX "staged_rollout_workflows_rolloutStatus_idx" ON "staged_rollout_workflows"("rolloutStatus");

CREATE INDEX "enterprise_onboarding_executions_caseId_idx" ON "enterprise_onboarding_executions"("caseId");
CREATE INDEX "enterprise_onboarding_executions_institutionName_idx" ON "enterprise_onboarding_executions"("institutionName");
CREATE INDEX "enterprise_onboarding_executions_executionStatus_idx" ON "enterprise_onboarding_executions"("executionStatus");

CREATE INDEX "production_monitoring_readiness_caseId_idx" ON "production_monitoring_readiness"("caseId");
CREATE INDEX "production_monitoring_readiness_monitoringDomain_idx" ON "production_monitoring_readiness"("monitoringDomain");
CREATE INDEX "production_monitoring_readiness_readinessStatus_idx" ON "production_monitoring_readiness"("readinessStatus");

CREATE INDEX "incident_response_orchestrations_caseId_idx" ON "incident_response_orchestrations"("caseId");
CREATE INDEX "incident_response_orchestrations_incidentType_idx" ON "incident_response_orchestrations"("incidentType");
CREATE INDEX "incident_response_orchestrations_resolutionStatus_idx" ON "incident_response_orchestrations"("resolutionStatus");

CREATE INDEX "operational_support_workflows_caseId_idx" ON "operational_support_workflows"("caseId");
CREATE INDEX "operational_support_workflows_supportCategory_idx" ON "operational_support_workflows"("supportCategory");
CREATE INDEX "operational_support_workflows_supportStatus_idx" ON "operational_support_workflows"("supportStatus");

CREATE INDEX "enterprise_rollout_certifications_caseId_idx" ON "enterprise_rollout_certifications"("caseId");
CREATE INDEX "enterprise_rollout_certifications_certificationGate_idx" ON "enterprise_rollout_certifications"("certificationGate");
CREATE INDEX "enterprise_rollout_certifications_gateStatus_idx" ON "enterprise_rollout_certifications"("gateStatus");

CREATE INDEX "production_rollback_governance_caseId_idx" ON "production_rollback_governance"("caseId");
CREATE INDEX "production_rollback_governance_rollbackTrigger_idx" ON "production_rollback_governance"("rollbackTrigger");
CREATE INDEX "production_rollback_governance_rollbackStatus_idx" ON "production_rollback_governance"("rollbackStatus");

CREATE INDEX "long_term_support_tracking_caseId_idx" ON "long_term_support_tracking"("caseId");
CREATE INDEX "long_term_support_tracking_supportArea_idx" ON "long_term_support_tracking"("supportArea");
CREATE INDEX "long_term_support_tracking_trackingStatus_idx" ON "long_term_support_tracking"("trackingStatus");

CREATE INDEX "institutional_enablement_controls_caseId_idx" ON "institutional_enablement_controls"("caseId");
CREATE INDEX "institutional_enablement_controls_institutionId_idx" ON "institutional_enablement_controls"("institutionId");
CREATE INDEX "institutional_enablement_controls_enablementStatus_idx" ON "institutional_enablement_controls"("enablementStatus");

CREATE INDEX "production_stewardship_manifests_caseId_idx" ON "production_stewardship_manifests"("caseId");
CREATE INDEX "production_stewardship_manifests_stewardshipArea_idx" ON "production_stewardship_manifests"("stewardshipArea");
CREATE INDEX "production_stewardship_manifests_verified_idx" ON "production_stewardship_manifests"("verified");
