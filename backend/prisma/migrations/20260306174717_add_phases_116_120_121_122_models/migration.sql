-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "windowMinutes" INTEGER NOT NULL DEFAULT 5,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" TEXT NOT NULL DEFAULT '',
    "notifyMethod" TEXT NOT NULL DEFAULT 'email',
    "lastTriggered" TIMESTAMP(3),
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'high',
    "message" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedbackType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "pageUrl" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "screenshotUrl" TEXT,
    "adminNotes" TEXT NOT NULL DEFAULT '',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetaFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reproductionSteps" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "component" TEXT NOT NULL DEFAULT '',
    "environment" TEXT NOT NULL DEFAULT 'beta',
    "fixCommit" TEXT,
    "fixVersion" TEXT,
    "reportedBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaHealthReport" (
    "id" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "evidenceProcessed" INTEGER NOT NULL DEFAULT 0,
    "workerUptime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "systemErrors" INTEGER NOT NULL DEFAULT 0,
    "feedbackCount" INTEGER NOT NULL DEFAULT 0,
    "bugCount" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "storageUsedBytes" BIGINT NOT NULL DEFAULT 0,
    "reportData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaHealthReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertRule_alertType_idx" ON "AlertRule"("alertType");

-- CreateIndex
CREATE INDEX "AlertRule_enabled_idx" ON "AlertRule"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRule_alertType_key" ON "AlertRule"("alertType");

-- CreateIndex
CREATE INDEX "AlertEvent_alertType_idx" ON "AlertEvent"("alertType");

-- CreateIndex
CREATE INDEX "AlertEvent_severity_idx" ON "AlertEvent"("severity");

-- CreateIndex
CREATE INDEX "AlertEvent_acknowledged_idx" ON "AlertEvent"("acknowledged");

-- CreateIndex
CREATE INDEX "AlertEvent_createdAt_idx" ON "AlertEvent"("createdAt");

-- CreateIndex
CREATE INDEX "BetaFeedback_userId_idx" ON "BetaFeedback"("userId");

-- CreateIndex
CREATE INDEX "BetaFeedback_feedbackType_idx" ON "BetaFeedback"("feedbackType");

-- CreateIndex
CREATE INDEX "BetaFeedback_severity_idx" ON "BetaFeedback"("severity");

-- CreateIndex
CREATE INDEX "BetaFeedback_status_idx" ON "BetaFeedback"("status");

-- CreateIndex
CREATE INDEX "BetaFeedback_createdAt_idx" ON "BetaFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "BugReport_severity_idx" ON "BugReport"("severity");

-- CreateIndex
CREATE INDEX "BugReport_status_idx" ON "BugReport"("status");

-- CreateIndex
CREATE INDEX "BugReport_component_idx" ON "BugReport"("component");

-- CreateIndex
CREATE INDEX "BugReport_createdAt_idx" ON "BugReport"("createdAt");

-- CreateIndex
CREATE INDEX "BetaHealthReport_reportDate_idx" ON "BetaHealthReport"("reportDate");

-- CreateIndex
CREATE INDEX "BetaHealthReport_createdAt_idx" ON "BetaHealthReport"("createdAt");

-- AddForeignKey
ALTER TABLE "BetaFeedback" ADD CONSTRAINT "BetaFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
