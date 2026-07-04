-- Domain B/C: Organization + Client models; case-client relationship

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "orgType" TEXT NOT NULL DEFAULT 'law_firm',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "clients" (
  "clientId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "middleName" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'prospect',
  "email" TEXT,
  "phone" TEXT,
  "phoneAlt" TEXT,
  "alternateContacts" JSONB,
  "emergencyContacts" JSONB,
  "addressHistory" JSONB,
  "communicationPreference" TEXT NOT NULL DEFAULT 'email',
  "language" TEXT NOT NULL DEFAULT 'en',
  "notes" TEXT,
  "intakeDate" TIMESTAMP(3),
  "retentionStatus" TEXT NOT NULL DEFAULT 'pending',
  "retainedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clients_pkey" PRIMARY KEY ("clientId")
);

CREATE INDEX IF NOT EXISTS "clients_tenantId_idx" ON "clients"("tenantId");
CREATE INDEX IF NOT EXISTS "clients_ownerId_idx" ON "clients"("ownerId");
CREATE INDEX IF NOT EXISTS "clients_status_idx" ON "clients"("status");
CREATE INDEX IF NOT EXISTS "clients_lastName_firstName_idx" ON "clients"("lastName", "firstName");

ALTER TABLE "criminal_cases" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
CREATE INDEX IF NOT EXISTS "criminal_cases_clientId_idx" ON "criminal_cases"("clientId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'criminal_cases_clientId_fkey'
  ) THEN
    ALTER TABLE "criminal_cases"
      ADD CONSTRAINT "criminal_cases_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "clients"("clientId")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
