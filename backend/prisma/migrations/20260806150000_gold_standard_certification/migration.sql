-- CreateTable
CREATE TABLE "certification_cases" (
    "certificationCaseId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sourceDirectory" TEXT NOT NULL,
    "caseId" TEXT,
    "tenantId" TEXT NOT NULL,
    "importedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'importing',
    "corpusHash" TEXT,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "totalBytes" BIGINT NOT NULL DEFAULT 0,
    "importStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importCompletedAt" TIMESTAMP(3),
    "importErrors" JSONB,

    CONSTRAINT "certification_cases_pkey" PRIMARY KEY ("certificationCaseId")
);

-- CreateTable
CREATE TABLE "certification_files" (
    "certificationFileId" TEXT NOT NULL,
    "certificationCaseId" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "extension" TEXT,
    "mimeType" TEXT,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "originalModifiedAt" TIMESTAMP(3),
    "duplicateOfFileId" TEXT,
    "classification" TEXT NOT NULL DEFAULT 'unknown',
    "classificationConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "classificationBasis" TEXT,
    "evidenceId" TEXT,
    "ingestStatus" TEXT NOT NULL DEFAULT 'pending',
    "ingestMessage" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certification_files_pkey" PRIMARY KEY ("certificationFileId")
);

-- CreateTable
CREATE TABLE "certification_runs" (
    "certificationRunId" TEXT NOT NULL,
    "certificationCaseId" TEXT NOT NULL,
    "gitCommit" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "metrics" JSONB,
    "failures" JSONB,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "regressions" JSONB,

    CONSTRAINT "certification_runs_pkey" PRIMARY KEY ("certificationRunId")
);

-- CreateIndex
CREATE UNIQUE INDEX "certification_cases_reference_key" ON "certification_cases"("reference");

-- CreateIndex
CREATE INDEX "certification_cases_tenantId_idx" ON "certification_cases"("tenantId");

-- CreateIndex
CREATE INDEX "certification_cases_status_idx" ON "certification_cases"("status");

-- CreateIndex
CREATE INDEX "certification_files_certificationCaseId_idx" ON "certification_files"("certificationCaseId");

-- CreateIndex
CREATE INDEX "certification_files_sha256_idx" ON "certification_files"("sha256");

-- CreateIndex
CREATE INDEX "certification_files_classification_idx" ON "certification_files"("classification");

-- CreateIndex
CREATE UNIQUE INDEX "certification_files_certificationCaseId_relativePath_key" ON "certification_files"("certificationCaseId", "relativePath");

-- CreateIndex
CREATE INDEX "certification_runs_certificationCaseId_idx" ON "certification_runs"("certificationCaseId");

-- CreateIndex
CREATE INDEX "certification_runs_status_idx" ON "certification_runs"("status");

-- AddForeignKey
ALTER TABLE "certification_files" ADD CONSTRAINT "certification_files_certificationCaseId_fkey" FOREIGN KEY ("certificationCaseId") REFERENCES "certification_cases"("certificationCaseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification_runs" ADD CONSTRAINT "certification_runs_certificationCaseId_fkey" FOREIGN KEY ("certificationCaseId") REFERENCES "certification_cases"("certificationCaseId") ON DELETE CASCADE ON UPDATE CASCADE;

