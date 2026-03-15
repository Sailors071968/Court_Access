-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT,
    "pipeline" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "acuCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_events" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sourceDoc" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actor" TEXT,
    "location" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
    "conflictsWith" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_codes" (
    "id" TEXT NOT NULL,
    "codeName" TEXT NOT NULL,
    "codeValue" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_usages" (
    "id" TEXT NOT NULL,
    "discountCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "agencyType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enterprise_licenses" (
    "id" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "agencyType" TEXT NOT NULL,
    "seatCount" INTEGER NOT NULL,
    "licenseStart" TIMESTAMP(3) NOT NULL,
    "licenseEnd" TIMESTAMP(3) NOT NULL,
    "billingTier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminEmail" TEXT NOT NULL,
    "county" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enterprise_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "government_leads" (
    "id" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT NOT NULL,
    "agencyType" TEXT NOT NULL,
    "seatEstimate" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "government_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_events" (
    "id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processing_jobs_userId_idx" ON "processing_jobs"("userId");

-- CreateIndex
CREATE INDEX "processing_jobs_tenantId_idx" ON "processing_jobs"("tenantId");

-- CreateIndex
CREATE INDEX "processing_jobs_caseId_idx" ON "processing_jobs"("caseId");

-- CreateIndex
CREATE INDEX "processing_jobs_pipeline_idx" ON "processing_jobs"("pipeline");

-- CreateIndex
CREATE INDEX "processing_jobs_status_idx" ON "processing_jobs"("status");

-- CreateIndex
CREATE INDEX "processing_jobs_createdAt_idx" ON "processing_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "timeline_events_caseId_idx" ON "timeline_events"("caseId");

-- CreateIndex
CREATE INDEX "timeline_events_tenantId_idx" ON "timeline_events"("tenantId");

-- CreateIndex
CREATE INDEX "timeline_events_timestamp_idx" ON "timeline_events"("timestamp");

-- CreateIndex
CREATE INDEX "timeline_events_sourceType_idx" ON "timeline_events"("sourceType");

-- CreateIndex
CREATE INDEX "timeline_events_confidence_idx" ON "timeline_events"("confidence");

-- CreateIndex
CREATE INDEX "timeline_events_conflictFlag_idx" ON "timeline_events"("conflictFlag");

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_codeValue_key" ON "discount_codes"("codeValue");

-- CreateIndex
CREATE INDEX "discount_codes_codeValue_idx" ON "discount_codes"("codeValue");

-- CreateIndex
CREATE INDEX "discount_codes_active_idx" ON "discount_codes"("active");

-- CreateIndex
CREATE INDEX "discount_usages_discountCodeId_idx" ON "discount_usages"("discountCodeId");

-- CreateIndex
CREATE INDEX "discount_usages_userId_idx" ON "discount_usages"("userId");

-- CreateIndex
CREATE INDEX "demo_requests_status_idx" ON "demo_requests"("status");

-- CreateIndex
CREATE INDEX "demo_requests_email_idx" ON "demo_requests"("email");

-- CreateIndex
CREATE INDEX "demo_requests_submittedAt_idx" ON "demo_requests"("submittedAt");

-- CreateIndex
CREATE INDEX "enterprise_licenses_status_idx" ON "enterprise_licenses"("status");

-- CreateIndex
CREATE INDEX "enterprise_licenses_adminEmail_idx" ON "enterprise_licenses"("adminEmail");

-- CreateIndex
CREATE INDEX "enterprise_licenses_organizationName_idx" ON "enterprise_licenses"("organizationName");

-- CreateIndex
CREATE INDEX "government_leads_status_idx" ON "government_leads"("status");

-- CreateIndex
CREATE INDEX "government_leads_email_idx" ON "government_leads"("email");

-- CreateIndex
CREATE INDEX "government_leads_agencyName_idx" ON "government_leads"("agencyName");

-- CreateIndex
CREATE INDEX "marketing_events_event_idx" ON "marketing_events"("event");

-- CreateIndex
CREATE INDEX "marketing_events_page_idx" ON "marketing_events"("page");

-- CreateIndex
CREATE INDEX "marketing_events_source_idx" ON "marketing_events"("source");

-- CreateIndex
CREATE INDEX "marketing_events_createdAt_idx" ON "marketing_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_webhook_events_eventId_key" ON "stripe_webhook_events"("eventId");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_eventId_idx" ON "stripe_webhook_events"("eventId");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_eventType_idx" ON "stripe_webhook_events"("eventType");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_processedAt_idx" ON "stripe_webhook_events"("processedAt");

-- AddForeignKey
ALTER TABLE "discount_usages" ADD CONSTRAINT "discount_usages_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "discount_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
