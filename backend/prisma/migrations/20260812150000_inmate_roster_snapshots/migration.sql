-- Canonical roster snapshots: immutable baseline for next-day comparison.
-- Primary Engineering Directive: never compare against raw prior PDFs.

CREATE TABLE "inmate_roster_snapshots" (
    "snapshotId" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "rosterDate" TIMESTAMP(3) NOT NULL,
    "county" TEXT NOT NULL DEFAULT 'sacramento',
    "status" TEXT NOT NULL DEFAULT 'extracted',
    "sourceUploadId" TEXT,
    "sourceBatchId" TEXT,
    "sourceDocumentSha256" TEXT,
    "originalFilename" TEXT,
    "pageCount" INTEGER,
    "inmateCount" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT NOT NULL,
    "parserVersion" TEXT,
    "processingVersion" TEXT,
    "validationOk" BOOLEAN NOT NULL DEFAULT false,
    "validationErrors" JSONB NOT NULL DEFAULT '[]',
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "certifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_roster_snapshots_pkey" PRIMARY KEY ("snapshotId")
);

CREATE TABLE "inmate_roster_snapshot_members" (
    "memberId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "xref" TEXT,
    "housing" TEXT,
    "classification" TEXT,
    "gender" TEXT,
    "dateOfBirth" TEXT,
    "releaseDate" TEXT,
    "sourcePage" INTEGER,
    "sourceRow" INTEGER,
    "extractionConfidence" INTEGER,
    "evidence" JSONB,
    "inmateId" TEXT,
    "bookingId" TEXT,
    "ingestionRecordId" TEXT,

    CONSTRAINT "inmate_roster_snapshot_members_pkey" PRIMARY KEY ("memberId")
);

CREATE UNIQUE INDEX "inmate_roster_snapshots_facility_rosterDate_contentHash_key"
  ON "inmate_roster_snapshots"("facility", "rosterDate", "contentHash");
CREATE INDEX "inmate_roster_snapshots_facility_rosterDate_status_idx"
  ON "inmate_roster_snapshots"("facility", "rosterDate", "status");
CREATE INDEX "inmate_roster_snapshots_status_rosterDate_idx"
  ON "inmate_roster_snapshots"("status", "rosterDate");

CREATE INDEX "inmate_roster_snapshot_members_snapshotId_normalizedName_idx"
  ON "inmate_roster_snapshot_members"("snapshotId", "normalizedName");
CREATE INDEX "inmate_roster_snapshot_members_snapshotId_xref_idx"
  ON "inmate_roster_snapshot_members"("snapshotId", "xref");
CREATE INDEX "inmate_roster_snapshot_members_xref_idx"
  ON "inmate_roster_snapshot_members"("xref");

ALTER TABLE "inmate_roster_snapshot_members"
  ADD CONSTRAINT "inmate_roster_snapshot_members_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "inmate_roster_snapshots"("snapshotId")
  ON DELETE CASCADE ON UPDATE CASCADE;
