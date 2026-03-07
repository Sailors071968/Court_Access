-- CreateTable
CREATE TABLE "ReminderFailure" (
    "id" TEXT NOT NULL,
    "hearingId" TEXT NOT NULL,
    "reminderType" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderFailure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsRateLog" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsRateLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderFailure_hearingId_idx" ON "ReminderFailure"("hearingId");

-- CreateIndex
CREATE INDEX "ReminderFailure_phone_idx" ON "ReminderFailure"("phone");

-- CreateIndex
CREATE INDEX "SmsRateLog_phone_sentAt_idx" ON "SmsRateLog"("phone", "sentAt");
