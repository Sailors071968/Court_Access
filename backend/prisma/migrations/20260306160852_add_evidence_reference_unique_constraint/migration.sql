-- CreateTable
CREATE TABLE "VerifiedEmail" (
    "id" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "verificationToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifiedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailJob" (
    "id" TEXT NOT NULL,
    "emailType" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "emailType" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "deliveryStatus" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawEnforcementAgency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "agencyType" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "county" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "phoneMain" TEXT NOT NULL DEFAULT '',
    "phoneRecordsDivision" TEXT NOT NULL DEFAULT '',
    "emailRecordsDivision" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "recordsRequestUrl" TEXT NOT NULL DEFAULT '',
    "dataSource" TEXT NOT NULL DEFAULT '',
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "lastVerifiedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LawEnforcementAgency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicRecordsRequest" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT,
    "requestType" TEXT NOT NULL,
    "submissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryMethod" TEXT NOT NULL DEFAULT 'email',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "responseReceivedDate" TIMESTAMP(3),
    "responseHash" TEXT,
    "responseHashSha3" TEXT,
    "requestDocumentHash" TEXT,
    "requestDocumentHashSha3" TEXT,
    "requestContent" TEXT NOT NULL DEFAULT '',
    "templateId" TEXT,
    "staffApproved" BOOLEAN NOT NULL DEFAULT false,
    "staffApprovedBy" TEXT,
    "staffApprovedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicRecordsRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordsRequestTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mergeFields" JSONB NOT NULL DEFAULT '[]',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordsRequestTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceReference" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceValue" TEXT NOT NULL,
    "sourceContext" TEXT NOT NULL DEFAULT '',
    "extractionMethod" TEXT NOT NULL DEFAULT 'deterministic',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCrossReference" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "relatedDocumentId" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "sourceReferenceId" TEXT,
    "relatedReferenceId" TEXT,
    "description" TEXT NOT NULL,
    "sourceSnippet" TEXT NOT NULL DEFAULT '',
    "relatedSnippet" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentCrossReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "lastBeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restartCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaAccessConfig" (
    "id" TEXT NOT NULL,
    "maxBetaAccounts" INTEGER NOT NULL DEFAULT 50,
    "inviteExpireDays" INTEGER NOT NULL DEFAULT 7,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetaAccessConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedEmail_emailAddress_key" ON "VerifiedEmail"("emailAddress");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedEmail_verificationToken_key" ON "VerifiedEmail"("verificationToken");

-- CreateIndex
CREATE INDEX "VerifiedEmail_emailAddress_idx" ON "VerifiedEmail"("emailAddress");

-- CreateIndex
CREATE INDEX "VerifiedEmail_verificationStatus_idx" ON "VerifiedEmail"("verificationStatus");

-- CreateIndex
CREATE INDEX "EmailJob_status_idx" ON "EmailJob"("status");

-- CreateIndex
CREATE INDEX "EmailJob_emailType_idx" ON "EmailJob"("emailType");

-- CreateIndex
CREATE INDEX "EmailJob_recipient_idx" ON "EmailJob"("recipient");

-- CreateIndex
CREATE INDEX "EmailLog_recipient_idx" ON "EmailLog"("recipient");

-- CreateIndex
CREATE INDEX "EmailLog_emailType_idx" ON "EmailLog"("emailType");

-- CreateIndex
CREATE INDEX "EmailLog_deliveryStatus_idx" ON "EmailLog"("deliveryStatus");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE INDEX "LawEnforcementAgency_tenantId_idx" ON "LawEnforcementAgency"("tenantId");

-- CreateIndex
CREATE INDEX "LawEnforcementAgency_state_idx" ON "LawEnforcementAgency"("state");

-- CreateIndex
CREATE INDEX "LawEnforcementAgency_agencyType_idx" ON "LawEnforcementAgency"("agencyType");

-- CreateIndex
CREATE INDEX "LawEnforcementAgency_verificationStatus_idx" ON "LawEnforcementAgency"("verificationStatus");

-- CreateIndex
CREATE INDEX "LawEnforcementAgency_tenantId_state_idx" ON "LawEnforcementAgency"("tenantId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "LawEnforcementAgency_tenantId_agencyName_state_key" ON "LawEnforcementAgency"("tenantId", "agencyName", "state");

-- CreateIndex
CREATE INDEX "PublicRecordsRequest_tenantId_idx" ON "PublicRecordsRequest"("tenantId");

-- CreateIndex
CREATE INDEX "PublicRecordsRequest_agencyId_idx" ON "PublicRecordsRequest"("agencyId");

-- CreateIndex
CREATE INDEX "PublicRecordsRequest_caseId_idx" ON "PublicRecordsRequest"("caseId");

-- CreateIndex
CREATE INDEX "PublicRecordsRequest_status_idx" ON "PublicRecordsRequest"("status");

-- CreateIndex
CREATE INDEX "PublicRecordsRequest_tenantId_status_idx" ON "PublicRecordsRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "RecordsRequestTemplate_tenantId_idx" ON "RecordsRequestTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordsRequestTemplate_tenantId_templateName_key" ON "RecordsRequestTemplate"("tenantId", "templateName");

-- CreateIndex
CREATE INDEX "EvidenceReference_caseId_idx" ON "EvidenceReference"("caseId");

-- CreateIndex
CREATE INDEX "EvidenceReference_tenantId_idx" ON "EvidenceReference"("tenantId");

-- CreateIndex
CREATE INDEX "EvidenceReference_referenceType_idx" ON "EvidenceReference"("referenceType");

-- CreateIndex
CREATE INDEX "EvidenceReference_caseId_referenceType_idx" ON "EvidenceReference"("caseId", "referenceType");

-- CreateIndex
CREATE INDEX "EvidenceReference_referenceValue_idx" ON "EvidenceReference"("referenceValue");

-- CreateIndex (unique constraint for deduplication)
CREATE UNIQUE INDEX "EvidenceReference_caseId_tenantId_sourceDocumentId_referenc_key" ON "EvidenceReference"("caseId", "tenantId", "sourceDocumentId", "referenceType", "referenceValue");

-- CreateIndex
CREATE INDEX "DocumentCrossReference_caseId_idx" ON "DocumentCrossReference"("caseId");

-- CreateIndex
CREATE INDEX "DocumentCrossReference_tenantId_idx" ON "DocumentCrossReference"("tenantId");

-- CreateIndex
CREATE INDEX "DocumentCrossReference_referenceType_idx" ON "DocumentCrossReference"("referenceType");

-- CreateIndex
CREATE INDEX "DocumentCrossReference_caseId_referenceType_idx" ON "DocumentCrossReference"("caseId", "referenceType");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerHeartbeat_workerName_key" ON "WorkerHeartbeat"("workerName");

-- CreateIndex
CREATE INDEX "WorkerHeartbeat_workerName_idx" ON "WorkerHeartbeat"("workerName");

-- CreateIndex
CREATE INDEX "WorkerHeartbeat_status_idx" ON "WorkerHeartbeat"("status");

-- AddForeignKey
ALTER TABLE "PublicRecordsRequest" ADD CONSTRAINT "PublicRecordsRequest_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "LawEnforcementAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
