-- Phase E.3: Sentencing Intelligence Framework
-- 10 tables for sentencing exposure, enhancements, probation, mitigation, aggravation,
-- strikes/priors, custody credits, judicial ruling trends, plea consequences.
-- Additive only — no existing tables modified.

-- 1. Sentencing Exposure
CREATE TABLE "sentencing_exposures" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "chargeId" TEXT,
    "chargeDescription" TEXT NOT NULL,
    "penalCodeSection" TEXT NOT NULL,
    "offenseCategory" TEXT NOT NULL,
    "baseTerm" TEXT NOT NULL,
    "baseTermMonthsLow" INTEGER NOT NULL DEFAULT 0,
    "baseTermMonthsHigh" INTEGER NOT NULL DEFAULT 0,
    "presumptiveTerm" TEXT,
    "enhancementsApplied" TEXT NOT NULL,
    "totalExposureMonthsLow" INTEGER NOT NULL DEFAULT 0,
    "totalExposureMonthsHigh" INTEGER NOT NULL DEFAULT 0,
    "lifePossible" BOOLEAN NOT NULL DEFAULT false,
    "lwopPossible" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentencing_exposures_pkey" PRIMARY KEY ("id")
);

-- 2. Enhancement Stacking
CREATE TABLE "enhancement_stackings" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "enhancementType" TEXT NOT NULL,
    "penalCodeSection" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "additionalMonths" INTEGER NOT NULL DEFAULT 0,
    "additionalYears" INTEGER NOT NULL DEFAULT 0,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "strikeable" BOOLEAN NOT NULL DEFAULT false,
    "appliedToChargeId" TEXT,
    "stackingOrder" INTEGER NOT NULL DEFAULT 1,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enhancement_stackings_pkey" PRIMARY KEY ("id")
);

-- 3. Consecutive/Concurrent Exposure
CREATE TABLE "consecutive_concurrent_exposures" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "chargeAId" TEXT,
    "chargeBId" TEXT,
    "chargeADescription" TEXT NOT NULL,
    "chargeBDescription" TEXT NOT NULL,
    "runType" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "subordinateTermRule" TEXT,
    "totalCombinedMonths" INTEGER NOT NULL DEFAULT 0,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consecutive_concurrent_exposures_pkey" PRIMARY KEY ("id")
);

-- 4. Probation Eligibility
CREATE TABLE "probation_eligibilities" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "chargeId" TEXT,
    "chargeDescription" TEXT NOT NULL,
    "eligibleForProbation" BOOLEAN NOT NULL DEFAULT false,
    "presumptiveProbation" BOOLEAN NOT NULL DEFAULT false,
    "statutoryBar" TEXT,
    "unusualCircumstances" BOOLEAN NOT NULL DEFAULT false,
    "conditions" TEXT NOT NULL,
    "maxProbationYears" INTEGER NOT NULL DEFAULT 0,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "probation_eligibilities_pkey" PRIMARY KEY ("id")
);

-- 5. Mitigation Factor
CREATE TABLE "mitigation_factors" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "factorType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "supportingEvidence" TEXT NOT NULL,
    "sentencingImpact" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mitigation_factors_pkey" PRIMARY KEY ("id")
);

-- 6. Aggravation Factor
CREATE TABLE "aggravation_factors" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "factorType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "supportingEvidence" TEXT NOT NULL,
    "sentencingImpact" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aggravation_factors_pkey" PRIMARY KEY ("id")
);

-- 7. Strike/Prior Analysis
CREATE TABLE "strike_prior_analyses" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "priorType" TEXT NOT NULL,
    "priorDescription" TEXT NOT NULL,
    "penalCodeSection" TEXT NOT NULL,
    "qualifiesAsStrike" BOOLEAN NOT NULL DEFAULT false,
    "secondStrikeDoubling" BOOLEAN NOT NULL DEFAULT false,
    "thirdStrike25ToLife" BOOLEAN NOT NULL DEFAULT false,
    "romeroMotionViable" BOOLEAN NOT NULL DEFAULT false,
    "washoutPeriod" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strike_prior_analyses_pkey" PRIMARY KEY ("id")
);

-- 8. Custody Credit
CREATE TABLE "custody_credits" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actualDays" INTEGER NOT NULL DEFAULT 0,
    "conductCredits" INTEGER NOT NULL DEFAULT 0,
    "creditRate" TEXT NOT NULL,
    "creditLimitation" TEXT,
    "totalCredits" INTEGER NOT NULL DEFAULT 0,
    "applicableStatute" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custody_credits_pkey" PRIMARY KEY ("id")
);

-- 9. Judicial Ruling Trend
CREATE TABLE "judicial_ruling_trends" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "rulingCategory" TEXT NOT NULL,
    "rulingType" TEXT NOT NULL,
    "legalIssue" TEXT NOT NULL,
    "aggregatePattern" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "judicial_ruling_trends_pkey" PRIMARY KEY ("id")
);

-- 10. Plea Consequence
CREATE TABLE "plea_consequences" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "chargeId" TEXT,
    "chargeDescription" TEXT NOT NULL,
    "pleaType" TEXT NOT NULL,
    "sentencingExposure" TEXT NOT NULL,
    "immigrationConsequence" TEXT,
    "licensingConsequence" TEXT,
    "firearmRestriction" BOOLEAN NOT NULL DEFAULT false,
    "sexRegistration" BOOLEAN NOT NULL DEFAULT false,
    "strikeConsequence" BOOLEAN NOT NULL DEFAULT false,
    "probationLikelihood" TEXT,
    "restitutionExposure" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plea_consequences_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "sentencing_exposures_caseId_idx" ON "sentencing_exposures"("caseId");
CREATE INDEX "sentencing_exposures_penalCodeSection_idx" ON "sentencing_exposures"("penalCodeSection");

CREATE INDEX "enhancement_stackings_caseId_idx" ON "enhancement_stackings"("caseId");
CREATE INDEX "enhancement_stackings_enhancementType_idx" ON "enhancement_stackings"("enhancementType");

CREATE INDEX "consecutive_concurrent_exposures_caseId_idx" ON "consecutive_concurrent_exposures"("caseId");
CREATE INDEX "consecutive_concurrent_exposures_runType_idx" ON "consecutive_concurrent_exposures"("runType");

CREATE INDEX "probation_eligibilities_caseId_idx" ON "probation_eligibilities"("caseId");
CREATE INDEX "probation_eligibilities_eligibleForProbation_idx" ON "probation_eligibilities"("eligibleForProbation");

CREATE INDEX "mitigation_factors_caseId_idx" ON "mitigation_factors"("caseId");
CREATE INDEX "mitigation_factors_factorType_idx" ON "mitigation_factors"("factorType");
CREATE INDEX "mitigation_factors_strength_idx" ON "mitigation_factors"("strength");

CREATE INDEX "aggravation_factors_caseId_idx" ON "aggravation_factors"("caseId");
CREATE INDEX "aggravation_factors_factorType_idx" ON "aggravation_factors"("factorType");
CREATE INDEX "aggravation_factors_strength_idx" ON "aggravation_factors"("strength");

CREATE INDEX "strike_prior_analyses_caseId_idx" ON "strike_prior_analyses"("caseId");
CREATE INDEX "strike_prior_analyses_priorType_idx" ON "strike_prior_analyses"("priorType");
CREATE INDEX "strike_prior_analyses_qualifiesAsStrike_idx" ON "strike_prior_analyses"("qualifiesAsStrike");

CREATE INDEX "custody_credits_caseId_idx" ON "custody_credits"("caseId");

CREATE INDEX "judicial_ruling_trends_caseId_idx" ON "judicial_ruling_trends"("caseId");
CREATE INDEX "judicial_ruling_trends_rulingCategory_idx" ON "judicial_ruling_trends"("rulingCategory");

CREATE INDEX "plea_consequences_caseId_idx" ON "plea_consequences"("caseId");
CREATE INDEX "plea_consequences_pleaType_idx" ON "plea_consequences"("pleaType");
