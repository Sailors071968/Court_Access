-- CreateTable
CREATE TABLE "Hearing" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "courthouseName" TEXT NOT NULL,
    "courthouseAddress" TEXT NOT NULL,
    "hearingName" TEXT NOT NULL,
    "hearingDatetime" TIMESTAMP(3) NOT NULL,
    "department" TEXT NOT NULL DEFAULT '',
    "reminder1Enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder2Enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder3Enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder1DaysBefore" INTEGER NOT NULL DEFAULT 7,
    "reminder2DaysBefore" INTEGER NOT NULL DEFAULT 3,
    "reminder3DaysBefore" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hearing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HearingReminderLog" (
    "id" TEXT NOT NULL,
    "hearingId" TEXT NOT NULL,
    "reminderType" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HearingReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hearing_caseId_idx" ON "Hearing"("caseId");

-- CreateIndex
CREATE INDEX "HearingReminderLog_hearingId_idx" ON "HearingReminderLog"("hearingId");

-- CreateIndex
CREATE UNIQUE INDEX "HearingReminderLog_hearingId_reminderType_key" ON "HearingReminderLog"("hearingId", "reminderType");

-- AddForeignKey
ALTER TABLE "HearingReminderLog" ADD CONSTRAINT "HearingReminderLog_hearingId_fkey" FOREIGN KEY ("hearingId") REFERENCES "Hearing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
