-- Phase O.2: Stripe Production Activation + Controlled Billing Validation
-- 10 tables for activation workflows, key rotation, webhook hardening,
-- live rehearsals, institutional onboarding, survivability, state transitions,
-- replay simulations, tier validations, certification manifests.

-- 1. Stripe Activation Workflows
CREATE TABLE "stripe_activation_workflows" (
    "id" TEXT NOT NULL,
    "activationStep" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL DEFAULT 0,
    "stepStatus" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "verifiedBy" TEXT,
    "activationHash" TEXT NOT NULL,
    "activationDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stripe_activation_workflows_pkey" PRIMARY KEY ("id")
);

-- 2. Production Key Rotations
CREATE TABLE "production_key_rotations" (
    "id" TEXT NOT NULL,
    "keyType" TEXT NOT NULL,
    "rotationReason" TEXT NOT NULL,
    "previousKeyHash" TEXT NOT NULL,
    "newKeyHash" TEXT NOT NULL,
    "rotationStatus" TEXT NOT NULL,
    "governanceApproved" BOOLEAN NOT NULL DEFAULT false,
    "rotationDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_key_rotations_pkey" PRIMARY KEY ("id")
);

-- 3. Webhook Endpoint Hardening
CREATE TABLE "webhook_endpoint_hardening" (
    "id" TEXT NOT NULL,
    "endpointUrl" TEXT NOT NULL,
    "hardeningCheck" TEXT NOT NULL,
    "checkStatus" TEXT NOT NULL,
    "hardeningScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hardeningHash" TEXT NOT NULL,
    "hardeningDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_endpoint_hardening_pkey" PRIMARY KEY ("id")
);

-- 4. Live Billing Rehearsals
CREATE TABLE "live_billing_rehearsals" (
    "id" TEXT NOT NULL,
    "rehearsalWorkflow" TEXT NOT NULL,
    "rehearsalOrder" INTEGER NOT NULL DEFAULT 0,
    "inputState" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "actualOutput" TEXT,
    "outputMatch" BOOLEAN NOT NULL DEFAULT false,
    "rehearsalStatus" TEXT NOT NULL,
    "rehearsalHash" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "live_billing_rehearsals_pkey" PRIMARY KEY ("id")
);

-- 5. Institutional Subscription Onboarding
CREATE TABLE "institutional_subscription_onboarding" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "onboardingPhase" TEXT NOT NULL,
    "phaseOrder" INTEGER NOT NULL DEFAULT 0,
    "phaseStatus" TEXT NOT NULL,
    "governanceApproved" BOOLEAN NOT NULL DEFAULT false,
    "onboardingHash" TEXT NOT NULL,
    "onboardingDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "institutional_subscription_onboarding_pkey" PRIMARY KEY ("id")
);

-- 6. Financial Survivability Tests
CREATE TABLE "financial_survivability_tests" (
    "id" TEXT NOT NULL,
    "testScenario" TEXT NOT NULL,
    "injectionType" TEXT NOT NULL,
    "recoveryTimeMs" INTEGER NOT NULL DEFAULT 0,
    "dataIntegrityPreserved" BOOLEAN NOT NULL DEFAULT false,
    "serviceResumed" BOOLEAN NOT NULL DEFAULT false,
    "survivabilityStatus" TEXT NOT NULL,
    "survivabilityHash" TEXT NOT NULL,
    "testDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_survivability_tests_pkey" PRIMARY KEY ("id")
);

-- 7. Billing State Transition Tests
CREATE TABLE "billing_state_transition_tests" (
    "id" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "transitionTrigger" TEXT NOT NULL,
    "transitionValid" BOOLEAN NOT NULL DEFAULT false,
    "deterministicResult" BOOLEAN NOT NULL DEFAULT false,
    "replayVerified" BOOLEAN NOT NULL DEFAULT false,
    "transitionHash" TEXT NOT NULL,
    "transitionDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_state_transition_tests_pkey" PRIMARY KEY ("id")
);

-- 8. Replay Attack Simulations
CREATE TABLE "replay_attack_simulations" (
    "id" TEXT NOT NULL,
    "attackType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "replayCount" INTEGER NOT NULL DEFAULT 0,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyVerified" BOOLEAN NOT NULL DEFAULT false,
    "simulationStatus" TEXT NOT NULL,
    "simulationHash" TEXT NOT NULL,
    "simulationDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "replay_attack_simulations_pkey" PRIMARY KEY ("id")
);

-- 9. Billing Downgrade/Upgrade Validations
CREATE TABLE "billing_downgrade_upgrade_validations" (
    "id" TEXT NOT NULL,
    "transitionType" TEXT NOT NULL,
    "fromTier" TEXT NOT NULL,
    "toTier" TEXT NOT NULL,
    "prorateAmount" INTEGER NOT NULL DEFAULT 0,
    "entitlementsAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "invoiceGenerated" BOOLEAN NOT NULL DEFAULT false,
    "transitionDeterministic" BOOLEAN NOT NULL DEFAULT false,
    "validationHash" TEXT NOT NULL,
    "validationDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_downgrade_upgrade_validations_pkey" PRIMARY KEY ("id")
);

-- 10. Production Billing Certification Manifests
CREATE TABLE "production_billing_certification_manifests" (
    "id" TEXT NOT NULL,
    "certificationArea" TEXT NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "certified" BOOLEAN NOT NULL DEFAULT false,
    "certifiedBy" TEXT,
    "certifiedAt" TEXT,
    "gatesTotal" INTEGER NOT NULL DEFAULT 0,
    "gatesPassed" INTEGER NOT NULL DEFAULT 0,
    "certificationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "manifestDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_billing_certification_manifests_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "stripe_activation_workflows_activationStep_idx" ON "stripe_activation_workflows"("activationStep");
CREATE INDEX "stripe_activation_workflows_stepStatus_idx" ON "stripe_activation_workflows"("stepStatus");
CREATE INDEX "stripe_activation_workflows_environment_idx" ON "stripe_activation_workflows"("environment");

CREATE INDEX "production_key_rotations_keyType_idx" ON "production_key_rotations"("keyType");
CREATE INDEX "production_key_rotations_rotationStatus_idx" ON "production_key_rotations"("rotationStatus");
CREATE INDEX "production_key_rotations_environment_idx" ON "production_key_rotations"("environment");

CREATE INDEX "webhook_endpoint_hardening_hardeningCheck_idx" ON "webhook_endpoint_hardening"("hardeningCheck");
CREATE INDEX "webhook_endpoint_hardening_checkStatus_idx" ON "webhook_endpoint_hardening"("checkStatus");
CREATE INDEX "webhook_endpoint_hardening_environment_idx" ON "webhook_endpoint_hardening"("environment");

CREATE INDEX "live_billing_rehearsals_rehearsalWorkflow_idx" ON "live_billing_rehearsals"("rehearsalWorkflow");
CREATE INDEX "live_billing_rehearsals_rehearsalStatus_idx" ON "live_billing_rehearsals"("rehearsalStatus");
CREATE INDEX "live_billing_rehearsals_environment_idx" ON "live_billing_rehearsals"("environment");

CREATE INDEX "institutional_subscription_onboarding_institutionId_idx" ON "institutional_subscription_onboarding"("institutionId");
CREATE INDEX "institutional_subscription_onboarding_onboardingPhase_idx" ON "institutional_subscription_onboarding"("onboardingPhase");
CREATE INDEX "institutional_subscription_onboarding_environment_idx" ON "institutional_subscription_onboarding"("environment");

CREATE INDEX "financial_survivability_tests_testScenario_idx" ON "financial_survivability_tests"("testScenario");
CREATE INDEX "financial_survivability_tests_survivabilityStatus_idx" ON "financial_survivability_tests"("survivabilityStatus");
CREATE INDEX "financial_survivability_tests_environment_idx" ON "financial_survivability_tests"("environment");

CREATE INDEX "billing_state_transition_tests_fromState_idx" ON "billing_state_transition_tests"("fromState");
CREATE INDEX "billing_state_transition_tests_toState_idx" ON "billing_state_transition_tests"("toState");
CREATE INDEX "billing_state_transition_tests_environment_idx" ON "billing_state_transition_tests"("environment");

CREATE INDEX "replay_attack_simulations_attackType_idx" ON "replay_attack_simulations"("attackType");
CREATE INDEX "replay_attack_simulations_simulationStatus_idx" ON "replay_attack_simulations"("simulationStatus");
CREATE INDEX "replay_attack_simulations_environment_idx" ON "replay_attack_simulations"("environment");

CREATE INDEX "billing_downgrade_upgrade_validations_transitionType_idx" ON "billing_downgrade_upgrade_validations"("transitionType");
CREATE INDEX "billing_downgrade_upgrade_validations_fromTier_idx" ON "billing_downgrade_upgrade_validations"("fromTier");
CREATE INDEX "billing_downgrade_upgrade_validations_environment_idx" ON "billing_downgrade_upgrade_validations"("environment");

CREATE INDEX "production_billing_certification_manifests_certificationArea_idx" ON "production_billing_certification_manifests"("certificationArea");
CREATE INDEX "production_billing_certification_manifests_certified_idx" ON "production_billing_certification_manifests"("certified");
CREATE INDEX "production_billing_certification_manifests_environment_idx" ON "production_billing_certification_manifests"("environment");
