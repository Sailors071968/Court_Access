-- AlterTable
ALTER TABLE "case_witnesses" ADD COLUMN     "agency" TEXT,
ADD COLUMN     "credibilityStatus" TEXT,
ADD COLUMN     "employer" TEXT,
ADD COLUMN     "witnessType" TEXT;

-- AlterTable
ALTER TABLE "criminal_cases" ADD COLUMN     "county" TEXT,
ADD COLUMN     "defenseAttorney" TEXT,
ADD COLUMN     "filingDate" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "prosecutor" TEXT,
ADD COLUMN     "trialDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "evidence" ADD COLUMN     "sha256" TEXT;

-- AlterTable
ALTER TABLE "evidence_chunks" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "processing_jobs" ADD COLUMN     "failureCode" TEXT;

-- AlterTable
ALTER TABLE "schema_versions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "applied_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "billingInterval" TEXT NOT NULL DEFAULT 'month',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "timeline_events" ADD COLUMN     "action" TEXT,
ADD COLUMN     "object" TEXT,
ADD COLUMN     "target" TEXT,
ADD COLUMN     "timeText" TEXT,
ALTER COLUMN "tenantId" DROP NOT NULL,
ALTER COLUMN "timestamp" DROP NOT NULL,
ALTER COLUMN "sourceDoc" DROP NOT NULL,
ALTER COLUMN "sourceType" DROP NOT NULL,
ALTER COLUMN "confidence" DROP NOT NULL,
ALTER COLUMN "confidence" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verified_facts" ALTER COLUMN "factId" DROP DEFAULT,
ALTER COLUMN "lockedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "evidence_requests" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceEventIds" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_request_responses" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "respondedBy" TEXT NOT NULL,
    "responseType" TEXT NOT NULL,
    "deferUntilDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_request_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_settings" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiKeyEnc" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTestAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_items" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourceAgency" TEXT,
    "originalFileName" TEXT,
    "receivedDate" TIMESTAMP(3),
    "producedDate" TIMESTAMP(3),
    "hash" TEXT,
    "fileSize" BIGINT,
    "ocrStatus" TEXT NOT NULL DEFAULT 'unknown',
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewRole" TEXT,
    "bradyFlag" BOOLEAN NOT NULL DEFAULT false,
    "giglioFlag" BOOLEAN NOT NULL DEFAULT false,
    "jencksFlag" BOOLEAN NOT NULL DEFAULT false,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidenceId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "title" TEXT,
    "countNumber" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isAttempt" BOOLEAN NOT NULL DEFAULT false,
    "isEnhancement" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "severity" TEXT,
    "offenseId" TEXT,
    "classification" TEXT,
    "repositoryVerified" BOOLEAN NOT NULL DEFAULT false,
    "calcrimAvailable" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "dateOfOffense" TIMESTAMP(3),
    "victim" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_account_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyCaseUpdates" BOOLEAN NOT NULL DEFAULT true,
    "notifyBilling" BOOLEAN NOT NULL DEFAULT true,
    "notifyInvitations" BOOLEAN NOT NULL DEFAULT true,
    "aiInsightsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoDocumentAnalysis" BOOLEAN NOT NULL DEFAULT true,
    "compactSidebar" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_account_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_redaction_versions" (
    "redactionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "profileName" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "s3KeyRedacted" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "redactionData" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_redaction_versions_pkey" PRIMARY KEY ("redactionId")
);

-- CreateTable
CREATE TABLE "disclosure_packages" (
    "packageId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "redactionId" TEXT,
    "recipientType" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "recipientEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disclosure_packages_pkey" PRIMARY KEY ("packageId")
);

-- CreateIndex
CREATE INDEX "evidence_requests_caseId_idx" ON "evidence_requests"("caseId");

-- CreateIndex
CREATE INDEX "evidence_requests_tenantId_idx" ON "evidence_requests"("tenantId");

-- CreateIndex
CREATE INDEX "evidence_requests_status_idx" ON "evidence_requests"("status");

-- CreateIndex
CREATE INDEX "evidence_requests_priority_idx" ON "evidence_requests"("priority");

-- CreateIndex
CREATE INDEX "evidence_requests_createdAt_idx" ON "evidence_requests"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_requests_caseId_tenantId_type_title_key" ON "evidence_requests"("caseId", "tenantId", "type", "title");

-- CreateIndex
CREATE INDEX "evidence_request_responses_requestId_idx" ON "evidence_request_responses"("requestId");

-- CreateIndex
CREATE INDEX "evidence_request_responses_respondedBy_idx" ON "evidence_request_responses"("respondedBy");

-- CreateIndex
CREATE INDEX "evidence_request_responses_responseType_idx" ON "evidence_request_responses"("responseType");

-- CreateIndex
CREATE UNIQUE INDEX "integration_settings_providerId_key" ON "integration_settings"("providerId");

-- CreateIndex
CREATE INDEX "discovery_items_caseId_tenantId_idx" ON "discovery_items"("caseId", "tenantId");

-- CreateIndex
CREATE INDEX "discovery_items_reviewStatus_idx" ON "discovery_items"("reviewStatus");

-- CreateIndex
CREATE INDEX "Charge_caseId_idx" ON "Charge"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_settings_userId_key" ON "user_account_settings"("userId");

-- CreateIndex
CREATE INDEX "document_redaction_versions_tenantId_caseId_documentId_idx" ON "document_redaction_versions"("tenantId", "caseId", "documentId");

-- CreateIndex
CREATE INDEX "document_redaction_versions_profileName_idx" ON "document_redaction_versions"("profileName");

-- CreateIndex
CREATE INDEX "disclosure_packages_tenantId_caseId_idx" ON "disclosure_packages"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "disclosure_packages_recipientUserId_idx" ON "disclosure_packages"("recipientUserId");

-- CreateIndex
CREATE INDEX "approval_requests_tenantId_status_idx" ON "approval_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "client_team_assignments_primaryAttorneyId_idx" ON "client_team_assignments"("primaryAttorneyId");

-- CreateIndex
CREATE INDEX "client_team_assignments_officeId_idx" ON "client_team_assignments"("officeId");

-- CreateIndex
CREATE INDEX "conflict_records_tenantId_conflictType_idx" ON "conflict_records"("tenantId", "conflictType");

-- CreateIndex
CREATE INDEX "conflict_records_status_idx" ON "conflict_records"("status");

-- CreateIndex
CREATE INDEX "knowledge_assets_tenantId_assetType_idx" ON "knowledge_assets"("tenantId", "assetType");

-- CreateIndex
CREATE INDEX "org_internal_messages_senderId_idx" ON "org_internal_messages"("senderId");

-- CreateIndex
CREATE INDEX "org_internal_messages_recipientId_idx" ON "org_internal_messages"("recipientId");

-- CreateIndex
CREATE INDEX "org_internal_messages_channel_channelRef_idx" ON "org_internal_messages"("channel", "channelRef");

-- CreateIndex
CREATE INDEX "org_tasks_tenantId_idx" ON "org_tasks"("tenantId");

-- CreateIndex
CREATE INDEX "org_tasks_assigneeId_idx" ON "org_tasks"("assigneeId");

-- CreateIndex
CREATE INDEX "org_tasks_caseId_idx" ON "org_tasks"("caseId");

-- CreateIndex
CREATE INDEX "org_tasks_status_idx" ON "org_tasks"("status");

-- CreateIndex
CREATE INDEX "organization_departments_officeId_idx" ON "organization_departments"("officeId");

-- CreateIndex
CREATE INDEX "permission_grants_scope_resourceId_idx" ON "permission_grants"("scope", "resourceId");

-- CreateIndex
CREATE INDEX "personnel_profiles_personnelType_idx" ON "personnel_profiles"("personnelType");

-- CreateIndex
CREATE INDEX "timeline_events_actor_idx" ON "timeline_events"("actor");

-- CreateIndex
CREATE INDEX "timeline_events_action_idx" ON "timeline_events"("action");

-- AddForeignKey
ALTER TABLE "evidence_request_responses" ADD CONSTRAINT "evidence_request_responses_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "evidence_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_settings" ADD CONSTRAINT "user_account_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

