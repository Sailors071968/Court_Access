-- AlterTable
ALTER TABLE "inmate_ingestion_batches" ADD COLUMN     "parserConfidence" INTEGER,
ADD COLUMN     "validationReport" JSONB;

-- CreateTable
CREATE TABLE "inmate_import_inspections" (
    "inspectionId" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileKind" TEXT NOT NULL,
    "profileId" TEXT,
    "profileVersion" INTEGER,
    "verdict" TEXT NOT NULL,
    "parserConfidence" INTEGER NOT NULL,
    "report" JSONB NOT NULL,
    "inspectedById" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_import_inspections_pkey" PRIMARY KEY ("inspectionId")
);

-- CreateIndex
CREATE INDEX "inmate_import_inspections_facility_inspectedAt_idx" ON "inmate_import_inspections"("facility", "inspectedAt");

-- CreateIndex
CREATE INDEX "inmate_import_inspections_sha256_idx" ON "inmate_import_inspections"("sha256");

-- CreateIndex
CREATE INDEX "inmate_import_inspections_verdict_inspectedAt_idx" ON "inmate_import_inspections"("verdict", "inspectedAt");
