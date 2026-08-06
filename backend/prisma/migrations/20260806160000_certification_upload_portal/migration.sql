-- AlterTable
ALTER TABLE "certification_files" ADD COLUMN     "durationSeconds" DOUBLE PRECISION,
ADD COLUMN     "mediaProbeNote" TEXT,
ADD COLUMN     "pageCount" INTEGER;

-- CreateTable
CREATE TABLE "certification_upload_sessions" (
    "uploadSessionId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "stagingDir" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'staging',
    "stage" TEXT,
    "stageDetail" TEXT,
    "progressCurrent" INTEGER NOT NULL DEFAULT 0,
    "progressTotal" INTEGER NOT NULL DEFAULT 0,
    "declaredFileCount" INTEGER NOT NULL DEFAULT 0,
    "declaredBytes" BIGINT NOT NULL DEFAULT 0,
    "certificationCaseId" TEXT,
    "certificationRunId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "certification_upload_sessions_pkey" PRIMARY KEY ("uploadSessionId")
);

-- CreateIndex
CREATE INDEX "certification_upload_sessions_tenantId_idx" ON "certification_upload_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "certification_upload_sessions_status_idx" ON "certification_upload_sessions"("status");

