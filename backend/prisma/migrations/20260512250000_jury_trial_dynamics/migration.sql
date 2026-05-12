-- Phase D.7: Jury Persuasion Analytics + Trial Dynamics Intelligence
-- Additive only. No existing tables modified.

-- NarrativeCoherenceScore
CREATE TABLE "narrative_coherence_scores" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "prosecutionClarity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "defenseClarity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "internalConsistency" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "chronologicalFlow" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "witnessAlignment" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "overallCoherence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "weakPoints" TEXT NOT NULL,
    "strengthPoints" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "narrative_coherence_scores_pkey" PRIMARY KEY ("id")
);

-- JurorConfusionZone
CREATE TABLE "juror_confusion_zones" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "confusionType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "affectedElements" TEXT NOT NULL,
    "confusingStatements" TEXT NOT NULL,
    "clarificationNeeded" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "juror_confusion_zones_pkey" PRIMARY KEY ("id")
);

-- ContradictionSalienceScore
CREATE TABLE "contradiction_salience_scores" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "contradictionId" TEXT NOT NULL,
    "salienceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "juryImpact" TEXT NOT NULL,
    "elementRelevance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "witnessCredibilityHit" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "narrativeDisruption" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "presentationPriority" INTEGER NOT NULL DEFAULT 0,
    "presentationNotes" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contradiction_salience_scores_pkey" PRIMARY KEY ("id")
);

-- WitnessCredibilityImpact
CREATE TABLE "witness_credibility_impacts" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "overallCredibility" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "corroborationScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "biasIndicators" TEXT NOT NULL,
    "demeanorFlags" TEXT NOT NULL,
    "priorInconsistencies" INTEGER NOT NULL DEFAULT 0,
    "contradictionCount" INTEGER NOT NULL DEFAULT 0,
    "elementDependency" TEXT NOT NULL,
    "impactIfImpeached" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "witness_credibility_impacts_pkey" PRIMARY KEY ("id")
);

-- BurdenClarityAnalysis
CREATE TABLE "burden_clarity_analyses" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "instructionNumber" INTEGER NOT NULL,
    "chargeTitle" TEXT NOT NULL,
    "elementClarityScores" TEXT NOT NULL,
    "overallBurdenClarity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "weakestElement" TEXT,
    "strongestElement" TEXT,
    "juryInstruction" TEXT NOT NULL,
    "defenseArgument" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "burden_clarity_analyses_pkey" PRIMARY KEY ("id")
);

-- ReasonableDoubtAmplifier
CREATE TABLE "reasonable_doubt_amplifiers" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "doubtSource" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amplificationScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "elementConnection" TEXT NOT NULL,
    "supportingEvidence" TEXT NOT NULL,
    "presentationOrder" INTEGER NOT NULL DEFAULT 0,
    "cumulativeImpact" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reasonable_doubt_amplifiers_pkey" PRIMARY KEY ("id")
);

-- TheoryComplexityScore
CREATE TABLE "theory_complexity_scores" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "theoryType" TEXT NOT NULL,
    "complexityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "factorCount" INTEGER NOT NULL DEFAULT 0,
    "witnessCount" INTEGER NOT NULL DEFAULT 0,
    "documentCount" INTEGER NOT NULL DEFAULT 0,
    "timelineSteps" INTEGER NOT NULL DEFAULT 0,
    "logicalLeaps" TEXT NOT NULL,
    "simplificationOptions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "theory_complexity_scores_pkey" PRIMARY KEY ("id")
);

-- TimelineComprehensionModel
CREATE TABLE "timeline_comprehension_models" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "totalEvents" INTEGER NOT NULL DEFAULT 0,
    "clarityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "gapCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "confusingSegments" TEXT NOT NULL,
    "clearSegments" TEXT NOT NULL,
    "prosecutionTimeline" TEXT NOT NULL,
    "defenseTimeline" TEXT NOT NULL,
    "juryPresentation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "timeline_comprehension_models_pkey" PRIMARY KEY ("id")
);

-- EvidentiaryWeightBalance
CREATE TABLE "evidentiary_weight_balances" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instructionId" TEXT,
    "prosecutionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "defenseWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "netBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "balanceByElement" TEXT NOT NULL,
    "strongestProsEvidence" TEXT NOT NULL,
    "strongestDefEvidence" TEXT NOT NULL,
    "vulnerabilities" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "evidentiary_weight_balances_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "narrative_coherence_scores_caseId_idx" ON "narrative_coherence_scores"("caseId");

CREATE INDEX "juror_confusion_zones_caseId_idx" ON "juror_confusion_zones"("caseId");
CREATE INDEX "juror_confusion_zones_confusionType_idx" ON "juror_confusion_zones"("confusionType");
CREATE INDEX "juror_confusion_zones_severity_idx" ON "juror_confusion_zones"("severity");

CREATE INDEX "contradiction_salience_scores_caseId_idx" ON "contradiction_salience_scores"("caseId");
CREATE INDEX "contradiction_salience_scores_salienceScore_idx" ON "contradiction_salience_scores"("salienceScore");
CREATE INDEX "contradiction_salience_scores_presentationPriority_idx" ON "contradiction_salience_scores"("presentationPriority");

CREATE UNIQUE INDEX "witness_credibility_impacts_caseId_witnessName_key" ON "witness_credibility_impacts"("caseId", "witnessName");
CREATE INDEX "witness_credibility_impacts_caseId_idx" ON "witness_credibility_impacts"("caseId");
CREATE INDEX "witness_credibility_impacts_overallCredibility_idx" ON "witness_credibility_impacts"("overallCredibility");

CREATE UNIQUE INDEX "burden_clarity_analyses_caseId_instructionId_key" ON "burden_clarity_analyses"("caseId", "instructionId");
CREATE INDEX "burden_clarity_analyses_caseId_idx" ON "burden_clarity_analyses"("caseId");
CREATE INDEX "burden_clarity_analyses_overallBurdenClarity_idx" ON "burden_clarity_analyses"("overallBurdenClarity");

CREATE INDEX "reasonable_doubt_amplifiers_caseId_idx" ON "reasonable_doubt_amplifiers"("caseId");
CREATE INDEX "reasonable_doubt_amplifiers_amplificationScore_idx" ON "reasonable_doubt_amplifiers"("amplificationScore");
CREATE INDEX "reasonable_doubt_amplifiers_doubtSource_idx" ON "reasonable_doubt_amplifiers"("doubtSource");

CREATE INDEX "theory_complexity_scores_caseId_idx" ON "theory_complexity_scores"("caseId");
CREATE INDEX "theory_complexity_scores_theoryType_idx" ON "theory_complexity_scores"("theoryType");

CREATE INDEX "timeline_comprehension_models_caseId_idx" ON "timeline_comprehension_models"("caseId");

CREATE INDEX "evidentiary_weight_balances_caseId_idx" ON "evidentiary_weight_balances"("caseId");
CREATE INDEX "evidentiary_weight_balances_netBalance_idx" ON "evidentiary_weight_balances"("netBalance");
