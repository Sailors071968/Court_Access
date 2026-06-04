-- Phase F.2: Real-Time Case Intelligence + Live Litigation Monitoring Framework
-- 9 tables for real-time transcript events, live contradictions, burden shifts,
-- witness credibility updates, timeline updates, objection consequences,
-- appellate preservation, courtroom events, litigation snapshots.
-- Additive only — no existing tables modified.

-- 1. Real-Time Transcript Ingestion Event
CREATE TABLE "real_time_transcript_events" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "documentId" TEXT,
    "eventType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "speaker" TEXT,
    "pageNumber" INTEGER,
    "lineNumber" INTEGER,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "metadata" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "real_time_transcript_events_pkey" PRIMARY KEY ("id")
);

-- 2. Live Contradiction Emergence
CREATE TABLE "live_contradiction_emergences" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "contradictionPairId" TEXT,
    "triggerEventId" TEXT NOT NULL,
    "emergenceType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "statementAText" TEXT NOT NULL,
    "statementBText" TEXT NOT NULL,
    "speaker" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_contradiction_emergences_pkey" PRIMARY KEY ("id")
);

-- 3. Dynamic Burden Shift
CREATE TABLE "dynamic_burden_shifts" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "elementId" TEXT,
    "instructionId" TEXT,
    "shiftType" TEXT NOT NULL,
    "previousState" TEXT NOT NULL,
    "newState" TEXT NOT NULL,
    "triggerEventId" TEXT,
    "triggerDescription" TEXT NOT NULL,
    "magnitude" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dynamic_burden_shifts_pkey" PRIMARY KEY ("id")
);

-- 4. Active Witness Credibility Update
CREATE TABLE "active_witness_credibility_updates" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "updateType" TEXT NOT NULL,
    "previousScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "newScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "triggerEventId" TEXT,
    "triggerDescription" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_witness_credibility_updates_pkey" PRIMARY KEY ("id")
);

-- 5. Real-Time Timeline Update
CREATE TABLE "real_time_timeline_updates" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "updateType" TEXT NOT NULL,
    "eventDescription" TEXT NOT NULL,
    "eventTimestamp" TEXT,
    "previousState" TEXT,
    "newState" TEXT NOT NULL,
    "triggerEventId" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "real_time_timeline_updates_pkey" PRIMARY KEY ("id")
);

-- 6. Live Objection Consequence
CREATE TABLE "live_objection_consequences" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "objectionType" TEXT NOT NULL,
    "ruling" TEXT NOT NULL,
    "consequenceType" TEXT NOT NULL,
    "impactDescription" TEXT NOT NULL,
    "affectedEvidenceIds" TEXT NOT NULL,
    "appellatePreservation" BOOLEAN NOT NULL DEFAULT false,
    "triggerEventId" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_objection_consequences_pkey" PRIMARY KEY ("id")
);

-- 7. Ongoing Appellate Preservation State
CREATE TABLE "ongoing_appellate_preservations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "issueDescription" TEXT NOT NULL,
    "preservationStatus" TEXT NOT NULL,
    "lastAction" TEXT NOT NULL,
    "lastActionTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredFollowUp" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ongoing_appellate_preservations_pkey" PRIMARY KEY ("id")
);

-- 8. Courtroom Event Stream
CREATE TABLE "courtroom_event_streams" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDescription" TEXT NOT NULL,
    "speaker" TEXT,
    "trialPhase" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'uploaded_document',
    "sequenceNumber" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courtroom_event_streams_pkey" PRIMARY KEY ("id")
);

-- 9. Litigation State Snapshot
CREATE TABLE "litigation_state_snapshots" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "snapshotType" TEXT NOT NULL,
    "litigationPhase" TEXT NOT NULL,
    "burdenState" TEXT NOT NULL,
    "contradictionState" TEXT NOT NULL,
    "witnessCredibility" TEXT NOT NULL,
    "appellateState" TEXT NOT NULL,
    "timelineState" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "litigation_state_snapshots_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "real_time_transcript_events_caseId_idx" ON "real_time_transcript_events"("caseId");
CREATE INDEX "real_time_transcript_events_eventType_idx" ON "real_time_transcript_events"("eventType");
CREATE INDEX "real_time_transcript_events_processingStatus_idx" ON "real_time_transcript_events"("processingStatus");

CREATE INDEX "live_contradiction_emergences_caseId_idx" ON "live_contradiction_emergences"("caseId");
CREATE INDEX "live_contradiction_emergences_severity_idx" ON "live_contradiction_emergences"("severity");
CREATE INDEX "live_contradiction_emergences_acknowledged_idx" ON "live_contradiction_emergences"("acknowledged");

CREATE INDEX "dynamic_burden_shifts_caseId_idx" ON "dynamic_burden_shifts"("caseId");
CREATE INDEX "dynamic_burden_shifts_shiftType_idx" ON "dynamic_burden_shifts"("shiftType");
CREATE INDEX "dynamic_burden_shifts_magnitude_idx" ON "dynamic_burden_shifts"("magnitude");

CREATE INDEX "active_witness_credibility_updates_caseId_idx" ON "active_witness_credibility_updates"("caseId");
CREATE INDEX "active_witness_credibility_updates_witnessName_idx" ON "active_witness_credibility_updates"("witnessName");
CREATE INDEX "active_witness_credibility_updates_updateType_idx" ON "active_witness_credibility_updates"("updateType");

CREATE INDEX "real_time_timeline_updates_caseId_idx" ON "real_time_timeline_updates"("caseId");
CREATE INDEX "real_time_timeline_updates_updateType_idx" ON "real_time_timeline_updates"("updateType");

CREATE INDEX "live_objection_consequences_caseId_idx" ON "live_objection_consequences"("caseId");
CREATE INDEX "live_objection_consequences_objectionType_idx" ON "live_objection_consequences"("objectionType");
CREATE INDEX "live_objection_consequences_ruling_idx" ON "live_objection_consequences"("ruling");

CREATE INDEX "ongoing_appellate_preservations_caseId_idx" ON "ongoing_appellate_preservations"("caseId");
CREATE INDEX "ongoing_appellate_preservations_preservationStatus_idx" ON "ongoing_appellate_preservations"("preservationStatus");

CREATE INDEX "courtroom_event_streams_caseId_idx" ON "courtroom_event_streams"("caseId");
CREATE INDEX "courtroom_event_streams_eventType_idx" ON "courtroom_event_streams"("eventType");
CREATE INDEX "courtroom_event_streams_trialPhase_idx" ON "courtroom_event_streams"("trialPhase");
CREATE INDEX "courtroom_event_streams_sequenceNumber_idx" ON "courtroom_event_streams"("sequenceNumber");

CREATE INDEX "litigation_state_snapshots_caseId_idx" ON "litigation_state_snapshots"("caseId");
CREATE INDEX "litigation_state_snapshots_snapshotType_idx" ON "litigation_state_snapshots"("snapshotType");
CREATE INDEX "litigation_state_snapshots_litigationPhase_idx" ON "litigation_state_snapshots"("litigationPhase");
