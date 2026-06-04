-- Phase K.1: Institutional Deployment + Controlled Adoption Framework
-- 10 tables for onboarding workflows, tenant isolation, deployment governance,
-- rollout tracking, multi-tenant boundaries, enablement controls, adoption readiness,
-- audit onboarding, environment segregation, organizational certification.

-- 1. Institutional Onboarding Workflows
CREATE TABLE "institutional_onboarding_workflows" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "onboardingStatus" TEXT NOT NULL,
    "stepsCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 8,
    "currentStep" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "completedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "institutional_onboarding_workflows_pkey" PRIMARY KEY ("id")
);

-- 2. Tenant Isolation Records
CREATE TABLE "tenant_isolation_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "isolationLevel" TEXT NOT NULL,
    "dataPartitionHash" TEXT NOT NULL,
    "crossTenantBlocked" BOOLEAN NOT NULL DEFAULT true,
    "isolationVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TEXT,
    "resourceLimits" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_isolation_records_pkey" PRIMARY KEY ("id")
);

-- 3. Deployment Governance Controls
CREATE TABLE "deployment_governance_controls" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "controlType" TEXT NOT NULL,
    "controlScope" TEXT NOT NULL,
    "enforced" BOOLEAN NOT NULL DEFAULT true,
    "authorizedRoles" TEXT NOT NULL,
    "lastModifiedBy" TEXT NOT NULL,
    "effectiveFrom" TEXT NOT NULL,
    "effectiveUntil" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deployment_governance_controls_pkey" PRIMARY KEY ("id")
);

-- 4. Organizational Rollout Trackings
CREATE TABLE "organizational_rollout_trackings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rolloutPhase" TEXT NOT NULL,
    "usersEnabled" INTEGER NOT NULL DEFAULT 0,
    "totalUsers" INTEGER NOT NULL DEFAULT 0,
    "featuresEnabled" TEXT NOT NULL,
    "rolloutPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rolloutStatus" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organizational_rollout_trackings_pkey" PRIMARY KEY ("id")
);

-- 5. Multi-Tenant Integrity Boundaries
CREATE TABLE "multi_tenant_integrity_boundaries" (
    "id" TEXT NOT NULL,
    "sourceTenantId" TEXT NOT NULL,
    "targetTenantId" TEXT NOT NULL,
    "boundaryType" TEXT NOT NULL,
    "boundaryHash" TEXT NOT NULL,
    "crossBoundaryBlocked" BOOLEAN NOT NULL DEFAULT true,
    "breachDetected" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TEXT NOT NULL,
    "verificationMethod" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "multi_tenant_integrity_boundaries_pkey" PRIMARY KEY ("id")
);

-- 6. Operational Enablement Controls
CREATE TABLE "operational_enablement_controls" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "enablementStatus" TEXT NOT NULL,
    "permissionScope" TEXT NOT NULL,
    "requiredPermission" TEXT NOT NULL,
    "enabledBy" TEXT NOT NULL,
    "enabledAt" TEXT NOT NULL,
    "disabledAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_enablement_controls_pkey" PRIMARY KEY ("id")
);

-- 7. Adoption Readiness Verifications
CREATE TABLE "adoption_readiness_verifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "verificationType" TEXT NOT NULL,
    "checksTotal" INTEGER NOT NULL DEFAULT 0,
    "checksPassed" INTEGER NOT NULL DEFAULT 0,
    "checksFailed" INTEGER NOT NULL DEFAULT 0,
    "readinessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "readinessStatus" TEXT NOT NULL,
    "verifiedBy" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "adoption_readiness_verifications_pkey" PRIMARY KEY ("id")
);

-- 8. Institutional Audit Onboardings
CREATE TABLE "institutional_audit_onboardings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "auditPhase" TEXT NOT NULL,
    "auditScope" TEXT NOT NULL,
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "criticalFindings" INTEGER NOT NULL DEFAULT 0,
    "auditResult" TEXT NOT NULL,
    "auditorId" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "institutional_audit_onboardings_pkey" PRIMARY KEY ("id")
);

-- 9. Deployment Environment Segregations
CREATE TABLE "deployment_environment_segregations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environmentName" TEXT NOT NULL,
    "environmentHash" TEXT NOT NULL,
    "isolatedFromOthers" BOOLEAN NOT NULL DEFAULT true,
    "configurationHash" TEXT NOT NULL,
    "lastVerifiedAt" TEXT NOT NULL,
    "driftDetected" BOOLEAN NOT NULL DEFAULT false,
    "resourceAllocation" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deployment_environment_segregations_pkey" PRIMARY KEY ("id")
);

-- 10. Organizational Certification Trackings
CREATE TABLE "organizational_certification_trackings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "certificationScope" TEXT NOT NULL,
    "evidenceRecordsCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedRecordsCount" INTEGER NOT NULL DEFAULT 0,
    "certificationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "certificationStatus" TEXT NOT NULL,
    "certifiedBy" TEXT,
    "certifiedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organizational_certification_trackings_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "institutional_onboarding_workflows_organizationId_idx" ON "institutional_onboarding_workflows"("organizationId");
CREATE INDEX "institutional_onboarding_workflows_onboardingStatus_idx" ON "institutional_onboarding_workflows"("onboardingStatus");

CREATE INDEX "tenant_isolation_records_tenantId_idx" ON "tenant_isolation_records"("tenantId");
CREATE INDEX "tenant_isolation_records_isolationLevel_idx" ON "tenant_isolation_records"("isolationLevel");
CREATE INDEX "tenant_isolation_records_isolationVerified_idx" ON "tenant_isolation_records"("isolationVerified");

CREATE INDEX "deployment_governance_controls_organizationId_idx" ON "deployment_governance_controls"("organizationId");
CREATE INDEX "deployment_governance_controls_controlType_idx" ON "deployment_governance_controls"("controlType");
CREATE INDEX "deployment_governance_controls_enforced_idx" ON "deployment_governance_controls"("enforced");

CREATE INDEX "organizational_rollout_trackings_organizationId_idx" ON "organizational_rollout_trackings"("organizationId");
CREATE INDEX "organizational_rollout_trackings_rolloutPhase_idx" ON "organizational_rollout_trackings"("rolloutPhase");
CREATE INDEX "organizational_rollout_trackings_rolloutStatus_idx" ON "organizational_rollout_trackings"("rolloutStatus");

CREATE INDEX "multi_tenant_integrity_boundaries_sourceTenantId_idx" ON "multi_tenant_integrity_boundaries"("sourceTenantId");
CREATE INDEX "multi_tenant_integrity_boundaries_targetTenantId_idx" ON "multi_tenant_integrity_boundaries"("targetTenantId");
CREATE INDEX "multi_tenant_integrity_boundaries_breachDetected_idx" ON "multi_tenant_integrity_boundaries"("breachDetected");

CREATE INDEX "operational_enablement_controls_organizationId_idx" ON "operational_enablement_controls"("organizationId");
CREATE INDEX "operational_enablement_controls_featureName_idx" ON "operational_enablement_controls"("featureName");
CREATE INDEX "operational_enablement_controls_enablementStatus_idx" ON "operational_enablement_controls"("enablementStatus");

CREATE INDEX "adoption_readiness_verifications_organizationId_idx" ON "adoption_readiness_verifications"("organizationId");
CREATE INDEX "adoption_readiness_verifications_verificationType_idx" ON "adoption_readiness_verifications"("verificationType");
CREATE INDEX "adoption_readiness_verifications_readinessStatus_idx" ON "adoption_readiness_verifications"("readinessStatus");

CREATE INDEX "institutional_audit_onboardings_organizationId_idx" ON "institutional_audit_onboardings"("organizationId");
CREATE INDEX "institutional_audit_onboardings_auditPhase_idx" ON "institutional_audit_onboardings"("auditPhase");
CREATE INDEX "institutional_audit_onboardings_auditResult_idx" ON "institutional_audit_onboardings"("auditResult");

CREATE INDEX "deployment_environment_segregations_organizationId_idx" ON "deployment_environment_segregations"("organizationId");
CREATE INDEX "deployment_environment_segregations_environmentName_idx" ON "deployment_environment_segregations"("environmentName");
CREATE INDEX "deployment_environment_segregations_driftDetected_idx" ON "deployment_environment_segregations"("driftDetected");

CREATE INDEX "organizational_certification_trackings_organizationId_idx" ON "organizational_certification_trackings"("organizationId");
CREATE INDEX "organizational_certification_trackings_certificationScope_idx" ON "organizational_certification_trackings"("certificationScope");
CREATE INDEX "organizational_certification_trackings_certificationStatus_idx" ON "organizational_certification_trackings"("certificationStatus");
