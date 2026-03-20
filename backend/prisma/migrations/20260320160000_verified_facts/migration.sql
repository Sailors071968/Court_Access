-- PR 4: Verified Fact Registry — Immutable, SHA-256 hashed, tenant-isolated
-- Creates verified_facts table as the canonical source of truth for each case.

CREATE TABLE "verified_facts" (
  "factId"            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "caseId"            TEXT NOT NULL,
  "tenantId"          TEXT NOT NULL,
  "factType"          TEXT NOT NULL,
  "content"           TEXT NOT NULL,
  "contentHash"       TEXT NOT NULL,
  "sourceEvidenceId"  TEXT NOT NULL,
  "sourceType"        TEXT NOT NULL,
  "confidence"        DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "lockedAt"          TIMESTAMPTZ,
  "metadata"          TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one fact per content hash per case per tenant
CREATE UNIQUE INDEX "verified_facts_caseId_tenantId_contentHash_key"
  ON "verified_facts" ("caseId", "tenantId", "contentHash");

-- Lookup indexes
CREATE INDEX "verified_facts_caseId_idx" ON "verified_facts" ("caseId");
CREATE INDEX "verified_facts_tenantId_idx" ON "verified_facts" ("tenantId");
CREATE INDEX "verified_facts_factType_idx" ON "verified_facts" ("factType");
CREATE INDEX "verified_facts_contentHash_idx" ON "verified_facts" ("contentHash");
CREATE INDEX "verified_facts_sourceEvidenceId_idx" ON "verified_facts" ("sourceEvidenceId");
CREATE INDEX "verified_facts_lockedAt_idx" ON "verified_facts" ("lockedAt");
CREATE INDEX "verified_facts_confidence_idx" ON "verified_facts" ("confidence");
