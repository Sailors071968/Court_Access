-- PR 3: Mandatory Evidence Chunking
-- Creates evidence_chunks table for breaking large evidence into manageable pieces.
-- Each chunk has a SHA-256 checksum for integrity verification.

CREATE TABLE "evidence_chunks" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "evidenceId"    TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "chunkIndex"    INTEGER NOT NULL,
  "text"          TEXT NOT NULL,
  "startOffset"   INTEGER NOT NULL,
  "endOffset"     INTEGER NOT NULL,
  "checksum"      TEXT NOT NULL,
  "charCount"     INTEGER NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one chunk per index per evidence
CREATE UNIQUE INDEX "evidence_chunks_evidenceId_chunkIndex_key"
  ON "evidence_chunks" ("evidenceId", "chunkIndex");

-- Lookup indexes
CREATE INDEX "evidence_chunks_evidenceId_idx" ON "evidence_chunks" ("evidenceId");
CREATE INDEX "evidence_chunks_tenantId_idx" ON "evidence_chunks" ("tenantId");
CREATE INDEX "evidence_chunks_checksum_idx" ON "evidence_chunks" ("checksum");
