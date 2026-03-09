-- CreateTable
CREATE TABLE "cpra_request_campaigns" (
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cpra_request_campaigns_pkey" PRIMARY KEY ("campaignId")
);

-- CreateTable
CREATE TABLE "cpra_agency_requests" (
    "requestId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "lastFollowUpAt" TIMESTAMP(3),
    "responseReceived" BOOLEAN NOT NULL DEFAULT false,
    "responseReceivedAt" TIMESTAMP(3),
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpra_agency_requests_pkey" PRIMARY KEY ("requestId")
);

-- CreateIndex
CREATE INDEX "cpra_request_campaigns_active_idx" ON "cpra_request_campaigns"("active");

-- CreateIndex
CREATE INDEX "cpra_agency_requests_campaignId_idx" ON "cpra_agency_requests"("campaignId");

-- CreateIndex
CREATE INDEX "cpra_agency_requests_agencyId_idx" ON "cpra_agency_requests"("agencyId");

-- CreateIndex
CREATE INDEX "cpra_agency_requests_status_idx" ON "cpra_agency_requests"("status");

-- CreateIndex
CREATE INDEX "cpra_agency_requests_closed_idx" ON "cpra_agency_requests"("closed");

-- CreateIndex
CREATE INDEX "cpra_agency_requests_responseReceived_idx" ON "cpra_agency_requests"("responseReceived");

-- AddForeignKey
ALTER TABLE "cpra_agency_requests" ADD CONSTRAINT "cpra_agency_requests_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "cpra_request_campaigns"("campaignId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpra_agency_requests" ADD CONSTRAINT "cpra_agency_requests_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("agencyId") ON DELETE RESTRICT ON UPDATE CASCADE;
