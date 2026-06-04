-- Phase O.3: Controlled LIVE Billing Enablement + Revenue Operations Governance
-- 10 tables for LIVE activation governance, billing monitoring, revenue ops,
-- incident response, webhook observability, institutional onboarding,
-- revenue certification, rollback governance, support escalation, stewardship.

-- 1. LIVE Stripe Activation Governance
CREATE TABLE "live_stripe_activation_governance" (
    "id" TEXT NOT NULL,
    "activationGate" TEXT NOT NULL,
    "gateOrder" INTEGER NOT NULL DEFAULT 0,
    "gateStatus" TEXT NOT NULL,
    "previousWarnings" TEXT NOT NULL,
    "resolutionEvidence" TEXT NOT NULL,
    "governanceApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "activationHash" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "live_stripe_activation_governance_pkey" PRIMARY KEY ("id")
);

-- 2. Production Billing Monitors
CREATE TABLE "production_billing_monitors" (
    "id" TEXT NOT NULL,
    "monitorDomain" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thresholdWarning" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thresholdCritical" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monitorStatus" TEXT NOT NULL,
    "alertsSent" INTEGER NOT NULL DEFAULT 0,
    "monitorHash" TEXT NOT NULL,
    "monitorDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_billing_monitors_pkey" PRIMARY KEY ("id")
);

-- 3. Revenue Operations Workflows
CREATE TABLE "revenue_operations_workflows" (
    "id" TEXT NOT NULL,
    "workflowType" TEXT NOT NULL,
    "workflowStatus" TEXT NOT NULL,
    "inputData" TEXT NOT NULL,
    "outputData" TEXT,
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "workflowHash" TEXT NOT NULL,
    "workflowDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "revenue_operations_workflows_pkey" PRIMARY KEY ("id")
);

-- 4. Billing Incident Responses
CREATE TABLE "billing_incident_responses" (
    "id" TEXT NOT NULL,
    "incidentType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "detectedAt" TEXT NOT NULL,
    "resolvedAt" TEXT,
    "responseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "rootCause" TEXT,
    "resolutionAction" TEXT,
    "incidentHash" TEXT NOT NULL,
    "incidentDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_incident_responses_pkey" PRIMARY KEY ("id")
);

-- 5. LIVE Webhook Observability
CREATE TABLE "live_webhook_observability" (
    "id" TEXT NOT NULL,
    "webhookEndpoint" TEXT NOT NULL,
    "observabilityMetric" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metricUnit" TEXT NOT NULL,
    "observabilityStatus" TEXT NOT NULL,
    "observabilityHash" TEXT NOT NULL,
    "observabilityDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "live_webhook_observability_pkey" PRIMARY KEY ("id")
);

-- 6. Institutional Customer Onboarding
CREATE TABLE "institutional_customer_onboarding" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "onboardingMilestone" TEXT NOT NULL,
    "milestoneOrder" INTEGER NOT NULL DEFAULT 0,
    "milestoneStatus" TEXT NOT NULL,
    "governanceApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "onboardingHash" TEXT NOT NULL,
    "onboardingDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "institutional_customer_onboarding_pkey" PRIMARY KEY ("id")
);

-- 7. Production Revenue Certifications
CREATE TABLE "production_revenue_certifications" (
    "id" TEXT NOT NULL,
    "certificationDomain" TEXT NOT NULL,
    "auditPeriodStart" TEXT NOT NULL,
    "auditPeriodEnd" TEXT NOT NULL,
    "revenueAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discrepancyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "certificationStatus" TEXT NOT NULL,
    "certifiedBy" TEXT,
    "certificationHash" TEXT NOT NULL,
    "certificationDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_revenue_certifications_pkey" PRIMARY KEY ("id")
);

-- 8. Financial Rollback Governance
CREATE TABLE "financial_rollback_governance" (
    "id" TEXT NOT NULL,
    "rollbackTrigger" TEXT NOT NULL,
    "rollbackScope" TEXT NOT NULL,
    "rollbackSteps" INTEGER NOT NULL DEFAULT 0,
    "stepsCompleted" INTEGER NOT NULL DEFAULT 0,
    "dataIntegrityVerified" BOOLEAN NOT NULL DEFAULT false,
    "rollbackStatus" TEXT NOT NULL,
    "rollbackHash" TEXT NOT NULL,
    "rollbackDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_rollback_governance_pkey" PRIMARY KEY ("id")
);

-- 9. Operational Support Escalations
CREATE TABLE "operational_support_escalations" (
    "id" TEXT NOT NULL,
    "escalationType" TEXT NOT NULL,
    "escalationSeverity" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "escalationStatus" TEXT NOT NULL,
    "assignedTo" TEXT,
    "resolutionSummary" TEXT,
    "slaTargetMs" INTEGER NOT NULL DEFAULT 0,
    "slaMetMs" INTEGER NOT NULL DEFAULT 0,
    "escalationHash" TEXT NOT NULL,
    "escalationDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_support_escalations_pkey" PRIMARY KEY ("id")
);

-- 10. Revenue Stewardship Manifests
CREATE TABLE "revenue_stewardship_manifests" (
    "id" TEXT NOT NULL,
    "stewardshipArea" TEXT NOT NULL,
    "stewardshipLevel" TEXT NOT NULL,
    "lastAuditDate" TEXT NOT NULL,
    "nextAuditDate" TEXT NOT NULL,
    "stewardshipScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "manifestHash" TEXT NOT NULL,
    "manifestDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "revenue_stewardship_manifests_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "live_stripe_activation_governance_activationGate_idx" ON "live_stripe_activation_governance"("activationGate");
CREATE INDEX "live_stripe_activation_governance_gateStatus_idx" ON "live_stripe_activation_governance"("gateStatus");
CREATE INDEX "live_stripe_activation_governance_environment_idx" ON "live_stripe_activation_governance"("environment");

CREATE INDEX "production_billing_monitors_monitorDomain_idx" ON "production_billing_monitors"("monitorDomain");
CREATE INDEX "production_billing_monitors_monitorStatus_idx" ON "production_billing_monitors"("monitorStatus");
CREATE INDEX "production_billing_monitors_environment_idx" ON "production_billing_monitors"("environment");

CREATE INDEX "revenue_operations_workflows_workflowType_idx" ON "revenue_operations_workflows"("workflowType");
CREATE INDEX "revenue_operations_workflows_workflowStatus_idx" ON "revenue_operations_workflows"("workflowStatus");
CREATE INDEX "revenue_operations_workflows_environment_idx" ON "revenue_operations_workflows"("environment");

CREATE INDEX "billing_incident_responses_incidentType_idx" ON "billing_incident_responses"("incidentType");
CREATE INDEX "billing_incident_responses_severity_idx" ON "billing_incident_responses"("severity");
CREATE INDEX "billing_incident_responses_environment_idx" ON "billing_incident_responses"("environment");

CREATE INDEX "live_webhook_observability_observabilityMetric_idx" ON "live_webhook_observability"("observabilityMetric");
CREATE INDEX "live_webhook_observability_observabilityStatus_idx" ON "live_webhook_observability"("observabilityStatus");
CREATE INDEX "live_webhook_observability_environment_idx" ON "live_webhook_observability"("environment");

CREATE INDEX "institutional_customer_onboarding_institutionId_idx" ON "institutional_customer_onboarding"("institutionId");
CREATE INDEX "institutional_customer_onboarding_onboardingMilestone_idx" ON "institutional_customer_onboarding"("onboardingMilestone");
CREATE INDEX "institutional_customer_onboarding_environment_idx" ON "institutional_customer_onboarding"("environment");

CREATE INDEX "production_revenue_certifications_certificationDomain_idx" ON "production_revenue_certifications"("certificationDomain");
CREATE INDEX "production_revenue_certifications_certificationStatus_idx" ON "production_revenue_certifications"("certificationStatus");
CREATE INDEX "production_revenue_certifications_environment_idx" ON "production_revenue_certifications"("environment");

CREATE INDEX "financial_rollback_governance_rollbackTrigger_idx" ON "financial_rollback_governance"("rollbackTrigger");
CREATE INDEX "financial_rollback_governance_rollbackStatus_idx" ON "financial_rollback_governance"("rollbackStatus");
CREATE INDEX "financial_rollback_governance_environment_idx" ON "financial_rollback_governance"("environment");

CREATE INDEX "operational_support_escalations_escalationType_idx" ON "operational_support_escalations"("escalationType");
CREATE INDEX "operational_support_escalations_escalationStatus_idx" ON "operational_support_escalations"("escalationStatus");
CREATE INDEX "operational_support_escalations_environment_idx" ON "operational_support_escalations"("environment");

CREATE INDEX "revenue_stewardship_manifests_stewardshipArea_idx" ON "revenue_stewardship_manifests"("stewardshipArea");
CREATE INDEX "revenue_stewardship_manifests_stewardshipLevel_idx" ON "revenue_stewardship_manifests"("stewardshipLevel");
CREATE INDEX "revenue_stewardship_manifests_environment_idx" ON "revenue_stewardship_manifests"("environment");
