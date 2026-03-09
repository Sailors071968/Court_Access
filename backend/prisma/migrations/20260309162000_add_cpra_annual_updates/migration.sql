-- AlterTable: Add annual update fields to cpra_agency_requests
ALTER TABLE "cpra_agency_requests" ADD COLUMN "policyReceivedAt" TIMESTAMP(3);
ALTER TABLE "cpra_agency_requests" ADD COLUMN "annualUpdateDue" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "cpra_agency_requests_annualUpdateDue_idx" ON "cpra_agency_requests"("annualUpdateDue");

-- CreateTable
CREATE TABLE "cpra_annual_updates" (
    "updateId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "responseReceived" BOOLEAN NOT NULL DEFAULT false,
    "responseReceivedAt" TIMESTAMP(3),
    "policyReceivedAt" TIMESTAMP(3),
    "annualUpdateDue" TIMESTAMP(3),
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "lastFollowUpAt" TIMESTAMP(3),
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpra_annual_updates_pkey" PRIMARY KEY ("updateId")
);

-- CreateIndex
CREATE INDEX "cpra_annual_updates_agencyId_idx" ON "cpra_annual_updates"("agencyId");

-- CreateIndex
CREATE INDEX "cpra_annual_updates_annualUpdateDue_idx" ON "cpra_annual_updates"("annualUpdateDue");

-- CreateIndex
CREATE INDEX "cpra_annual_updates_status_idx" ON "cpra_annual_updates"("status");

-- CreateIndex
CREATE INDEX "cpra_annual_updates_closed_idx" ON "cpra_annual_updates"("closed");
