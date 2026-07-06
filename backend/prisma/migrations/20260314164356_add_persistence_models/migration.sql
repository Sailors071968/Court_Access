-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL DEFAULT 'FREE',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'active',
    "subscriptionTier" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_logs" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "userId" TEXT,
    "ip" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criminal_cases" (
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "phase" TEXT NOT NULL DEFAULT 'intake',
    "court" TEXT,
    "judge" TEXT,
    "department" TEXT,
    "nextHearing" TIMESTAMP(3),
    "nextHearingNote" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "criminal_cases_pkey" PRIMARY KEY ("caseId")
);

-- CreateTable
CREATE TABLE "evidence" (
    "evidenceId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" BIGINT NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "pageCount" INTEGER,
    "evidenceType" TEXT NOT NULL,
    "s3Key" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "processingError" TEXT,
    "multiplexDetected" BOOLEAN NOT NULL DEFAULT false,
    "multiplexCount" INTEGER,
    "normalizedPageCount" INTEGER,
    "acuCost" DOUBLE PRECISION,
    "acuConsumed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "analysisStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("evidenceId")
);

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
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_planId_idx" ON "subscriptions"("planId");

-- CreateIndex
CREATE INDEX "subscriptions_stripeSubscriptionId_idx" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_stripeCustomerId_idx" ON "subscriptions"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "security_logs_event_idx" ON "security_logs"("event");

-- CreateIndex
CREATE INDEX "security_logs_userId_idx" ON "security_logs"("userId");

-- CreateIndex
CREATE INDEX "security_logs_ip_idx" ON "security_logs"("ip");

-- CreateIndex
CREATE INDEX "security_logs_createdAt_idx" ON "security_logs"("createdAt");

-- CreateIndex
CREATE INDEX "criminal_cases_tenantId_idx" ON "criminal_cases"("tenantId");

-- CreateIndex
CREATE INDEX "criminal_cases_ownerId_idx" ON "criminal_cases"("ownerId");

-- CreateIndex
CREATE INDEX "criminal_cases_status_idx" ON "criminal_cases"("status");

-- CreateIndex
CREATE INDEX "criminal_cases_caseType_idx" ON "criminal_cases"("caseType");

-- CreateIndex
CREATE INDEX "criminal_cases_createdAt_idx" ON "criminal_cases"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "criminal_cases_tenantId_caseNumber_key" ON "criminal_cases"("tenantId", "caseNumber");

-- CreateIndex
CREATE INDEX "evidence_caseId_idx" ON "evidence"("caseId");

-- CreateIndex
CREATE INDEX "evidence_tenantId_idx" ON "evidence"("tenantId");

-- CreateIndex
CREATE INDEX "evidence_evidenceType_idx" ON "evidence"("evidenceType");

-- CreateIndex
CREATE INDEX "evidence_processingStatus_idx" ON "evidence"("processingStatus");

-- CreateIndex
CREATE INDEX "evidence_analysisStatus_idx" ON "evidence"("analysisStatus");

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

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_logs" ADD CONSTRAINT "security_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "criminal_cases"("caseId") ON DELETE RESTRICT ON UPDATE CASCADE;
