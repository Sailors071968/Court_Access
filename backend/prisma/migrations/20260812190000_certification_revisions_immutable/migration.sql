-- Immutable Operational Truth: certifications are append-only revisions.
-- Never overwrite history. Corrections supersede via isCurrent + supersedesId.

-- Drop the old one-row-per-day uniqueness.
DROP INDEX IF EXISTS "inmate_daily_certifications_facility_opsDate_key";

ALTER TABLE "inmate_daily_certifications"
  ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "supersedesId" TEXT,
  ADD COLUMN IF NOT EXISTS "correctionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewerId" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewerName" TEXT,
  ADD COLUMN IF NOT EXISTS "evidencePackagePath" TEXT;

-- Existing rows become revision 1 / current.
UPDATE "inmate_daily_certifications"
SET "revision" = 1, "isCurrent" = true
WHERE "revision" IS NULL OR "revision" = 1;

CREATE UNIQUE INDEX IF NOT EXISTS "inmate_daily_certifications_facility_opsDate_revision_key"
  ON "inmate_daily_certifications"("facility", "opsDate", "revision");

CREATE INDEX IF NOT EXISTS "inmate_daily_certifications_facility_opsDate_isCurrent_idx"
  ON "inmate_daily_certifications"("facility", "opsDate", "isCurrent");

CREATE INDEX IF NOT EXISTS "inmate_daily_certifications_supersedesId_idx"
  ON "inmate_daily_certifications"("supersedesId");
