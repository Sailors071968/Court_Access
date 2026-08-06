-- CreateTable
CREATE TABLE "charging_documents" (
    "chargingDocumentId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filedAt" TIMESTAMP(3) NOT NULL,
    "court" TEXT,
    "courtCaseNumber" TEXT,
    "filingSequence" INTEGER NOT NULL,
    "sourceEvidenceId" TEXT,
    "citation" TEXT,
    "uploadedById" TEXT NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charging_documents_pkey" PRIMARY KEY ("chargingDocumentId")
);

-- CreateTable
CREATE TABLE "filed_charges" (
    "filedChargeId" TEXT NOT NULL,
    "chargingDocumentId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "countNumber" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "subdivision" TEXT,
    "verbatimText" TEXT NOT NULL,
    "normalizedCitation" TEXT NOT NULL,
    "officialStatuteId" TEXT,
    "statuteNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "enhancements" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filed_charges_pkey" PRIMARY KEY ("filedChargeId")
);

-- CreateTable
CREATE TABLE "charge_defendants" (
    "chargeDefendantId" TEXT NOT NULL,
    "filedChargeId" TEXT NOT NULL,
    "defendantName" TEXT NOT NULL,
    "clientId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'charged',
    "note" TEXT,

    CONSTRAINT "charge_defendants_pkey" PRIMARY KEY ("chargeDefendantId")
);

-- CreateIndex
CREATE INDEX "charging_documents_caseId_filedAt_idx" ON "charging_documents"("caseId", "filedAt");

-- CreateIndex
CREATE INDEX "charging_documents_tenantId_idx" ON "charging_documents"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "charging_documents_caseId_filingSequence_key" ON "charging_documents"("caseId", "filingSequence");

-- CreateIndex
CREATE INDEX "filed_charges_chargingDocumentId_idx" ON "filed_charges"("chargingDocumentId");

-- CreateIndex
CREATE INDEX "filed_charges_caseId_idx" ON "filed_charges"("caseId");

-- CreateIndex
CREATE INDEX "filed_charges_code_section_idx" ON "filed_charges"("code", "section");

-- CreateIndex
CREATE INDEX "charge_defendants_filedChargeId_idx" ON "charge_defendants"("filedChargeId");

-- CreateIndex
CREATE UNIQUE INDEX "charge_defendants_filedChargeId_defendantName_key" ON "charge_defendants"("filedChargeId", "defendantName");

-- AddForeignKey
ALTER TABLE "filed_charges" ADD CONSTRAINT "filed_charges_chargingDocumentId_fkey" FOREIGN KEY ("chargingDocumentId") REFERENCES "charging_documents"("chargingDocumentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_defendants" ADD CONSTRAINT "charge_defendants_filedChargeId_fkey" FOREIGN KEY ("filedChargeId") REFERENCES "filed_charges"("filedChargeId") ON DELETE CASCADE ON UPDATE CASCADE;

