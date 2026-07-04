-- Align timeline_events and processing_jobs with Prisma schema (P1-021, P1-018/019)

-- processing_jobs: failureCode for ACU exhaustion tracking
ALTER TABLE "processing_jobs" ADD COLUMN IF NOT EXISTS "failureCode" TEXT;

-- timeline_events: fields used by timelineReconstructionService
ALTER TABLE "timeline_events" ADD COLUMN IF NOT EXISTS "timeText" TEXT;
ALTER TABLE "timeline_events" ADD COLUMN IF NOT EXISTS "action" TEXT;
ALTER TABLE "timeline_events" ADD COLUMN IF NOT EXISTS "target" TEXT;
ALTER TABLE "timeline_events" ADD COLUMN IF NOT EXISTS "object" TEXT;

-- Allow unknown timestamps from evidence extraction
ALTER TABLE "timeline_events" ALTER COLUMN "timestamp" DROP NOT NULL;

-- Relax NOT NULL on source fields when no document linked yet
ALTER TABLE "timeline_events" ALTER COLUMN "sourceDoc" DROP NOT NULL;
ALTER TABLE "timeline_events" ALTER COLUMN "sourceType" DROP NOT NULL;
