-- Phase P.2: Enterprise Scale Operations + Customer Success Governance
-- 10 tables for autoscaling, customer success, elasticity, multi-tenant,
-- capacity planning, large deployment, observability, cost, scale cert, stewardship.

-- 1. Enterprise Autoscaling Governance
CREATE TABLE "enterprise_autoscaling_governance" (
    "id" TEXT NOT NULL,
    "scalingResource" TEXT NOT NULL,
    "currentCapacity" INTEGER NOT NULL DEFAULT 0,
    "targetCapacity" INTEGER NOT NULL DEFAULT 0,
    "scalingTrigger" TEXT NOT NULL,
    "scalingStatus" TEXT NOT NULL,
    "governanceApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "scalingHash" TEXT NOT NULL,
    "scalingDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "enterprise_autoscaling_governance_pkey" PRIMARY KEY ("id")
);

-- 2. Customer Success Operations
CREATE TABLE "customer_success_operations" (
    "id" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "operationStatus" TEXT NOT NULL,
    "governanceApproved" BOOLEAN NOT NULL DEFAULT false,
    "operationHash" TEXT NOT NULL,
    "operationDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_success_operations_pkey" PRIMARY KEY ("id")
);

-- 3. Infrastructure Elasticity Tests
CREATE TABLE "infrastructure_elasticity_tests" (
    "id" TEXT NOT NULL,
    "elasticityScenario" TEXT NOT NULL,
    "baselineCapacity" INTEGER NOT NULL DEFAULT 0,
    "peakCapacity" INTEGER NOT NULL DEFAULT 0,
    "scaleUpTimeMs" INTEGER NOT NULL DEFAULT 0,
    "scaleDownTimeMs" INTEGER NOT NULL DEFAULT 0,
    "dataIntegrity" BOOLEAN NOT NULL DEFAULT true,
    "elasticityStatus" TEXT NOT NULL,
    "elasticityHash" TEXT NOT NULL,
    "elasticityDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "infrastructure_elasticity_tests_pkey" PRIMARY KEY ("id")
);

-- 4. Multi-Tenant Scale Survivability
CREATE TABLE "multi_tenant_scale_survivability" (
    "id" TEXT NOT NULL,
    "tenantCount" INTEGER NOT NULL DEFAULT 0,
    "concurrentUsers" INTEGER NOT NULL DEFAULT 0,
    "survivabilityMetric" TEXT NOT NULL,
    "metricScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceLink" TEXT NOT NULL,
    "survivabilityStatus" TEXT NOT NULL,
    "survivabilityHash" TEXT NOT NULL,
    "survivabilityDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "multi_tenant_scale_survivability_pkey" PRIMARY KEY ("id")
);

-- 5. Capacity Planning Orchestrations
CREATE TABLE "capacity_planning_orchestrations" (
    "id" TEXT NOT NULL,
    "planningDomain" TEXT NOT NULL,
    "currentUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "projectedUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capacityCeiling" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "headroomPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "planningHorizon" TEXT NOT NULL,
    "planningStatus" TEXT NOT NULL,
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "planningHash" TEXT NOT NULL,
    "planningDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "capacity_planning_orchestrations_pkey" PRIMARY KEY ("id")
);

-- 6. Large Deployment Onboarding
CREATE TABLE "large_deployment_onboarding" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "deploymentSize" TEXT NOT NULL,
    "onboardingPhase" TEXT NOT NULL,
    "phaseOrder" INTEGER NOT NULL DEFAULT 0,
    "phaseStatus" TEXT NOT NULL,
    "seatCount" INTEGER NOT NULL DEFAULT 0,
    "onboardingHash" TEXT NOT NULL,
    "onboardingDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "large_deployment_onboarding_pkey" PRIMARY KEY ("id")
);

-- 7. Enterprise Observability Refinements
CREATE TABLE "enterprise_observability_refinements" (
    "id" TEXT NOT NULL,
    "observabilityDomain" TEXT NOT NULL,
    "refinementAction" TEXT NOT NULL,
    "beforeValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "afterValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "improvementPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refinementStatus" TEXT NOT NULL,
    "refinementHash" TEXT NOT NULL,
    "refinementDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "enterprise_observability_refinements_pkey" PRIMARY KEY ("id")
);

-- 8. Operational Cost Governance
CREATE TABLE "operational_cost_governance" (
    "id" TEXT NOT NULL,
    "costCategory" TEXT NOT NULL,
    "monthlyBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerUser" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costStatus" TEXT NOT NULL,
    "costHash" TEXT NOT NULL,
    "costDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_cost_governance_pkey" PRIMARY KEY ("id")
);

-- 9. Scale Certification Manifests
CREATE TABLE "scale_certification_manifests" (
    "id" TEXT NOT NULL,
    "certificationDomain" TEXT NOT NULL,
    "maxTestedLoad" INTEGER NOT NULL DEFAULT 0,
    "targetLoad" INTEGER NOT NULL DEFAULT 0,
    "scalingFactor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "certificationStatus" TEXT NOT NULL,
    "certifiedBy" TEXT,
    "certificationHash" TEXT NOT NULL,
    "certificationDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scale_certification_manifests_pkey" PRIMARY KEY ("id")
);

-- 10. Long-Term Stewardship Operations
CREATE TABLE "long_term_stewardship_operations" (
    "id" TEXT NOT NULL,
    "stewardshipDomain" TEXT NOT NULL,
    "operationCycle" TEXT NOT NULL,
    "lastCompletedDate" TEXT NOT NULL,
    "nextScheduledDate" TEXT NOT NULL,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stewardshipStatus" TEXT NOT NULL,
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "stewardshipHash" TEXT NOT NULL,
    "stewardshipDetails" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "long_term_stewardship_operations_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "enterprise_autoscaling_governance_scalingResource_idx" ON "enterprise_autoscaling_governance"("scalingResource");
CREATE INDEX "enterprise_autoscaling_governance_scalingStatus_idx" ON "enterprise_autoscaling_governance"("scalingStatus");
CREATE INDEX "enterprise_autoscaling_governance_environment_idx" ON "enterprise_autoscaling_governance"("environment");

CREATE INDEX "customer_success_operations_operationType_idx" ON "customer_success_operations"("operationType");
CREATE INDEX "customer_success_operations_operationStatus_idx" ON "customer_success_operations"("operationStatus");
CREATE INDEX "customer_success_operations_environment_idx" ON "customer_success_operations"("environment");

CREATE INDEX "infrastructure_elasticity_tests_elasticityScenario_idx" ON "infrastructure_elasticity_tests"("elasticityScenario");
CREATE INDEX "infrastructure_elasticity_tests_elasticityStatus_idx" ON "infrastructure_elasticity_tests"("elasticityStatus");
CREATE INDEX "infrastructure_elasticity_tests_environment_idx" ON "infrastructure_elasticity_tests"("environment");

CREATE INDEX "multi_tenant_scale_survivability_survivabilityMetric_idx" ON "multi_tenant_scale_survivability"("survivabilityMetric");
CREATE INDEX "multi_tenant_scale_survivability_survivabilityStatus_idx" ON "multi_tenant_scale_survivability"("survivabilityStatus");
CREATE INDEX "multi_tenant_scale_survivability_environment_idx" ON "multi_tenant_scale_survivability"("environment");

CREATE INDEX "capacity_planning_orchestrations_planningDomain_idx" ON "capacity_planning_orchestrations"("planningDomain");
CREATE INDEX "capacity_planning_orchestrations_planningStatus_idx" ON "capacity_planning_orchestrations"("planningStatus");
CREATE INDEX "capacity_planning_orchestrations_environment_idx" ON "capacity_planning_orchestrations"("environment");

CREATE INDEX "large_deployment_onboarding_deploymentId_idx" ON "large_deployment_onboarding"("deploymentId");
CREATE INDEX "large_deployment_onboarding_onboardingPhase_idx" ON "large_deployment_onboarding"("onboardingPhase");
CREATE INDEX "large_deployment_onboarding_environment_idx" ON "large_deployment_onboarding"("environment");

CREATE INDEX "enterprise_observability_refinements_observabilityDomain_idx" ON "enterprise_observability_refinements"("observabilityDomain");
CREATE INDEX "enterprise_observability_refinements_refinementStatus_idx" ON "enterprise_observability_refinements"("refinementStatus");
CREATE INDEX "enterprise_observability_refinements_environment_idx" ON "enterprise_observability_refinements"("environment");

CREATE INDEX "operational_cost_governance_costCategory_idx" ON "operational_cost_governance"("costCategory");
CREATE INDEX "operational_cost_governance_costStatus_idx" ON "operational_cost_governance"("costStatus");
CREATE INDEX "operational_cost_governance_environment_idx" ON "operational_cost_governance"("environment");

CREATE INDEX "scale_certification_manifests_certificationDomain_idx" ON "scale_certification_manifests"("certificationDomain");
CREATE INDEX "scale_certification_manifests_certificationStatus_idx" ON "scale_certification_manifests"("certificationStatus");
CREATE INDEX "scale_certification_manifests_environment_idx" ON "scale_certification_manifests"("environment");

CREATE INDEX "long_term_stewardship_operations_stewardshipDomain_idx" ON "long_term_stewardship_operations"("stewardshipDomain");
CREATE INDEX "long_term_stewardship_operations_stewardshipStatus_idx" ON "long_term_stewardship_operations"("stewardshipStatus");
CREATE INDEX "long_term_stewardship_operations_environment_idx" ON "long_term_stewardship_operations"("environment");
