-- Epic 2A-006: Per-record legislative extraction audit log
CREATE TABLE IF NOT EXISTS "legislative_extraction_audit" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "contentHash" TEXT,
  "sourceStatuteId" TEXT,
  "stage" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "rejectionReason" TEXT,
  "offenseCount" INTEGER NOT NULL DEFAULT 0,
  "elementCount" INTEGER NOT NULL DEFAULT 0,
  "parserVersion" TEXT NOT NULL,
  "extractorVersion" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legislative_extraction_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "legislative_extraction_audit_code_section_idx"
  ON "legislative_extraction_audit"("code", "section");
CREATE INDEX IF NOT EXISTS "legislative_extraction_audit_status_idx"
  ON "legislative_extraction_audit"("status");
CREATE INDEX IF NOT EXISTS "legislative_extraction_audit_createdAt_idx"
  ON "legislative_extraction_audit"("createdAt");
CREATE INDEX IF NOT EXISTS "legislative_extraction_audit_sourceStatuteId_idx"
  ON "legislative_extraction_audit"("sourceStatuteId");
