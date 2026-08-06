-- CreateTable
CREATE TABLE "official_statutes" (
    "officialStatuteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "officialUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'retrieved',
    "httpStatus" INTEGER,
    "unavailableReason" TEXT,
    "text" TEXT,
    "fingerprint" TEXT,
    "legislativeNote" TEXT,
    "hierarchy" JSONB,
    "compilation" JSONB,
    "compilerVersion" TEXT,
    "extractionVersion" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "cacheHits" INTEGER NOT NULL DEFAULT 0,
    "lastVerifiedAt" TIMESTAMP(3),

    CONSTRAINT "official_statutes_pkey" PRIMARY KEY ("officialStatuteId")
);

-- CreateTable
CREATE TABLE "case_statute_snapshots" (
    "caseStatuteSnapshotId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "officialStatuteId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL DEFAULT 'charged',
    "reachedVia" TEXT,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_statute_snapshots_pkey" PRIMARY KEY ("caseStatuteSnapshotId")
);

-- CreateTable
CREATE TABLE "legislative_sync_events" (
    "legislativeSyncEventId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "previousFingerprint" TEXT,
    "currentFingerprint" TEXT,
    "detail" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legislative_sync_events_pkey" PRIMARY KEY ("legislativeSyncEventId")
);

-- CreateIndex
CREATE INDEX "official_statutes_code_section_idx" ON "official_statutes"("code", "section");

-- CreateIndex
CREATE INDEX "official_statutes_status_idx" ON "official_statutes"("status");

-- CreateIndex
CREATE INDEX "official_statutes_supersededAt_idx" ON "official_statutes"("supersededAt");

-- CreateIndex
CREATE UNIQUE INDEX "official_statutes_code_section_fingerprint_key" ON "official_statutes"("code", "section", "fingerprint");

-- CreateIndex
CREATE INDEX "case_statute_snapshots_caseId_idx" ON "case_statute_snapshots"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "case_statute_snapshots_caseId_officialStatuteId_relationshi_key" ON "case_statute_snapshots"("caseId", "officialStatuteId", "relationship");

-- CreateIndex
CREATE INDEX "legislative_sync_events_outcome_idx" ON "legislative_sync_events"("outcome");

-- CreateIndex
CREATE INDEX "legislative_sync_events_detectedAt_idx" ON "legislative_sync_events"("detectedAt");

-- AddForeignKey
ALTER TABLE "case_statute_snapshots" ADD CONSTRAINT "case_statute_snapshots_officialStatuteId_fkey" FOREIGN KEY ("officialStatuteId") REFERENCES "official_statutes"("officialStatuteId") ON DELETE CASCADE ON UPDATE CASCADE;

