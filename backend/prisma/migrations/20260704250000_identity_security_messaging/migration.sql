-- Program 1: Identity & Security + Program 13: Secure Messaging + Court Dates

-- User identity extensions
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfaSecretEncrypted" TEXT;

CREATE INDEX IF NOT EXISTS "users_clientId_idx" ON "users"("clientId");

-- Client portal link
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "portalUserId" TEXT;

-- Refresh token device/session metadata
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "deviceLabel" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Email verification tokens
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_verification_tokens_tokenHash_idx" ON "email_verification_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "email_verification_tokens_userId_idx" ON "email_verification_tokens"("userId");

ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Case hearings (court dates)
CREATE TABLE IF NOT EXISTS "case_hearings" (
    "hearingId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "hearingDate" TIMESTAMP(3) NOT NULL,
    "hearingType" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "case_hearings_pkey" PRIMARY KEY ("hearingId")
);

CREATE INDEX IF NOT EXISTS "case_hearings_caseId_idx" ON "case_hearings"("caseId");
CREATE INDEX IF NOT EXISTS "case_hearings_tenantId_idx" ON "case_hearings"("tenantId");
CREATE INDEX IF NOT EXISTS "case_hearings_hearingDate_idx" ON "case_hearings"("hearingDate");

ALTER TABLE "case_hearings" ADD CONSTRAINT "case_hearings_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "criminal_cases"("caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Secure case messaging
CREATE TABLE IF NOT EXISTS "case_messages" (
    "messageId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "case_messages_pkey" PRIMARY KEY ("messageId")
);

CREATE INDEX IF NOT EXISTS "case_messages_caseId_idx" ON "case_messages"("caseId");
CREATE INDEX IF NOT EXISTS "case_messages_tenantId_idx" ON "case_messages"("tenantId");
CREATE INDEX IF NOT EXISTS "case_messages_senderId_idx" ON "case_messages"("senderId");
CREATE INDEX IF NOT EXISTS "case_messages_createdAt_idx" ON "case_messages"("createdAt");

ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "criminal_cases"("caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- User to Client FK (optional portal link)
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("clientId") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
