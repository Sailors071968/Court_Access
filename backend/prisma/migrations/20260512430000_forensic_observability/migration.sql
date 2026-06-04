-- Phase L.1: Full-System Observability + Forensic Telemetry Framework
-- 10 tables for operational tracing, telemetry synchronization, incident reconstruction,
-- integrity monitoring, observability pipelines, anomaly detection, audit telemetry,
-- state visibility, replay verification, observability certification.

-- 1. End-to-End Operational Traces
CREATE TABLE "end_to_end_operational_traces" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "traceType" TEXT NOT NULL,
    "traceOrigin" TEXT NOT NULL,
    "traceTarget" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "traceStatus" TEXT NOT NULL,
    "traceHash" TEXT NOT NULL,
    "spanDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "end_to_end_operational_traces_pkey" PRIMARY KEY ("id")
);

-- 2. Cross-Layer Telemetry Syncs
CREATE TABLE "cross_layer_telemetry_syncs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceLayer" TEXT NOT NULL,
    "targetLayer" TEXT NOT NULL,
    "syncStatus" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "targetHash" TEXT NOT NULL,
    "hashesMatch" BOOLEAN NOT NULL DEFAULT false,
    "recordsSynced" INTEGER NOT NULL DEFAULT 0,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cross_layer_telemetry_syncs_pkey" PRIMARY KEY ("id")
);

-- 3. Incident Reconstruction Records
CREATE TABLE "incident_reconstruction_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "incidentType" TEXT NOT NULL,
    "incidentSeverity" TEXT NOT NULL,
    "timelineSteps" INTEGER NOT NULL DEFAULT 0,
    "stepsReconstructed" INTEGER NOT NULL DEFAULT 0,
    "rootCauseIdentified" BOOLEAN NOT NULL DEFAULT false,
    "reconstructionHash" TEXT NOT NULL,
    "timeline" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incident_reconstruction_records_pkey" PRIMARY KEY ("id")
);

-- 4. Integrity Event Monitors
CREATE TABLE "integrity_event_monitors" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventSeverity" TEXT NOT NULL,
    "affectedComponent" TEXT NOT NULL,
    "eventHash" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TEXT,
    "eventDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integrity_event_monitors_pkey" PRIMARY KEY ("id")
);

-- 5. Deterministic Observability Pipelines
CREATE TABLE "deterministic_observability_pipelines" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "pipelineName" TEXT NOT NULL,
    "stagesTotal" INTEGER NOT NULL DEFAULT 0,
    "stagesCompleted" INTEGER NOT NULL DEFAULT 0,
    "stagesFailed" INTEGER NOT NULL DEFAULT 0,
    "pipelineStatus" TEXT NOT NULL,
    "pipelineHash" TEXT NOT NULL,
    "stageDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deterministic_observability_pipelines_pkey" PRIMARY KEY ("id")
);

-- 6. Operational Anomaly Detections
CREATE TABLE "operational_anomaly_detections" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "anomalyType" TEXT NOT NULL,
    "detectionRule" TEXT NOT NULL,
    "anomalySeverity" TEXT NOT NULL,
    "detected" BOOLEAN NOT NULL DEFAULT false,
    "baselineValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "anomalyDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_anomaly_detections_pkey" PRIMARY KEY ("id")
);

-- 7. Audit Telemetry Manifests
CREATE TABLE "audit_telemetry_manifests" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "manifestScope" TEXT NOT NULL,
    "entriesCount" INTEGER NOT NULL DEFAULT 0,
    "entriesVerified" INTEGER NOT NULL DEFAULT 0,
    "manifestHash" TEXT NOT NULL,
    "manifestComplete" BOOLEAN NOT NULL DEFAULT false,
    "generatedBy" TEXT NOT NULL,
    "manifestEntries" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_telemetry_manifests_pkey" PRIMARY KEY ("id")
);

-- 8. Platform State Visibilities
CREATE TABLE "platform_state_visibilities" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "componentStatus" TEXT NOT NULL,
    "lastHeartbeat" TEXT NOT NULL,
    "uptimePercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "activeConnections" INTEGER NOT NULL DEFAULT 0,
    "stateHash" TEXT NOT NULL,
    "stateDetails" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_state_visibilities_pkey" PRIMARY KEY ("id")
);

-- 9. Telemetry Replay Verifications
CREATE TABLE "telemetry_replay_verifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "replayScope" TEXT NOT NULL,
    "originalHash" TEXT NOT NULL,
    "replayHash" TEXT NOT NULL,
    "hashesMatch" BOOLEAN NOT NULL DEFAULT false,
    "eventsReplayed" INTEGER NOT NULL DEFAULT 0,
    "replayDurationMs" INTEGER NOT NULL DEFAULT 0,
    "discrepancies" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telemetry_replay_verifications_pkey" PRIMARY KEY ("id")
);

-- 10. Observability Certification Trackings
CREATE TABLE "observability_certification_trackings" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "certificationScope" TEXT NOT NULL,
    "checksTotal" INTEGER NOT NULL DEFAULT 0,
    "checksPassed" INTEGER NOT NULL DEFAULT 0,
    "certificationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "certificationStatus" TEXT NOT NULL,
    "certifiedBy" TEXT,
    "certifiedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "observability_certification_trackings_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "end_to_end_operational_traces_caseId_idx" ON "end_to_end_operational_traces"("caseId");
CREATE INDEX "end_to_end_operational_traces_traceType_idx" ON "end_to_end_operational_traces"("traceType");
CREATE INDEX "end_to_end_operational_traces_traceStatus_idx" ON "end_to_end_operational_traces"("traceStatus");

CREATE INDEX "cross_layer_telemetry_syncs_caseId_idx" ON "cross_layer_telemetry_syncs"("caseId");
CREATE INDEX "cross_layer_telemetry_syncs_sourceLayer_idx" ON "cross_layer_telemetry_syncs"("sourceLayer");
CREATE INDEX "cross_layer_telemetry_syncs_syncStatus_idx" ON "cross_layer_telemetry_syncs"("syncStatus");

CREATE INDEX "incident_reconstruction_records_caseId_idx" ON "incident_reconstruction_records"("caseId");
CREATE INDEX "incident_reconstruction_records_incidentType_idx" ON "incident_reconstruction_records"("incidentType");
CREATE INDEX "incident_reconstruction_records_incidentSeverity_idx" ON "incident_reconstruction_records"("incidentSeverity");

CREATE INDEX "integrity_event_monitors_caseId_idx" ON "integrity_event_monitors"("caseId");
CREATE INDEX "integrity_event_monitors_eventType_idx" ON "integrity_event_monitors"("eventType");
CREATE INDEX "integrity_event_monitors_eventSeverity_idx" ON "integrity_event_monitors"("eventSeverity");

CREATE INDEX "deterministic_observability_pipelines_caseId_idx" ON "deterministic_observability_pipelines"("caseId");
CREATE INDEX "deterministic_observability_pipelines_pipelineName_idx" ON "deterministic_observability_pipelines"("pipelineName");
CREATE INDEX "deterministic_observability_pipelines_pipelineStatus_idx" ON "deterministic_observability_pipelines"("pipelineStatus");

CREATE INDEX "operational_anomaly_detections_caseId_idx" ON "operational_anomaly_detections"("caseId");
CREATE INDEX "operational_anomaly_detections_anomalyType_idx" ON "operational_anomaly_detections"("anomalyType");
CREATE INDEX "operational_anomaly_detections_anomalySeverity_idx" ON "operational_anomaly_detections"("anomalySeverity");

CREATE INDEX "audit_telemetry_manifests_caseId_idx" ON "audit_telemetry_manifests"("caseId");
CREATE INDEX "audit_telemetry_manifests_manifestScope_idx" ON "audit_telemetry_manifests"("manifestScope");
CREATE INDEX "audit_telemetry_manifests_manifestComplete_idx" ON "audit_telemetry_manifests"("manifestComplete");

CREATE INDEX "platform_state_visibilities_caseId_idx" ON "platform_state_visibilities"("caseId");
CREATE INDEX "platform_state_visibilities_componentName_idx" ON "platform_state_visibilities"("componentName");
CREATE INDEX "platform_state_visibilities_componentStatus_idx" ON "platform_state_visibilities"("componentStatus");

CREATE INDEX "telemetry_replay_verifications_caseId_idx" ON "telemetry_replay_verifications"("caseId");
CREATE INDEX "telemetry_replay_verifications_replayScope_idx" ON "telemetry_replay_verifications"("replayScope");
CREATE INDEX "telemetry_replay_verifications_hashesMatch_idx" ON "telemetry_replay_verifications"("hashesMatch");

CREATE INDEX "observability_certification_trackings_caseId_idx" ON "observability_certification_trackings"("caseId");
CREATE INDEX "observability_certification_trackings_certificationScope_idx" ON "observability_certification_trackings"("certificationScope");
CREATE INDEX "observability_certification_trackings_certificationStatus_idx" ON "observability_certification_trackings"("certificationStatus");
