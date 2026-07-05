-- Program 2A, 4A, 6A — Role onboarding, unlimited org members, publication engine

-- User default role for onboarding
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "defaultRole" TEXT;

-- Organization members: unlimited users, multi-org membership
DROP INDEX IF EXISTS "organization_members_userId_key";
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "caseRole" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_organizationId_userId_key"
  ON "organization_members"("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "organization_members_userId_idx"
  ON "organization_members"("userId");

-- Program 6A — Document copies
CREATE TABLE IF NOT EXISTS "document_copies" (
  "copyId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "copyType" TEXT NOT NULL,
  "s3Key" TEXT,
  "parentCopyId" TEXT,
  "redactionId" TEXT,
  "publicationSetId" TEXT,
  "immutable" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_copies_pkey" PRIMARY KEY ("copyId")
);
CREATE INDEX IF NOT EXISTS "document_copies_tenantId_caseId_documentId_idx"
  ON "document_copies"("tenantId", "caseId", "documentId");
CREATE INDEX IF NOT EXISTS "document_copies_copyType_idx" ON "document_copies"("copyType");

-- Publication sets
CREATE TABLE IF NOT EXISTS "publication_sets" (
  "setId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "profileName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "publishedById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "publication_sets_pkey" PRIMARY KEY ("setId")
);
CREATE INDEX IF NOT EXISTS "publication_sets_tenantId_caseId_idx"
  ON "publication_sets"("tenantId", "caseId");

CREATE TABLE IF NOT EXISTS "publication_set_items" (
  "itemId" TEXT NOT NULL,
  "setId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "redactionId" TEXT,
  "publicationCopyId" TEXT,
  CONSTRAINT "publication_set_items_pkey" PRIMARY KEY ("itemId"),
  CONSTRAINT "publication_set_items_setId_fkey"
    FOREIGN KEY ("setId") REFERENCES "publication_sets"("setId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "publication_set_items_setId_idx" ON "publication_set_items"("setId");

-- Publication audit log
CREATE TABLE IF NOT EXISTS "publication_audit_logs" (
  "auditId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "publication_audit_logs_pkey" PRIMARY KEY ("auditId")
);
CREATE INDEX IF NOT EXISTS "publication_audit_logs_tenantId_caseId_idx"
  ON "publication_audit_logs"("tenantId", "caseId");
CREATE INDEX IF NOT EXISTS "publication_audit_logs_entityType_entityId_idx"
  ON "publication_audit_logs"("entityType", "entityId");
