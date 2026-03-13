-- CreateTable
CREATE TABLE "narrative_claims" (
    "claimId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "object" TEXT,
    "target" TEXT,
    "timestampReference" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sentenceIndex" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "narrative_claims_pkey" PRIMARY KEY ("claimId")
);

-- CreateTable
CREATE TABLE "normalized_claim_events" (
    "eventId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "actionNorm" TEXT NOT NULL,
    "object" TEXT,
    "target" TEXT,
    "timestamp" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "normalized_claim_events_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "claim_validations" (
    "validationId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "supportingEvidenceIds" JSONB NOT NULL DEFAULT '[]',
    "contradictingEvidenceIds" JSONB NOT NULL DEFAULT '[]',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "reasoning" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claim_validations_pkey" PRIMARY KEY ("validationId")
);

-- CreateTable
CREATE TABLE "impeachment_candidates" (
    "impeachmentId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "contradictionType" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "contradictingEvidence" TEXT NOT NULL,
    "suggestedQuestion" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impeachment_candidates_pkey" PRIMARY KEY ("impeachmentId")
);

-- CreateIndex
CREATE INDEX "narrative_claims_caseId_idx" ON "narrative_claims"("caseId");

-- CreateIndex
CREATE INDEX "narrative_claims_tenantId_idx" ON "narrative_claims"("tenantId");

-- CreateIndex
CREATE INDEX "narrative_claims_evidenceId_idx" ON "narrative_claims"("evidenceId");

-- CreateIndex
CREATE INDEX "narrative_claims_caseId_evidenceId_idx" ON "narrative_claims"("caseId", "evidenceId");

-- CreateIndex
CREATE INDEX "narrative_claims_confidence_idx" ON "narrative_claims"("confidence");

-- CreateIndex
CREATE INDEX "normalized_claim_events_claimId_idx" ON "normalized_claim_events"("claimId");

-- CreateIndex
CREATE INDEX "normalized_claim_events_caseId_idx" ON "normalized_claim_events"("caseId");

-- CreateIndex
CREATE INDEX "normalized_claim_events_tenantId_idx" ON "normalized_claim_events"("tenantId");

-- CreateIndex
CREATE INDEX "normalized_claim_events_eventType_idx" ON "normalized_claim_events"("eventType");

-- CreateIndex
CREATE INDEX "claim_validations_claimId_idx" ON "claim_validations"("claimId");

-- CreateIndex
CREATE INDEX "claim_validations_caseId_idx" ON "claim_validations"("caseId");

-- CreateIndex
CREATE INDEX "claim_validations_tenantId_idx" ON "claim_validations"("tenantId");

-- CreateIndex
CREATE INDEX "claim_validations_status_idx" ON "claim_validations"("status");

-- CreateIndex
CREATE INDEX "impeachment_candidates_claimId_idx" ON "impeachment_candidates"("claimId");

-- CreateIndex
CREATE INDEX "impeachment_candidates_caseId_idx" ON "impeachment_candidates"("caseId");

-- CreateIndex
CREATE INDEX "impeachment_candidates_tenantId_idx" ON "impeachment_candidates"("tenantId");

-- CreateIndex
CREATE INDEX "impeachment_candidates_severity_idx" ON "impeachment_candidates"("severity");
