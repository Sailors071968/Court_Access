-- AlterTable
ALTER TABLE "inmate_aliases" ADD COLUMN     "collapsedLast" TEXT,
ADD COLUMN     "nameKeyVersion" TEXT,
ADD COLUMN     "phoneticLast" TEXT;

-- AlterTable
ALTER TABLE "inmates" ADD COLUMN     "collapsedLast" TEXT,
ADD COLUMN     "nameKeyVersion" TEXT,
ADD COLUMN     "phoneticLast" TEXT;

-- CreateTable
CREATE TABLE "inmate_external_ids" (
    "externalIdRow" TEXT NOT NULL,
    "inmateId" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "idKind" TEXT NOT NULL DEFAULT 'unknown',
    "firstSeenBatchId" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inmate_external_ids_pkey" PRIMARY KEY ("externalIdRow")
);

-- CreateIndex
CREATE INDEX "inmate_external_ids_inmateId_idx" ON "inmate_external_ids"("inmateId");

-- CreateIndex
CREATE UNIQUE INDEX "inmate_external_ids_facility_externalId_key" ON "inmate_external_ids"("facility", "externalId");

-- CreateIndex
CREATE INDEX "inmate_aliases_phoneticLast_idx" ON "inmate_aliases"("phoneticLast");

-- CreateIndex
CREATE INDEX "inmate_aliases_collapsedLast_idx" ON "inmate_aliases"("collapsedLast");

-- CreateIndex
CREATE INDEX "inmates_phoneticLast_idx" ON "inmates"("phoneticLast");

-- CreateIndex
CREATE INDEX "inmates_collapsedLast_idx" ON "inmates"("collapsedLast");

-- AddForeignKey
ALTER TABLE "inmate_external_ids" ADD CONSTRAINT "inmate_external_ids_inmateId_fkey" FOREIGN KEY ("inmateId") REFERENCES "inmates"("inmateId") ON DELETE CASCADE ON UPDATE CASCADE;
