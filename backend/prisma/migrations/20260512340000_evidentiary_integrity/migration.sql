-- Phase H.2: Enterprise Evidentiary Integrity + Reliability Assurance Framework
-- 10 tables for evidence hashing, chain-of-analysis, replay, corruption detection,
-- reproducibility, export verification, multi-version tracking, forensic certification,
-- integrity alerting, and transformation lineage. Additive only.

-- 1. Evidence Integrity Hashes
CREATE TABLE "evidence_integrity_hashes" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "hashAlgorithm" TEXT NOT NULL,
    "hashValue" TEXT NOT NULL,
    "contentLength" INTEGER NOT NULL DEFAULT 0,
    "sourceType" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "lastVerifiedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_integrity_hashes_pkey" PRIMARY KEY ("id")
);

-- 2. Chain of Analysis Verification
CREATE TABLE "chain_of_analysis_verifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "analysisLayer" TEXT NOT NULL,
    "inputRecordIds" TEXT NOT NULL,
    "outputRecordId" TEXT NOT NULL,
    "analysisFunction" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT NOT NULL,
    "reproducible" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TEXT,
    "chainPosition" INTEGER NOT NULL DEFAULT 0,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chain_of_analysis_verifications_pkey" PRIMARY KEY ("id")
);

-- 3. Deterministic Replay Records
CREATE TABLE "deterministic_replay_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "replayType" TEXT NOT NULL,
    "targetLayer" TEXT,
    "targetRecordId" TEXT,
    "originalRunTimestamp" TEXT NOT NULL,
    "replayRunTimestamp" TEXT NOT NULL,
    "inputSnapshot" TEXT NOT NULL,
    "outputSnapshot" TEXT NOT NULL,
    "matchStatus" TEXT NOT NULL,
    "deviationDetails" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deterministic_replay_records_pkey" PRIMARY KEY ("id")
);

-- 4. Evidence Corruption Detection
CREATE TABLE "evidence_corruption_detections" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "detectionMethod" TEXT NOT NULL,
    "expectedHash" TEXT NOT NULL,
    "actualHash" TEXT NOT NULL,
    "corruptionFound" BOOLEAN NOT NULL DEFAULT false,
    "corruptionType" TEXT,
    "severity" TEXT NOT NULL,
    "remediationStatus" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_corruption_detections_pkey" PRIMARY KEY ("id")
);

-- 5. Analysis Reproducibility Records
CREATE TABLE "analysis_reproducibility_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "analysisType" TEXT NOT NULL,
    "originalTimestamp" TEXT NOT NULL,
    "reproductionTimestamp" TEXT NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "outputFingerprint" TEXT NOT NULL,
    "reproducibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "discrepancies" TEXT,
    "certifiedReproducible" BOOLEAN NOT NULL DEFAULT false,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analysis_reproducibility_records_pkey" PRIMARY KEY ("id")
);

-- 6. Export Verification Signatures
CREATE TABLE "export_verification_signatures" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "exportTimestamp" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "layersIncluded" TEXT NOT NULL,
    "signatureMethod" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "export_verification_signatures_pkey" PRIMARY KEY ("id")
);

-- 7. Multi-Version Evidence Tracker
CREATE TABLE "multi_version_evidence_trackers" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "versionHash" TEXT NOT NULL,
    "previousVersionId" TEXT,
    "changeType" TEXT NOT NULL,
    "changeDescription" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "provenanceChain" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "multi_version_evidence_trackers_pkey" PRIMARY KEY ("id")
);

-- 8. Forensic Audit Certification
CREATE TABLE "forensic_audit_certifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "certificationScope" TEXT NOT NULL,
    "certifiedLayer" TEXT,
    "totalRecordsAudited" INTEGER NOT NULL DEFAULT 0,
    "integrityScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "hashesVerified" INTEGER NOT NULL DEFAULT 0,
    "hashFailures" INTEGER NOT NULL DEFAULT 0,
    "chainsVerified" INTEGER NOT NULL DEFAULT 0,
    "chainBreaks" INTEGER NOT NULL DEFAULT 0,
    "certificationStatus" TEXT NOT NULL,
    "certifiedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forensic_audit_certifications_pkey" PRIMARY KEY ("id")
);

-- 9. Integrity Breach Alerts
CREATE TABLE "integrity_breach_alerts" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "breachType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "affectedRecordId" TEXT NOT NULL,
    "affectedLayer" TEXT NOT NULL,
    "detectionMethod" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "resolvedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integrity_breach_alerts_pkey" PRIMARY KEY ("id")
);

-- 10. Evidence Transformation Lineage
CREATE TABLE "evidence_transformation_lineages" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "targetRecordId" TEXT NOT NULL,
    "transformationType" TEXT NOT NULL,
    "transformationLayer" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT NOT NULL,
    "transformationDetails" TEXT NOT NULL,
    "reversible" BOOLEAN NOT NULL DEFAULT false,
    "lineagePosition" INTEGER NOT NULL DEFAULT 0,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_transformation_lineages_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "evidence_integrity_hashes_evidenceId_hashAlgorithm_key" ON "evidence_integrity_hashes"("evidenceId", "hashAlgorithm");
CREATE INDEX "evidence_integrity_hashes_caseId_idx" ON "evidence_integrity_hashes"("caseId");
CREATE INDEX "evidence_integrity_hashes_evidenceId_idx" ON "evidence_integrity_hashes"("evidenceId");
CREATE INDEX "evidence_integrity_hashes_verificationStatus_idx" ON "evidence_integrity_hashes"("verificationStatus");

CREATE INDEX "chain_of_analysis_verifications_caseId_idx" ON "chain_of_analysis_verifications"("caseId");
CREATE INDEX "chain_of_analysis_verifications_analysisLayer_idx" ON "chain_of_analysis_verifications"("analysisLayer");
CREATE INDEX "chain_of_analysis_verifications_outputRecordId_idx" ON "chain_of_analysis_verifications"("outputRecordId");

CREATE INDEX "deterministic_replay_records_caseId_idx" ON "deterministic_replay_records"("caseId");
CREATE INDEX "deterministic_replay_records_replayType_idx" ON "deterministic_replay_records"("replayType");
CREATE INDEX "deterministic_replay_records_matchStatus_idx" ON "deterministic_replay_records"("matchStatus");

CREATE INDEX "evidence_corruption_detections_caseId_idx" ON "evidence_corruption_detections"("caseId");
CREATE INDEX "evidence_corruption_detections_evidenceId_idx" ON "evidence_corruption_detections"("evidenceId");
CREATE INDEX "evidence_corruption_detections_corruptionFound_idx" ON "evidence_corruption_detections"("corruptionFound");

CREATE INDEX "analysis_reproducibility_records_caseId_idx" ON "analysis_reproducibility_records"("caseId");
CREATE INDEX "analysis_reproducibility_records_analysisType_idx" ON "analysis_reproducibility_records"("analysisType");
CREATE INDEX "analysis_reproducibility_records_certifiedReproducible_idx" ON "analysis_reproducibility_records"("certifiedReproducible");

CREATE INDEX "export_verification_signatures_caseId_idx" ON "export_verification_signatures"("caseId");
CREATE INDEX "export_verification_signatures_exportType_idx" ON "export_verification_signatures"("exportType");
CREATE INDEX "export_verification_signatures_verified_idx" ON "export_verification_signatures"("verified");

CREATE INDEX "multi_version_evidence_trackers_caseId_idx" ON "multi_version_evidence_trackers"("caseId");
CREATE INDEX "multi_version_evidence_trackers_evidenceId_idx" ON "multi_version_evidence_trackers"("evidenceId");
CREATE INDEX "multi_version_evidence_trackers_versionNumber_idx" ON "multi_version_evidence_trackers"("versionNumber");

CREATE INDEX "forensic_audit_certifications_caseId_idx" ON "forensic_audit_certifications"("caseId");
CREATE INDEX "forensic_audit_certifications_certificationStatus_idx" ON "forensic_audit_certifications"("certificationStatus");

CREATE INDEX "integrity_breach_alerts_caseId_idx" ON "integrity_breach_alerts"("caseId");
CREATE INDEX "integrity_breach_alerts_breachType_idx" ON "integrity_breach_alerts"("breachType");
CREATE INDEX "integrity_breach_alerts_severity_idx" ON "integrity_breach_alerts"("severity");
CREATE INDEX "integrity_breach_alerts_acknowledged_idx" ON "integrity_breach_alerts"("acknowledged");

CREATE INDEX "evidence_transformation_lineages_caseId_idx" ON "evidence_transformation_lineages"("caseId");
CREATE INDEX "evidence_transformation_lineages_sourceRecordId_idx" ON "evidence_transformation_lineages"("sourceRecordId");
CREATE INDEX "evidence_transformation_lineages_targetRecordId_idx" ON "evidence_transformation_lineages"("targetRecordId");
CREATE INDEX "evidence_transformation_lineages_transformationType_idx" ON "evidence_transformation_lineages"("transformationType");
