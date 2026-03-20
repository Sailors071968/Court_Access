-- PR 1: Schema Version Control Table
-- Tracks schema versions applied to this database with checksums.
-- Boot-time assertion compares expected vs actual to hard-fail on drift.

CREATE TABLE "schema_versions" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "version"         TEXT NOT NULL,
  "checksum"        TEXT NOT NULL,
  "applied_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_by"      TEXT NOT NULL DEFAULT 'prisma-migrate',
  "description"     TEXT,
  "migration_name"  TEXT NOT NULL,
  "drift_checked"   BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX "schema_versions_version_key" ON "schema_versions" ("version");
CREATE INDEX "schema_versions_applied_at_idx" ON "schema_versions" ("applied_at");

-- Seed the initial version record for this migration
INSERT INTO "schema_versions" ("version", "checksum", "migration_name", "description", "applied_by")
VALUES (
  '1.0.0',
  'baseline-20260320',
  '20260320133000_schema_version_control',
  'PR 1 — Schema version control table + baseline',
  'prisma-migrate'
);
