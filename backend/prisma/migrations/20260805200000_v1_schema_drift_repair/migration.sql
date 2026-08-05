-- V1 schema drift repair.
--
-- The migration history had fallen behind schema.prisma, so a database built
-- by `prisma migrate deploy` was missing six tables and a number of columns
-- that application code queries unconditionally. On such a database
-- registration failed with P2022 (users.termsAcceptedAt does not exist) and
-- the charges, evidence-request, account-settings, redaction and disclosure
-- features returned 500s.
--
-- Statements are written to be re-runnable against deployments that were
-- patched by hand with `prisma db push`.

-- ---------------------------------------------------------------------------
-- users — registration writes these on every signup
-- ---------------------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- subscriptions — billing interval and trial tracking
-- ---------------------------------------------------------------------------
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "billingInterval" TEXT NOT NULL DEFAULT 'month';
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- processing_jobs — worker failure classification
-- ---------------------------------------------------------------------------
ALTER TABLE "processing_jobs" ADD COLUMN IF NOT EXISTS "failureCode" TEXT;

-- ---------------------------------------------------------------------------
-- timeline_events — extraction writes partial events, so the descriptive
-- columns are nullable and the semantic-triple columns are new
-- ---------------------------------------------------------------------------
ALTER TABLE "timeline_events" ADD COLUMN IF NOT EXISTS "action" TEXT;
ALTER TABLE "timeline_events" ADD COLUMN IF NOT EXISTS "object" TEXT;
ALTER TABLE "timeline_events" ADD COLUMN IF NOT EXISTS "target" TEXT;
ALTER TABLE "timeline_events" ADD COLUMN IF NOT EXISTS "timeText" TEXT;
ALTER TABLE "timeline_events" ALTER COLUMN "tenantId" DROP NOT NULL;
ALTER TABLE "timeline_events" ALTER COLUMN "timestamp" DROP NOT NULL;
ALTER TABLE "timeline_events" ALTER COLUMN "sourceDoc" DROP NOT NULL;
ALTER TABLE "timeline_events" ALTER COLUMN "sourceType" DROP NOT NULL;
ALTER TABLE "timeline_events" ALTER COLUMN "confidence" DROP NOT NULL;
ALTER TABLE "timeline_events" ALTER COLUMN "confidence" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- evidence_chunks / verified_facts — align id defaults and timestamp precision
-- with the Prisma datamodel
-- ---------------------------------------------------------------------------
ALTER TABLE "evidence_chunks" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "evidence_chunks" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "verified_facts" ALTER COLUMN "factId" DROP DEFAULT;
ALTER TABLE "verified_facts" ALTER COLUMN "lockedAt" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "verified_facts" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "verified_facts" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "verified_facts" ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- schema_versions — the table was created with snake_case columns but the
-- Prisma model declares camelCase, so prisma.schemaVersion could not read it.
-- Existing rows are preserved by copying before the old columns are dropped.
-- ---------------------------------------------------------------------------
ALTER TABLE "schema_versions" ADD COLUMN IF NOT EXISTS "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "schema_versions" ADD COLUMN IF NOT EXISTS "appliedBy" TEXT NOT NULL DEFAULT 'prisma-migrate';
ALTER TABLE "schema_versions" ADD COLUMN IF NOT EXISTS "driftChecked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "schema_versions" ADD COLUMN IF NOT EXISTS "migrationName" TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schema_versions' AND column_name = 'applied_at'
  ) THEN
    UPDATE "schema_versions"
    SET "appliedAt" = COALESCE("applied_at", CURRENT_TIMESTAMP),
        "appliedBy" = COALESCE("applied_by", 'prisma-migrate'),
        "driftChecked" = COALESCE("drift_checked", false),
        "migrationName" = COALESCE("migration_name", '');
  END IF;
END $$;

DROP INDEX IF EXISTS "schema_versions_applied_at_idx";
ALTER TABLE "schema_versions" DROP COLUMN IF EXISTS "applied_at";
ALTER TABLE "schema_versions" DROP COLUMN IF EXISTS "applied_by";
ALTER TABLE "schema_versions" DROP COLUMN IF EXISTS "drift_checked";
ALTER TABLE "schema_versions" DROP COLUMN IF EXISTS "migration_name";
ALTER TABLE "schema_versions" ALTER COLUMN "migrationName" DROP DEFAULT;
ALTER TABLE "schema_versions" ALTER COLUMN "id" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- Charge — backs GET/POST /api/charges (charge and mens rea analysis)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Charge" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "title" TEXT,
    "dateOfOffense" TIMESTAMP(3),
    "victim" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Charge_caseId_idx" ON "Charge"("caseId");

-- ---------------------------------------------------------------------------
-- evidence_requests / responses — evidence gap detection
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "evidence_requests" (
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
CREATE INDEX IF NOT EXISTS "evidence_requests_caseId_idx" ON "evidence_requests"("caseId");
CREATE INDEX IF NOT EXISTS "evidence_requests_tenantId_idx" ON "evidence_requests"("tenantId");
CREATE INDEX IF NOT EXISTS "evidence_requests_status_idx" ON "evidence_requests"("status");
CREATE INDEX IF NOT EXISTS "evidence_requests_priority_idx" ON "evidence_requests"("priority");
CREATE INDEX IF NOT EXISTS "evidence_requests_createdAt_idx" ON "evidence_requests"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "evidence_requests_caseId_tenantId_type_title_key" ON "evidence_requests"("caseId", "tenantId", "type", "title");

CREATE TABLE IF NOT EXISTS "evidence_request_responses" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "respondedBy" TEXT NOT NULL,
    "responseType" TEXT NOT NULL,
    "deferUntilDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_request_responses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "evidence_request_responses_requestId_idx" ON "evidence_request_responses"("requestId");
CREATE INDEX IF NOT EXISTS "evidence_request_responses_respondedBy_idx" ON "evidence_request_responses"("respondedBy");
CREATE INDEX IF NOT EXISTS "evidence_request_responses_responseType_idx" ON "evidence_request_responses"("responseType");

-- ---------------------------------------------------------------------------
-- user_account_settings — backs the /settings page
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "user_account_settings" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "user_account_settings_userId_key" ON "user_account_settings"("userId");

-- ---------------------------------------------------------------------------
-- document_redaction_versions / disclosure_packages — redaction + disclosure
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "document_redaction_versions" (
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
CREATE INDEX IF NOT EXISTS "document_redaction_versions_tenantId_caseId_documentId_idx" ON "document_redaction_versions"("tenantId", "caseId", "documentId");
CREATE INDEX IF NOT EXISTS "document_redaction_versions_profileName_idx" ON "document_redaction_versions"("profileName");

CREATE TABLE IF NOT EXISTS "disclosure_packages" (
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
CREATE INDEX IF NOT EXISTS "disclosure_packages_tenantId_caseId_idx" ON "disclosure_packages"("tenantId", "caseId");
CREATE INDEX IF NOT EXISTS "disclosure_packages_recipientUserId_idx" ON "disclosure_packages"("recipientUserId");

-- ---------------------------------------------------------------------------
-- Indexes declared in the datamodel but never emitted by earlier migrations
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "approval_requests_tenantId_status_idx" ON "approval_requests"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "client_team_assignments_primaryAttorneyId_idx" ON "client_team_assignments"("primaryAttorneyId");
CREATE INDEX IF NOT EXISTS "client_team_assignments_officeId_idx" ON "client_team_assignments"("officeId");
CREATE INDEX IF NOT EXISTS "conflict_records_tenantId_conflictType_idx" ON "conflict_records"("tenantId", "conflictType");
CREATE INDEX IF NOT EXISTS "conflict_records_status_idx" ON "conflict_records"("status");
CREATE INDEX IF NOT EXISTS "knowledge_assets_tenantId_assetType_idx" ON "knowledge_assets"("tenantId", "assetType");
CREATE INDEX IF NOT EXISTS "org_internal_messages_senderId_idx" ON "org_internal_messages"("senderId");
CREATE INDEX IF NOT EXISTS "org_internal_messages_recipientId_idx" ON "org_internal_messages"("recipientId");
CREATE INDEX IF NOT EXISTS "org_internal_messages_channel_channelRef_idx" ON "org_internal_messages"("channel", "channelRef");
CREATE INDEX IF NOT EXISTS "org_tasks_tenantId_idx" ON "org_tasks"("tenantId");
CREATE INDEX IF NOT EXISTS "org_tasks_assigneeId_idx" ON "org_tasks"("assigneeId");
CREATE INDEX IF NOT EXISTS "org_tasks_caseId_idx" ON "org_tasks"("caseId");
CREATE INDEX IF NOT EXISTS "org_tasks_status_idx" ON "org_tasks"("status");
CREATE INDEX IF NOT EXISTS "organization_departments_officeId_idx" ON "organization_departments"("officeId");
CREATE INDEX IF NOT EXISTS "permission_grants_scope_resourceId_idx" ON "permission_grants"("scope", "resourceId");
CREATE INDEX IF NOT EXISTS "personnel_profiles_personnelType_idx" ON "personnel_profiles"("personnelType");
CREATE INDEX IF NOT EXISTS "schema_versions_appliedAt_idx" ON "schema_versions"("appliedAt");
CREATE INDEX IF NOT EXISTS "timeline_events_actor_idx" ON "timeline_events"("actor");
CREATE INDEX IF NOT EXISTS "timeline_events_action_idx" ON "timeline_events"("action");

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_request_responses_requestId_fkey') THEN
    ALTER TABLE "evidence_request_responses"
      ADD CONSTRAINT "evidence_request_responses_requestId_fkey"
      FOREIGN KEY ("requestId") REFERENCES "evidence_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_account_settings_userId_fkey') THEN
    ALTER TABLE "user_account_settings"
      ADD CONSTRAINT "user_account_settings_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
