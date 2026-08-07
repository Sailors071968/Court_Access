-- AlterTable
ALTER TABLE "certification_cases" ADD COLUMN     "authorizationNote" TEXT,
ADD COLUMN     "authorized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "authorizedAt" TIMESTAMP(3),
ADD COLUMN     "authorizedById" TEXT;

