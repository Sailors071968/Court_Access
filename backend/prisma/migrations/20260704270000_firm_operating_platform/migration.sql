-- Program 2 Expansion: Law Firm Operating Platform

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "themeSettings" JSONB;
ALTER TABLE "organization_offices" ADD COLUMN IF NOT EXISTS "isBranch" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "personnelType" TEXT;
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "criminal_cases" ADD COLUMN IF NOT EXISTS "officeId" TEXT;
CREATE INDEX IF NOT EXISTS "criminal_cases_officeId_idx" ON "criminal_cases"("officeId");

CREATE TABLE IF NOT EXISTS "organization_departments" (
    "departmentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organization_departments_pkey" PRIMARY KEY ("departmentId")
);
CREATE INDEX IF NOT EXISTS "organization_departments_organizationId_idx" ON "organization_departments"("organizationId");
ALTER TABLE "organization_departments" ADD CONSTRAINT "organization_departments_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_departments" ADD CONSTRAINT "organization_departments_officeId_fkey"
  FOREIGN KEY ("officeId") REFERENCES "organization_offices"("officeId") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "personnel_profiles" (
    "profileId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personnelType" TEXT NOT NULL,
    "jobTitle" TEXT,
    "barNumber" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "certifications" JSONB,
    "licenses" JSONB,
    "permissions" JSONB,
    "calendarSettings" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "personnel_profiles_pkey" PRIMARY KEY ("profileId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "personnel_profiles_userId_key" ON "personnel_profiles"("userId");
CREATE INDEX IF NOT EXISTS "personnel_profiles_organizationId_idx" ON "personnel_profiles"("organizationId");
ALTER TABLE "personnel_profiles" ADD CONSTRAINT "personnel_profiles_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "personnel_profiles" ADD CONSTRAINT "personnel_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "client_team_assignments" (
    "assignmentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "primaryAttorneyId" TEXT,
    "secondaryAttorneyId" TEXT,
    "investigatorId" TEXT,
    "paralegalId" TEXT,
    "legalAssistantId" TEXT,
    "officeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "client_team_assignments_pkey" PRIMARY KEY ("assignmentId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "client_team_assignments_clientId_key" ON "client_team_assignments"("clientId");
CREATE INDEX IF NOT EXISTS "client_team_assignments_tenantId_idx" ON "client_team_assignments"("tenantId");
ALTER TABLE "client_team_assignments" ADD CONSTRAINT "client_team_assignments_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "org_internal_messages" (
    "messageId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'direct',
    "channelRef" TEXT,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "org_internal_messages_pkey" PRIMARY KEY ("messageId")
);
CREATE INDEX IF NOT EXISTS "org_internal_messages_organizationId_idx" ON "org_internal_messages"("organizationId");
ALTER TABLE "org_internal_messages" ADD CONSTRAINT "org_internal_messages_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_internal_messages" ADD CONSTRAINT "org_internal_messages_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "org_tasks" (
    "taskId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskType" TEXT NOT NULL DEFAULT 'general',
    "caseId" TEXT,
    "assigneeId" TEXT,
    "assignerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "org_tasks_pkey" PRIMARY KEY ("taskId")
);
CREATE INDEX IF NOT EXISTS "org_tasks_organizationId_idx" ON "org_tasks"("organizationId");
ALTER TABLE "org_tasks" ADD CONSTRAINT "org_tasks_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "knowledge_assets" (
    "assetId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT,
    "createdById" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "knowledge_assets_pkey" PRIMARY KEY ("assetId")
);
CREATE INDEX IF NOT EXISTS "knowledge_assets_organizationId_idx" ON "knowledge_assets"("organizationId");
ALTER TABLE "knowledge_assets" ADD CONSTRAINT "knowledge_assets_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "conflict_records" (
    "recordId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conflictType" TEXT NOT NULL,
    "entityA" TEXT NOT NULL,
    "entityB" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'review',
    "status" TEXT NOT NULL DEFAULT 'open',
    "details" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "conflict_records_pkey" PRIMARY KEY ("recordId")
);
CREATE INDEX IF NOT EXISTS "conflict_records_organizationId_idx" ON "conflict_records"("organizationId");
ALTER TABLE "conflict_records" ADD CONSTRAINT "conflict_records_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "permission_grants" (
    "grantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "resourceId" TEXT,
    "departmentId" TEXT,
    "permission" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permission_grants_pkey" PRIMARY KEY ("grantId")
);
CREATE INDEX IF NOT EXISTS "permission_grants_organizationId_userId_idx" ON "permission_grants"("organizationId", "userId");
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "organization_departments"("departmentId") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "approval_requests" (
    "requestId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approverId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("requestId")
);
CREATE INDEX IF NOT EXISTS "approval_requests_organizationId_idx" ON "approval_requests"("organizationId");
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "organization_departments"("departmentId") ON DELETE SET NULL ON UPDATE CASCADE;
