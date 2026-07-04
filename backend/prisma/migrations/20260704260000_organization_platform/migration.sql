-- Program 2: Organizations & Multi-Tenant Law Firm Platform

-- Extend organizations
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "settings" JSONB;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT DEFAULT '#1e293b';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "tagline" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "billingEmail" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboardingStep" TEXT NOT NULL DEFAULT 'created';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

-- User org placement
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "officeId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "practiceGroupId" TEXT;
CREATE INDEX IF NOT EXISTS "users_officeId_idx" ON "users"("officeId");
CREATE INDEX IF NOT EXISTS "users_practiceGroupId_idx" ON "users"("practiceGroupId");

-- Offices
CREATE TABLE IF NOT EXISTS "organization_offices" (
    "officeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT DEFAULT 'CA',
    "zip" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organization_offices_pkey" PRIMARY KEY ("officeId")
);
CREATE INDEX IF NOT EXISTS "organization_offices_organizationId_idx" ON "organization_offices"("organizationId");
ALTER TABLE "organization_offices" ADD CONSTRAINT "organization_offices_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Practice groups
CREATE TABLE IF NOT EXISTS "practice_groups" (
    "practiceGroupId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "practiceArea" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "practice_groups_pkey" PRIMARY KEY ("practiceGroupId")
);
CREATE INDEX IF NOT EXISTS "practice_groups_organizationId_idx" ON "practice_groups"("organizationId");
CREATE INDEX IF NOT EXISTS "practice_groups_officeId_idx" ON "practice_groups"("officeId");
ALTER TABLE "practice_groups" ADD CONSTRAINT "practice_groups_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "practice_groups" ADD CONSTRAINT "practice_groups_officeId_fkey"
  FOREIGN KEY ("officeId") REFERENCES "organization_offices"("officeId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Members
CREATE TABLE IF NOT EXISTS "organization_members" (
    "memberId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "officeId" TEXT,
    "practiceGroupId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "invitedById" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("memberId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_userId_key" ON "organization_members"("userId");
CREATE INDEX IF NOT EXISTS "organization_members_organizationId_idx" ON "organization_members"("organizationId");
CREATE INDEX IF NOT EXISTS "organization_members_organizationId_role_idx" ON "organization_members"("organizationId", "role");
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_officeId_fkey"
  FOREIGN KEY ("officeId") REFERENCES "organization_offices"("officeId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_practiceGroupId_fkey"
  FOREIGN KEY ("practiceGroupId") REFERENCES "practice_groups"("practiceGroupId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Invitations
CREATE TABLE IF NOT EXISTS "organization_invitations" (
    "invitationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "officeId" TEXT,
    "practiceGroupId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("invitationId")
);
CREATE INDEX IF NOT EXISTS "organization_invitations_tokenHash_idx" ON "organization_invitations"("tokenHash");
CREATE INDEX IF NOT EXISTS "organization_invitations_organizationId_email_idx" ON "organization_invitations"("organizationId", "email");
CREATE INDEX IF NOT EXISTS "organization_invitations_organizationId_status_idx" ON "organization_invitations"("organizationId", "status");
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_practiceGroupId_fkey"
  FOREIGN KEY ("practiceGroupId") REFERENCES "practice_groups"("practiceGroupId") ON DELETE SET NULL ON UPDATE CASCADE;

-- User FKs to office/practice group
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_officeId_fkey"
    FOREIGN KEY ("officeId") REFERENCES "organization_offices"("officeId") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_practiceGroupId_fkey"
    FOREIGN KEY ("practiceGroupId") REFERENCES "practice_groups"("practiceGroupId") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
