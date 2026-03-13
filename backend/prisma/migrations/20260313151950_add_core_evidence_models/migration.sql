-- CreateTable
CREATE TABLE "criminal_cases" (
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "phase" TEXT NOT NULL DEFAULT 'intake',
    "court" TEXT,
    "judge" TEXT,
    "department" TEXT,
    "nextHearing" TIMESTAMP(3),
    "nextHearingNote" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "criminal_cases_pkey" PRIMARY KEY ("caseId")
);

-- CreateTable
CREATE TABLE "evidence" (
    "evidenceId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" BIGINT NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "pageCount" INTEGER,
    "evidenceType" TEXT NOT NULL,
    "s3Key" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "processingError" TEXT,
    "multiplexDetected" BOOLEAN NOT NULL DEFAULT false,
    "multiplexCount" INTEGER,
    "normalizedPageCount" INTEGER,
    "acuCost" DOUBLE PRECISION,
    "acuConsumed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "analysisStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("evidenceId")
);

-- CreateIndex
CREATE INDEX "criminal_cases_tenantId_idx" ON "criminal_cases"("tenantId");

-- CreateIndex
CREATE INDEX "criminal_cases_ownerId_idx" ON "criminal_cases"("ownerId");

-- CreateIndex
CREATE INDEX "criminal_cases_status_idx" ON "criminal_cases"("status");

-- CreateIndex
CREATE INDEX "criminal_cases_caseType_idx" ON "criminal_cases"("caseType");

-- CreateIndex
CREATE INDEX "criminal_cases_createdAt_idx" ON "criminal_cases"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "criminal_cases_tenantId_caseNumber_key" ON "criminal_cases"("tenantId", "caseNumber");

-- CreateIndex
CREATE INDEX "evidence_caseId_idx" ON "evidence"("caseId");

-- CreateIndex
CREATE INDEX "evidence_tenantId_idx" ON "evidence"("tenantId");

-- CreateIndex
CREATE INDEX "evidence_evidenceType_idx" ON "evidence"("evidenceType");

-- CreateIndex
CREATE INDEX "evidence_processingStatus_idx" ON "evidence"("processingStatus");

-- CreateIndex
CREATE INDEX "evidence_analysisStatus_idx" ON "evidence"("analysisStatus");

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "criminal_cases"("caseId") ON DELETE RESTRICT ON UPDATE CASCADE;
