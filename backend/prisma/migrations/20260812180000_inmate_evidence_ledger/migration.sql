-- Evidence Ledger: immutable append-only daily evidence lifecycle.
-- Algorithms are temporary. Evidence is permanent.

CREATE TABLE "inmate_evidence_ledger" (
    "entryId" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "opsDate" TIMESTAMP(3) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "dailyCaseId" TEXT,
    "uploadId" TEXT,
    "batchId" TEXT,
    "snapshotId" TEXT,
    "certificationId" TEXT,
    "corpusEntryId" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_evidence_ledger_pkey" PRIMARY KEY ("entryId")
);

CREATE UNIQUE INDEX "inmate_evidence_ledger_facility_opsDate_sequence_key"
  ON "inmate_evidence_ledger"("facility", "opsDate", "sequence");

CREATE INDEX "inmate_evidence_ledger_facility_opsDate_stage_idx"
  ON "inmate_evidence_ledger"("facility", "opsDate", "stage");

CREATE INDEX "inmate_evidence_ledger_stage_recordedAt_idx"
  ON "inmate_evidence_ledger"("stage", "recordedAt");

CREATE INDEX "inmate_evidence_ledger_dailyCaseId_idx"
  ON "inmate_evidence_ledger"("dailyCaseId");
