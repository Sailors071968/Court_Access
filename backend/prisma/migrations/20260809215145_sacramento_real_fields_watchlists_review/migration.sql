/*
  Warnings:

  - Added the required column `updatedAt` to the `inmate_watch_list_entries` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "inmate_booking_observations" ADD COLUMN     "arrestType" TEXT,
ADD COLUMN     "courtName" TEXT,
ADD COLUMN     "outstandingWarrants" BOOLEAN,
ADD COLUMN     "projectedReleaseAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "inmate_bookings" ADD COLUMN     "arrestType" TEXT,
ADD COLUMN     "courtName" TEXT,
ADD COLUMN     "heightInches" INTEGER,
ADD COLUMN     "outstandingWarrants" BOOLEAN,
ADD COLUMN     "projectedReleaseAt" TIMESTAMP(3),
ADD COLUMN     "weightPounds" INTEGER;

-- AlterTable
ALTER TABLE "inmate_parser_profiles" ADD COLUMN     "expectedHeaders" TEXT[],
ADD COLUMN     "normalizationRules" TEXT[],
ADD COLUMN     "validationRules" JSONB;

-- AlterTable
ALTER TABLE "inmate_review_queue" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "evidenceRequested" TEXT,
ADD COLUMN     "evidenceRequestedAt" TIMESTAMP(3),
ADD COLUMN     "evidenceRequestedById" TEXT,
ADD COLUMN     "mergePolicyVersion" TEXT,
ADD COLUMN     "overrideReason" TEXT,
ADD COLUMN     "overrodeRecommendation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'routine',
ADD COLUMN     "resolverVersion" TEXT;

-- AlterTable
ALTER TABLE "inmate_watch_list_entries" ADD COLUMN     "disabledById" TEXT,
ADD COLUMN     "disabledReason" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "label" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'routine',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
