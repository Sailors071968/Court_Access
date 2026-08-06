-- AlterTable
ALTER TABLE "charging_documents" ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedReason" TEXT,
ADD COLUMN     "parseConfidence" DOUBLE PRECISION,
ADD COLUMN     "parseNotes" TEXT,
ADD COLUMN     "parsedFromEvidenceId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'filed';

-- AlterTable
ALTER TABLE "filed_charges" ADD COLUMN     "attempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "attorneyEdited" JSONB,
ADD COLUMN     "drugWeight" TEXT,
ADD COLUMN     "firearmAllegation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gangAllegation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "greatBodilyInjury" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maximumExposure" TEXT,
ADD COLUMN     "parseConfidence" JSONB,
ADD COLUMN     "priorConvictions" JSONB,
ADD COLUMN     "restitution" TEXT,
ADD COLUMN     "seriousFelony" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sexRegistration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "specialCircumstance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "strikeAllegation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "threeStrikes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "violentFelony" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "charge_audit_events" (
    "chargeAuditEventId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "chargingDocumentId" TEXT,
    "filedChargeId" TEXT,
    "tenantId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "description" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charge_audit_events_pkey" PRIMARY KEY ("chargeAuditEventId")
);

-- CreateIndex
CREATE INDEX "charge_audit_events_caseId_occurredAt_idx" ON "charge_audit_events"("caseId", "occurredAt");

-- CreateIndex
CREATE INDEX "charge_audit_events_filedChargeId_idx" ON "charge_audit_events"("filedChargeId");

