-- Phase I.2: Governance, Compliance, and Institutional Trust Framework
-- 10 tables for governance policies, permission audits, compliance workflows,
-- ethical safeguards, accountability logs, oversight reports, governance controls,
-- exception tracking, policy versioning, and review certifications. Additive only.

-- 1. Governance Policies
CREATE TABLE "governance_policies" (
    "id" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "policyType" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL DEFAULT 1,
    "policyContent" TEXT NOT NULL,
    "enforcementLevel" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveDate" TEXT NOT NULL,
    "expirationDate" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "governance_policies_pkey" PRIMARY KEY ("id")
);

-- 2. Permission Audit Trails
CREATE TABLE "permission_audit_trails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "previousPermission" TEXT,
    "newPermission" TEXT,
    "reason" TEXT,
    "ipAddress" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permission_audit_trails_pkey" PRIMARY KEY ("id")
);

-- 3. Compliance Verification Workflows
CREATE TABLE "compliance_verification_workflows" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "workflowType" TEXT NOT NULL,
    "workflowStatus" TEXT NOT NULL,
    "checksPerformed" TEXT NOT NULL,
    "checksPassed" INTEGER NOT NULL DEFAULT 0,
    "checksFailed" INTEGER NOT NULL DEFAULT 0,
    "assignedTo" TEXT,
    "completedAt" TEXT,
    "findings" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "compliance_verification_workflows_pkey" PRIMARY KEY ("id")
);

-- 4. Ethical Safeguard Enforcements
CREATE TABLE "ethical_safeguard_enforcements" (
    "id" TEXT NOT NULL,
    "safeguardName" TEXT NOT NULL,
    "safeguardType" TEXT NOT NULL,
    "ruleDefinition" TEXT NOT NULL,
    "enforcementResult" TEXT NOT NULL,
    "violationDetails" TEXT,
    "triggerContext" TEXT NOT NULL,
    "remediationAction" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ethical_safeguard_enforcements_pkey" PRIMARY KEY ("id")
);

-- 5. Operational Accountability Logs
CREATE TABLE "operational_accountability_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "operationTarget" TEXT NOT NULL,
    "operationDetails" TEXT NOT NULL,
    "outcomeStatus" TEXT NOT NULL,
    "impactLevel" TEXT NOT NULL,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_accountability_logs_pkey" PRIMARY KEY ("id")
);

-- 6. Institutional Oversight Reports
CREATE TABLE "institutional_oversight_reports" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "reportPeriodStart" TEXT NOT NULL,
    "reportPeriodEnd" TEXT NOT NULL,
    "totalActions" INTEGER NOT NULL DEFAULT 0,
    "totalViolations" INTEGER NOT NULL DEFAULT 0,
    "totalExceptions" INTEGER NOT NULL DEFAULT 0,
    "complianceScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "reportContent" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "institutional_oversight_reports_pkey" PRIMARY KEY ("id")
);

-- 7. Role-Based Governance Controls
CREATE TABLE "role_based_governance_controls" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "controlType" TEXT NOT NULL,
    "resourceScope" TEXT NOT NULL,
    "permissionLevel" TEXT NOT NULL,
    "conditions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastReviewedAt" TEXT,
    "reviewedBy" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_based_governance_controls_pkey" PRIMARY KEY ("id")
);

-- 8. Compliance Exception Tracking
CREATE TABLE "compliance_exception_trackings" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "exceptionType" TEXT NOT NULL,
    "policyId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "justification" TEXT NOT NULL,
    "exceptionStatus" TEXT NOT NULL,
    "validUntil" TEXT,
    "evidenceLinked" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "compliance_exception_trackings_pkey" PRIMARY KEY ("id")
);

-- 9. System Policy Versions
CREATE TABLE "system_policy_versions" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "previousVersionId" TEXT,
    "changeType" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "fullPolicyContent" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    "approvedBy" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_policy_versions_pkey" PRIMARY KEY ("id")
);

-- 10. Governance Review Certifications
CREATE TABLE "governance_review_certifications" (
    "id" TEXT NOT NULL,
    "reviewScope" TEXT NOT NULL,
    "reviewType" TEXT NOT NULL,
    "reviewPeriodStart" TEXT NOT NULL,
    "reviewPeriodEnd" TEXT NOT NULL,
    "totalPoliciesReviewed" INTEGER NOT NULL DEFAULT 0,
    "totalViolationsFound" INTEGER NOT NULL DEFAULT 0,
    "certificationStatus" TEXT NOT NULL,
    "certificationScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "reviewedBy" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "governance_review_certifications_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "governance_policies_policyType_idx" ON "governance_policies"("policyType");
CREATE INDEX "governance_policies_enforcementLevel_idx" ON "governance_policies"("enforcementLevel");
CREATE INDEX "governance_policies_isActive_idx" ON "governance_policies"("isActive");

CREATE INDEX "permission_audit_trails_userId_idx" ON "permission_audit_trails"("userId");
CREATE INDEX "permission_audit_trails_action_idx" ON "permission_audit_trails"("action");
CREATE INDEX "permission_audit_trails_resourceType_idx" ON "permission_audit_trails"("resourceType");

CREATE INDEX "compliance_verification_workflows_caseId_idx" ON "compliance_verification_workflows"("caseId");
CREATE INDEX "compliance_verification_workflows_workflowType_idx" ON "compliance_verification_workflows"("workflowType");
CREATE INDEX "compliance_verification_workflows_workflowStatus_idx" ON "compliance_verification_workflows"("workflowStatus");

CREATE INDEX "ethical_safeguard_enforcements_safeguardType_idx" ON "ethical_safeguard_enforcements"("safeguardType");
CREATE INDEX "ethical_safeguard_enforcements_enforcementResult_idx" ON "ethical_safeguard_enforcements"("enforcementResult");

CREATE INDEX "operational_accountability_logs_actorId_idx" ON "operational_accountability_logs"("actorId");
CREATE INDEX "operational_accountability_logs_operationType_idx" ON "operational_accountability_logs"("operationType");
CREATE INDEX "operational_accountability_logs_outcomeStatus_idx" ON "operational_accountability_logs"("outcomeStatus");

CREATE INDEX "institutional_oversight_reports_reportType_idx" ON "institutional_oversight_reports"("reportType");
CREATE INDEX "institutional_oversight_reports_complianceScore_idx" ON "institutional_oversight_reports"("complianceScore");

CREATE INDEX "role_based_governance_controls_role_idx" ON "role_based_governance_controls"("role");
CREATE INDEX "role_based_governance_controls_controlType_idx" ON "role_based_governance_controls"("controlType");
CREATE INDEX "role_based_governance_controls_isActive_idx" ON "role_based_governance_controls"("isActive");

CREATE INDEX "compliance_exception_trackings_caseId_idx" ON "compliance_exception_trackings"("caseId");
CREATE INDEX "compliance_exception_trackings_exceptionType_idx" ON "compliance_exception_trackings"("exceptionType");
CREATE INDEX "compliance_exception_trackings_exceptionStatus_idx" ON "compliance_exception_trackings"("exceptionStatus");

CREATE INDEX "system_policy_versions_policyId_idx" ON "system_policy_versions"("policyId");
CREATE INDEX "system_policy_versions_versionNumber_idx" ON "system_policy_versions"("versionNumber");
CREATE INDEX "system_policy_versions_changeType_idx" ON "system_policy_versions"("changeType");

CREATE INDEX "governance_review_certifications_reviewScope_idx" ON "governance_review_certifications"("reviewScope");
CREATE INDEX "governance_review_certifications_certificationStatus_idx" ON "governance_review_certifications"("certificationStatus");
CREATE INDEX "governance_review_certifications_reviewType_idx" ON "governance_review_certifications"("reviewType");
