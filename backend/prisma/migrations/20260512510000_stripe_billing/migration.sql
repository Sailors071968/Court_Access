-- Phase O.1: Stripe Production Billing + Subscription Operations
-- 10 tables for webhook events, subscription lifecycle, institutional billing,
-- entitlements, onboarding, failed-payment recovery, audit logs, invoices,
-- revenue metrics, billing certification.

-- 1. Stripe Production Webhook Events
CREATE TABLE "stripe_production_webhook_events" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT,
    "replayProtected" BOOLEAN NOT NULL DEFAULT false,
    "processingStatus" TEXT NOT NULL,
    "eventPayload" TEXT NOT NULL,
    "eventHash" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stripe_production_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stripe_production_webhook_events_stripeEventId_key" ON "stripe_production_webhook_events"("stripeEventId");

-- 2. Subscription Lifecycles
CREATE TABLE "subscription_lifecycles" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "planType" TEXT NOT NULL,
    "planTier" TEXT NOT NULL,
    "seatCount" INTEGER NOT NULL DEFAULT 1,
    "usageCap" INTEGER NOT NULL DEFAULT 0,
    "lifecycleStatus" TEXT NOT NULL,
    "previousStatus" TEXT,
    "stateTransitionHash" TEXT NOT NULL,
    "lifecycleDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscription_lifecycles_pkey" PRIMARY KEY ("id")
);

-- 3. Institutional Billing Workflows
CREATE TABLE "institutional_billing_workflows" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "billingPhase" TEXT NOT NULL,
    "contractValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seatsPurchased" INTEGER NOT NULL DEFAULT 0,
    "governanceApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "billingHash" TEXT NOT NULL,
    "billingDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "institutional_billing_workflows_pkey" PRIMARY KEY ("id")
);

-- 4. Usage Tier Entitlements
CREATE TABLE "usage_tier_entitlements" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "tierRequired" TEXT NOT NULL,
    "currentTier" TEXT NOT NULL,
    "entitled" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "usageLimit" INTEGER NOT NULL DEFAULT 0,
    "entitlementHash" TEXT NOT NULL,
    "entitlementDetails" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usage_tier_entitlements_pkey" PRIMARY KEY ("id")
);

-- 5. Customer Onboarding Billing
CREATE TABLE "customer_onboarding_billing" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "onboardingStep" TEXT NOT NULL,
    "stepStatus" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL DEFAULT 0,
    "stripeSessionId" TEXT,
    "onboardingHash" TEXT NOT NULL,
    "onboardingDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_onboarding_billing_pkey" PRIMARY KEY ("id")
);

-- 6. Failed Payment Recoveries
CREATE TABLE "failed_payment_recoveries" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "failureReason" TEXT NOT NULL,
    "recoveryAction" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "recoveryStatus" TEXT NOT NULL,
    "recoveryHash" TEXT NOT NULL,
    "recoveryDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "failed_payment_recoveries_pkey" PRIMARY KEY ("id")
);

-- 7. Billing Audit Logs
CREATE TABLE "billing_audit_logs" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionDetails" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT,
    "auditHash" TEXT NOT NULL,
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_audit_logs_pkey" PRIMARY KEY ("id")
);

-- 8. Invoice Records
CREATE TABLE "invoice_records" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceType" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "invoiceStatus" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "invoiceHash" TEXT NOT NULL,
    "invoiceDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_records_pkey" PRIMARY KEY ("id")
);

-- 9. Revenue Metrics
CREATE TABLE "revenue_metrics" (
    "id" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "customerCount" INTEGER NOT NULL DEFAULT 0,
    "metricStatus" TEXT NOT NULL,
    "metricHash" TEXT NOT NULL,
    "metricDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "revenue_metrics_pkey" PRIMARY KEY ("id")
);

-- 10. Billing Operations Certifications
CREATE TABLE "billing_operations_certifications" (
    "id" TEXT NOT NULL,
    "certificationArea" TEXT NOT NULL,
    "certificationHash" TEXT NOT NULL,
    "certified" BOOLEAN NOT NULL DEFAULT false,
    "certifiedBy" TEXT,
    "certifiedAt" TEXT,
    "certificationDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_operations_certifications_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "stripe_production_webhook_events_stripeEventId_idx" ON "stripe_production_webhook_events"("stripeEventId");
CREATE INDEX "stripe_production_webhook_events_eventType_idx" ON "stripe_production_webhook_events"("eventType");
CREATE INDEX "stripe_production_webhook_events_processingStatus_idx" ON "stripe_production_webhook_events"("processingStatus");

CREATE INDEX "subscription_lifecycles_customerId_idx" ON "subscription_lifecycles"("customerId");
CREATE INDEX "subscription_lifecycles_lifecycleStatus_idx" ON "subscription_lifecycles"("lifecycleStatus");
CREATE INDEX "subscription_lifecycles_environment_idx" ON "subscription_lifecycles"("environment");

CREATE INDEX "institutional_billing_workflows_institutionId_idx" ON "institutional_billing_workflows"("institutionId");
CREATE INDEX "institutional_billing_workflows_billingPhase_idx" ON "institutional_billing_workflows"("billingPhase");
CREATE INDEX "institutional_billing_workflows_environment_idx" ON "institutional_billing_workflows"("environment");

CREATE INDEX "usage_tier_entitlements_customerId_idx" ON "usage_tier_entitlements"("customerId");
CREATE INDEX "usage_tier_entitlements_featureName_idx" ON "usage_tier_entitlements"("featureName");
CREATE INDEX "usage_tier_entitlements_entitled_idx" ON "usage_tier_entitlements"("entitled");

CREATE INDEX "customer_onboarding_billing_customerId_idx" ON "customer_onboarding_billing"("customerId");
CREATE INDEX "customer_onboarding_billing_onboardingStep_idx" ON "customer_onboarding_billing"("onboardingStep");
CREATE INDEX "customer_onboarding_billing_stepStatus_idx" ON "customer_onboarding_billing"("stepStatus");

CREATE INDEX "failed_payment_recoveries_customerId_idx" ON "failed_payment_recoveries"("customerId");
CREATE INDEX "failed_payment_recoveries_recoveryStatus_idx" ON "failed_payment_recoveries"("recoveryStatus");
CREATE INDEX "failed_payment_recoveries_environment_idx" ON "failed_payment_recoveries"("environment");

CREATE INDEX "billing_audit_logs_customerId_idx" ON "billing_audit_logs"("customerId");
CREATE INDEX "billing_audit_logs_actionType_idx" ON "billing_audit_logs"("actionType");
CREATE INDEX "billing_audit_logs_environment_idx" ON "billing_audit_logs"("environment");

CREATE INDEX "invoice_records_customerId_idx" ON "invoice_records"("customerId");
CREATE INDEX "invoice_records_invoiceStatus_idx" ON "invoice_records"("invoiceStatus");
CREATE INDEX "invoice_records_environment_idx" ON "invoice_records"("environment");

CREATE INDEX "revenue_metrics_metricType_idx" ON "revenue_metrics"("metricType");
CREATE INDEX "revenue_metrics_metricStatus_idx" ON "revenue_metrics"("metricStatus");
CREATE INDEX "revenue_metrics_environment_idx" ON "revenue_metrics"("environment");

CREATE INDEX "billing_operations_certifications_certificationArea_idx" ON "billing_operations_certifications"("certificationArea");
CREATE INDEX "billing_operations_certifications_certified_idx" ON "billing_operations_certifications"("certified");
CREATE INDEX "billing_operations_certifications_environment_idx" ON "billing_operations_certifications"("environment");
