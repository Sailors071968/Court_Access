-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'attorney',
    "status" TEXT NOT NULL DEFAULT 'active',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "subscriptionId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "betaInviteId" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "storageUsedBytes" BIGINT NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'attorney',
    "inviteCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL DEFAULT '',
    "caseName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL DEFAULT 0,
    "sha256" TEXT NOT NULL DEFAULT '',
    "storageKey" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processingResult" JSONB,
    "scanResult" JSONB,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemErrorLog" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'error',
    "message" TEXT NOT NULL,
    "stackTrace" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL DEFAULT '',
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sourceEvidenceId" TEXT,
    "sourceType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'other',
    "eventDescription" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityValue" TEXT NOT NULL,
    "firstDetectedEvidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceEntityLink" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "detectionConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "contextSnippet" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceEntityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseNarrative" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "generatedTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summaryText" TEXT NOT NULL,
    "keyEvents" JSONB NOT NULL DEFAULT '[]',
    "conflictsDetected" JSONB NOT NULL DEFAULT '[]',
    "participants" JSONB NOT NULL DEFAULT '[]',
    "modelVersion" TEXT NOT NULL DEFAULT 'gpt-4',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseNarrative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceIntegrityReport" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "sha256Hash" TEXT NOT NULL,
    "sha3Hash" TEXT NOT NULL,
    "uploadTimestamp" TIMESTAMP(3) NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'verified',
    "chainOfCustody" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceIntegrityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveRecord" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "archiveHash" TEXT NOT NULL,
    "archiveLocation" TEXT NOT NULL,
    "archiveTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archiveManifest" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'archived',
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "totalSizeBytes" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveAuditLog" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_stripeCustomerId_idx" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BetaInvite_inviteCode_key" ON "BetaInvite"("inviteCode");

-- CreateIndex
CREATE INDEX "BetaInvite_email_idx" ON "BetaInvite"("email");

-- CreateIndex
CREATE INDEX "BetaInvite_inviteCode_idx" ON "BetaInvite"("inviteCode");

-- CreateIndex
CREATE INDEX "BetaInvite_status_idx" ON "BetaInvite"("status");

-- CreateIndex
CREATE INDEX "Case_userId_idx" ON "Case"("userId");

-- CreateIndex
CREATE INDEX "Case_status_idx" ON "Case"("status");

-- CreateIndex
CREATE INDEX "EvidenceRecord_userId_idx" ON "EvidenceRecord"("userId");

-- CreateIndex
CREATE INDEX "EvidenceRecord_caseId_idx" ON "EvidenceRecord"("caseId");

-- CreateIndex
CREATE INDEX "EvidenceRecord_status_idx" ON "EvidenceRecord"("status");

-- CreateIndex
CREATE INDEX "EvidenceRecord_caseId_status_idx" ON "EvidenceRecord"("caseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEvent_stripeEventId_key" ON "SubscriptionEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_stripeCustomerId_idx" ON "SubscriptionEvent"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_eventType_idx" ON "SubscriptionEvent"("eventType");

-- CreateIndex
CREATE INDEX "SystemErrorLog_service_idx" ON "SystemErrorLog"("service");

-- CreateIndex
CREATE INDEX "SystemErrorLog_level_idx" ON "SystemErrorLog"("level");

-- CreateIndex
CREATE INDEX "SystemErrorLog_resolved_idx" ON "SystemErrorLog"("resolved");

-- CreateIndex
CREATE INDEX "SystemErrorLog_lastSeen_idx" ON "SystemErrorLog"("lastSeen");

-- CreateIndex
CREATE INDEX "UserAuditLog_userId_idx" ON "UserAuditLog"("userId");

-- CreateIndex
CREATE INDEX "UserAuditLog_action_idx" ON "UserAuditLog"("action");

-- CreateIndex
CREATE INDEX "UserAuditLog_createdAt_idx" ON "UserAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_caseId_idx" ON "TimelineEvent"("caseId");

-- CreateIndex
CREATE INDEX "TimelineEvent_caseId_timestamp_idx" ON "TimelineEvent"("caseId", "timestamp");

-- CreateIndex
CREATE INDEX "Entity_caseId_idx" ON "Entity"("caseId");

-- CreateIndex
CREATE INDEX "Entity_caseId_entityType_idx" ON "Entity"("caseId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_caseId_entityType_entityValue_key" ON "Entity"("caseId", "entityType", "entityValue");

-- CreateIndex
CREATE INDEX "EvidenceEntityLink_entityId_idx" ON "EvidenceEntityLink"("entityId");

-- CreateIndex
CREATE INDEX "EvidenceEntityLink_evidenceId_idx" ON "EvidenceEntityLink"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceEntityLink_entityId_evidenceId_key" ON "EvidenceEntityLink"("entityId", "evidenceId");

-- CreateIndex
CREATE INDEX "CaseNarrative_caseId_idx" ON "CaseNarrative"("caseId");

-- CreateIndex
CREATE INDEX "CaseNarrative_caseId_generatedTimestamp_idx" ON "CaseNarrative"("caseId", "generatedTimestamp");

-- CreateIndex
CREATE INDEX "EvidenceIntegrityReport_caseId_idx" ON "EvidenceIntegrityReport"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceIntegrityReport_evidenceId_key" ON "EvidenceIntegrityReport"("evidenceId");

-- CreateIndex
CREATE INDEX "ArchiveRecord_status_idx" ON "ArchiveRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveRecord_caseId_key" ON "ArchiveRecord"("caseId");

-- CreateIndex
CREATE INDEX "ArchiveAuditLog_caseId_idx" ON "ArchiveAuditLog"("caseId");

-- CreateIndex
CREATE INDEX "ArchiveAuditLog_caseId_createdAt_idx" ON "ArchiveAuditLog"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAuditLog" ADD CONSTRAINT "UserAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceEntityLink" ADD CONSTRAINT "EvidenceEntityLink_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
