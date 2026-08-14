-- Continuous Operational Validation: daily engineering certifications + learning queue.
CREATE TABLE "inmate_daily_certifications" (
    "certificationId" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "opsDate" TIMESTAMP(3) NOT NULL,
    "priorRosterDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "priorInmateCount" INTEGER,
    "currentInmateCount" INTEGER,
    "newInmateCount" INTEGER,
    "existingInmateCount" INTEGER,
    "returningInmateCount" INTEGER,
    "reviewCount" INTEGER,
    "reconcileOk" BOOLEAN,
    "precision" DOUBLE PRECISION,
    "recall" DOUBLE PRECISION,
    "potentialClientsFound" INTEGER,
    "potentialClientsMissed" INTEGER,
    "processingTimeMs" INTEGER,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "dailyCaseId" TEXT,
    "operationalReportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inmate_daily_certifications_pkey" PRIMARY KEY ("certificationId")
);

CREATE UNIQUE INDEX "inmate_daily_certifications_facility_opsDate_key" ON "inmate_daily_certifications"("facility", "opsDate");
CREATE INDEX "inmate_daily_certifications_facility_status_opsDate_idx" ON "inmate_daily_certifications"("facility", "status", "opsDate");
CREATE INDEX "inmate_daily_certifications_opsDate_idx" ON "inmate_daily_certifications"("opsDate");

CREATE TABLE "inmate_learning_queue" (
    "itemId" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "opsDate" TIMESTAMP(3) NOT NULL,
    "inmateName" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "rootCause" TEXT NOT NULL DEFAULT 'unknown',
    "status" TEXT NOT NULL DEFAULT 'open',
    "stage" TEXT,
    "rule" TEXT,
    "evidence" TEXT,
    "why" TEXT,
    "regressionPath" TEXT,
    "certificationId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fixedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,

    CONSTRAINT "inmate_learning_queue_pkey" PRIMARY KEY ("itemId")
);

CREATE UNIQUE INDEX "inmate_learning_queue_facility_opsDate_inmateName_errorType_key" ON "inmate_learning_queue"("facility", "opsDate", "inmateName", "errorType");
CREATE INDEX "inmate_learning_queue_status_opsDate_idx" ON "inmate_learning_queue"("status", "opsDate");
CREATE INDEX "inmate_learning_queue_facility_status_idx" ON "inmate_learning_queue"("facility", "status");
CREATE INDEX "inmate_learning_queue_errorType_status_idx" ON "inmate_learning_queue"("errorType", "status");
