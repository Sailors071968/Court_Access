-- Phase D.3: Contradiction Pair Intelligence + Burden Fracture Analysis
-- Additive only. No existing tables modified.

-- ContradictionPair
CREATE TABLE "contradiction_pairs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "statementAId" TEXT NOT NULL,
    "statementBId" TEXT NOT NULL,
    "contradictionType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "elementId" TEXT,
    "instructionId" TEXT,
    "proofMethod" TEXT NOT NULL,
    "proofExplanation" TEXT NOT NULL,
    "statementAText" TEXT NOT NULL,
    "statementBText" TEXT NOT NULL,
    "statementAPage" INTEGER,
    "statementALineStart" INTEGER,
    "statementALineEnd" INTEGER,
    "statementASpeaker" TEXT,
    "statementADocumentId" TEXT,
    "statementBPage" INTEGER,
    "statementBLineStart" INTEGER,
    "statementBLineEnd" INTEGER,
    "statementBSpeaker" TEXT,
    "statementBDocumentId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "burdenImpact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contradiction_pairs_pkey" PRIMARY KEY ("id")
);

-- BurdenFracture
CREATE TABLE "burden_fractures" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "fractureType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "supportingCount" INTEGER NOT NULL DEFAULT 0,
    "contradictingCount" INTEGER NOT NULL DEFAULT 0,
    "averageConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "explanation" TEXT NOT NULL,
    "prosecutionImpact" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "burden_fractures_pkey" PRIMARY KEY ("id")
);

-- WitnessInconsistency
CREATE TABLE "witness_inconsistencies" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "statementAId" TEXT NOT NULL,
    "statementBId" TEXT NOT NULL,
    "inconsistencyType" TEXT NOT NULL,
    "statementAText" TEXT NOT NULL,
    "statementBText" TEXT NOT NULL,
    "statementAPage" INTEGER,
    "statementADocumentId" TEXT,
    "statementBPage" INTEGER,
    "statementBDocumentId" TEXT,
    "detectedPattern" TEXT NOT NULL,
    "credibilityImpact" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "witness_inconsistencies_pkey" PRIMARY KEY ("id")
);

-- TimelineIncompatibility
CREATE TABLE "timeline_incompatibilities" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "statementAId" TEXT NOT NULL,
    "statementBId" TEXT NOT NULL,
    "incompatibilityType" TEXT NOT NULL,
    "timestampA" TEXT,
    "timestampB" TEXT,
    "locationA" TEXT,
    "locationB" TEXT,
    "statementAText" TEXT NOT NULL,
    "statementBText" TEXT NOT NULL,
    "statementAPage" INTEGER,
    "statementBPage" INTEGER,
    "statementASpeaker" TEXT,
    "statementBSpeaker" TEXT,
    "explanation" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeline_incompatibilities_pkey" PRIMARY KEY ("id")
);

-- ProsecutorTheoryAttack
CREATE TABLE "prosecutor_theory_attacks" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "elementId" TEXT,
    "attackType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "supportingEvidence" TEXT NOT NULL,
    "prosecutionWeakness" TEXT NOT NULL,
    "defenseOpportunity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prosecutor_theory_attacks_pkey" PRIMARY KEY ("id")
);

-- Indexes: contradiction_pairs
CREATE UNIQUE INDEX "contradiction_pairs_stmtA_stmtB_type_key" ON "contradiction_pairs"("statementAId", "statementBId", "contradictionType");
CREATE INDEX "contradiction_pairs_caseId_idx" ON "contradiction_pairs"("caseId");
CREATE INDEX "contradiction_pairs_contradictionType_idx" ON "contradiction_pairs"("contradictionType");
CREATE INDEX "contradiction_pairs_severity_idx" ON "contradiction_pairs"("severity");
CREATE INDEX "contradiction_pairs_elementId_idx" ON "contradiction_pairs"("elementId");
CREATE INDEX "contradiction_pairs_instructionId_idx" ON "contradiction_pairs"("instructionId");

-- Indexes: burden_fractures
CREATE UNIQUE INDEX "burden_fractures_caseId_elementId_fractureType_key" ON "burden_fractures"("caseId", "elementId", "fractureType");
CREATE INDEX "burden_fractures_caseId_idx" ON "burden_fractures"("caseId");
CREATE INDEX "burden_fractures_instructionId_idx" ON "burden_fractures"("instructionId");
CREATE INDEX "burden_fractures_elementId_idx" ON "burden_fractures"("elementId");
CREATE INDEX "burden_fractures_fractureType_idx" ON "burden_fractures"("fractureType");
CREATE INDEX "burden_fractures_severity_idx" ON "burden_fractures"("severity");

-- Indexes: witness_inconsistencies
CREATE INDEX "witness_inconsistencies_caseId_idx" ON "witness_inconsistencies"("caseId");
CREATE INDEX "witness_inconsistencies_speaker_idx" ON "witness_inconsistencies"("speaker");
CREATE INDEX "witness_inconsistencies_inconsistencyType_idx" ON "witness_inconsistencies"("inconsistencyType");

-- Indexes: timeline_incompatibilities
CREATE INDEX "timeline_incompatibilities_caseId_idx" ON "timeline_incompatibilities"("caseId");
CREATE INDEX "timeline_incompatibilities_incompatibilityType_idx" ON "timeline_incompatibilities"("incompatibilityType");
CREATE INDEX "timeline_incompatibilities_severity_idx" ON "timeline_incompatibilities"("severity");

-- Indexes: prosecutor_theory_attacks
CREATE INDEX "prosecutor_theory_attacks_caseId_idx" ON "prosecutor_theory_attacks"("caseId");
CREATE INDEX "prosecutor_theory_attacks_instructionId_idx" ON "prosecutor_theory_attacks"("instructionId");
CREATE INDEX "prosecutor_theory_attacks_attackType_idx" ON "prosecutor_theory_attacks"("attackType");
CREATE INDEX "prosecutor_theory_attacks_severity_idx" ON "prosecutor_theory_attacks"("severity");
