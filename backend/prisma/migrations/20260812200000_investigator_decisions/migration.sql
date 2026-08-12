-- Investigator Review Workspace — one-click decisions (append-only).

CREATE TABLE "inmate_investigator_decisions" (
    "decisionId" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "opsDate" TIMESTAMP(3) NOT NULL,
    "candidateKey" TEXT NOT NULL,
    "inmateName" TEXT NOT NULL,
    "niisClassification" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "confirmedClassification" TEXT,
    "defectCategory" TEXT,
    "disagreesWithNiis" BOOLEAN NOT NULL DEFAULT false,
    "inmateId" TEXT,
    "bookingId" TEXT,
    "investigatorId" TEXT,
    "investigatorName" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "inmate_investigator_decisions_pkey" PRIMARY KEY ("decisionId")
);

CREATE INDEX "inmate_investigator_decisions_facility_opsDate_decidedAt_idx"
  ON "inmate_investigator_decisions"("facility", "opsDate", "decidedAt");

CREATE INDEX "inmate_investigator_decisions_candidateKey_opsDate_idx"
  ON "inmate_investigator_decisions"("candidateKey", "opsDate");

CREATE INDEX "inmate_investigator_decisions_disagreesWithNiis_opsDate_idx"
  ON "inmate_investigator_decisions"("disagreesWithNiis", "opsDate");
