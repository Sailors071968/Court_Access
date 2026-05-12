-- Phase J.2: Formal Verification + Evidentiary Trust Assurance Framework
-- 10 tables for verification proofs, integrity attestations, reproducibility proofs,
-- verification chains, audit verification, validation checkpoints, trust certification,
-- cross-layer sync, verification replay, defensibility certification.

-- 1. Deterministic Verification Proofs
CREATE TABLE "deterministic_verification_proofs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "proofType" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT NOT NULL,
    "proofResult" TEXT NOT NULL,
    "reproductionCount" INTEGER NOT NULL DEFAULT 1,
    "allReproductionsMatch" BOOLEAN NOT NULL DEFAULT false,
    "verificationMethod" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deterministic_verification_proofs_pkey" PRIMARY KEY ("id")
);

-- 2. Integrity Attestation Records
CREATE TABLE "integrity_attestation_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "attestationTarget" TEXT NOT NULL,
    "targetRecordId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "attestedBy" TEXT NOT NULL,
    "attestationResult" TEXT NOT NULL,
    "linkedProofId" TEXT,
    "expiresAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integrity_attestation_records_pkey" PRIMARY KEY ("id")
);

-- 3. Reproducibility Proofs
CREATE TABLE "reproducibility_proofs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "layerName" TEXT NOT NULL,
    "originalRunHash" TEXT NOT NULL,
    "reproductionRunHash" TEXT NOT NULL,
    "hashesMatch" BOOLEAN NOT NULL DEFAULT false,
    "inputParametersHash" TEXT NOT NULL,
    "reproductionTimestamp" TEXT NOT NULL,
    "executionDuration" INTEGER NOT NULL DEFAULT 0,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reproducibility_proofs_pkey" PRIMARY KEY ("id")
);

-- 4. Verification Chain Manifests
CREATE TABLE "verification_chain_manifests" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "chainLength" INTEGER NOT NULL DEFAULT 0,
    "chainEntries" TEXT NOT NULL,
    "chainHash" TEXT NOT NULL,
    "chainComplete" BOOLEAN NOT NULL DEFAULT false,
    "brokenLinks" TEXT,
    "firstEntryId" TEXT,
    "lastEntryId" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_chain_manifests_pkey" PRIMARY KEY ("id")
);

-- 5. Independent Audit Verifications
CREATE TABLE "independent_audit_verifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "auditType" TEXT NOT NULL,
    "auditorId" TEXT NOT NULL,
    "scopeDescription" TEXT NOT NULL,
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "criticalFindings" INTEGER NOT NULL DEFAULT 0,
    "evidenceReviewed" INTEGER NOT NULL DEFAULT 0,
    "auditResult" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "independent_audit_verifications_pkey" PRIMARY KEY ("id")
);

-- 6. Formal Validation Checkpoints
CREATE TABLE "formal_validation_checkpoints" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "checkpointName" TEXT NOT NULL,
    "checkpointType" TEXT NOT NULL,
    "validationsPassed" INTEGER NOT NULL DEFAULT 0,
    "validationsFailed" INTEGER NOT NULL DEFAULT 0,
    "stateHash" TEXT NOT NULL,
    "checkpointStatus" TEXT NOT NULL,
    "restorable" BOOLEAN NOT NULL DEFAULT true,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "formal_validation_checkpoints_pkey" PRIMARY KEY ("id")
);

-- 7. Trust Assurance Certifications
CREATE TABLE "trust_assurance_certifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "certificationScope" TEXT NOT NULL,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "rulesEvaluated" INTEGER NOT NULL DEFAULT 0,
    "rulesPassed" INTEGER NOT NULL DEFAULT 0,
    "rulesFailed" INTEGER NOT NULL DEFAULT 0,
    "certificationStatus" TEXT NOT NULL,
    "certifiedBy" TEXT,
    "certifiedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trust_assurance_certifications_pkey" PRIMARY KEY ("id")
);

-- 8. Cross-Layer Verification Syncs
CREATE TABLE "cross_layer_verification_syncs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceLayer" TEXT NOT NULL,
    "targetLayer" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "targetHash" TEXT NOT NULL,
    "syncConsistent" BOOLEAN NOT NULL DEFAULT false,
    "recordsCompared" INTEGER NOT NULL DEFAULT 0,
    "discrepancies" TEXT,
    "lastSyncedAt" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cross_layer_verification_syncs_pkey" PRIMARY KEY ("id")
);

-- 9. Verification Replay Records
CREATE TABLE "verification_replay_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "replayScope" TEXT NOT NULL,
    "originalHash" TEXT NOT NULL,
    "replayHash" TEXT NOT NULL,
    "hashesMatch" BOOLEAN NOT NULL DEFAULT false,
    "replayDuration" INTEGER NOT NULL DEFAULT 0,
    "recordsReplayed" INTEGER NOT NULL DEFAULT 0,
    "discrepancyDetails" TEXT,
    "replayedAt" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_replay_records_pkey" PRIMARY KEY ("id")
);

-- 10. Defensibility Certification Records
CREATE TABLE "defensibility_certification_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "defensibilityScope" TEXT NOT NULL,
    "evidenceRecordsCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedRecordsCount" INTEGER NOT NULL DEFAULT 0,
    "defensibilityRate" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "integrityChainValid" BOOLEAN NOT NULL DEFAULT false,
    "certificationStatus" TEXT NOT NULL,
    "certifiedBy" TEXT,
    "certifiedAt" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "defensibility_certification_records_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "deterministic_verification_proofs_caseId_idx" ON "deterministic_verification_proofs"("caseId");
CREATE INDEX "deterministic_verification_proofs_proofType_idx" ON "deterministic_verification_proofs"("proofType");
CREATE INDEX "deterministic_verification_proofs_proofResult_idx" ON "deterministic_verification_proofs"("proofResult");

CREATE INDEX "integrity_attestation_records_caseId_idx" ON "integrity_attestation_records"("caseId");
CREATE INDEX "integrity_attestation_records_attestationTarget_idx" ON "integrity_attestation_records"("attestationTarget");
CREATE INDEX "integrity_attestation_records_attestationResult_idx" ON "integrity_attestation_records"("attestationResult");

CREATE INDEX "reproducibility_proofs_caseId_idx" ON "reproducibility_proofs"("caseId");
CREATE INDEX "reproducibility_proofs_layerName_idx" ON "reproducibility_proofs"("layerName");
CREATE INDEX "reproducibility_proofs_hashesMatch_idx" ON "reproducibility_proofs"("hashesMatch");

CREATE INDEX "verification_chain_manifests_caseId_idx" ON "verification_chain_manifests"("caseId");
CREATE INDEX "verification_chain_manifests_chainComplete_idx" ON "verification_chain_manifests"("chainComplete");

CREATE INDEX "independent_audit_verifications_caseId_idx" ON "independent_audit_verifications"("caseId");
CREATE INDEX "independent_audit_verifications_auditType_idx" ON "independent_audit_verifications"("auditType");
CREATE INDEX "independent_audit_verifications_auditResult_idx" ON "independent_audit_verifications"("auditResult");

CREATE INDEX "formal_validation_checkpoints_caseId_idx" ON "formal_validation_checkpoints"("caseId");
CREATE INDEX "formal_validation_checkpoints_checkpointType_idx" ON "formal_validation_checkpoints"("checkpointType");
CREATE INDEX "formal_validation_checkpoints_checkpointStatus_idx" ON "formal_validation_checkpoints"("checkpointStatus");

CREATE INDEX "trust_assurance_certifications_caseId_idx" ON "trust_assurance_certifications"("caseId");
CREATE INDEX "trust_assurance_certifications_certificationScope_idx" ON "trust_assurance_certifications"("certificationScope");
CREATE INDEX "trust_assurance_certifications_certificationStatus_idx" ON "trust_assurance_certifications"("certificationStatus");

CREATE INDEX "cross_layer_verification_syncs_caseId_idx" ON "cross_layer_verification_syncs"("caseId");
CREATE INDEX "cross_layer_verification_syncs_sourceLayer_idx" ON "cross_layer_verification_syncs"("sourceLayer");
CREATE INDEX "cross_layer_verification_syncs_syncConsistent_idx" ON "cross_layer_verification_syncs"("syncConsistent");

CREATE INDEX "verification_replay_records_caseId_idx" ON "verification_replay_records"("caseId");
CREATE INDEX "verification_replay_records_replayScope_idx" ON "verification_replay_records"("replayScope");
CREATE INDEX "verification_replay_records_hashesMatch_idx" ON "verification_replay_records"("hashesMatch");

CREATE INDEX "defensibility_certification_records_caseId_idx" ON "defensibility_certification_records"("caseId");
CREATE INDEX "defensibility_certification_records_defensibilityScope_idx" ON "defensibility_certification_records"("defensibilityScope");
CREATE INDEX "defensibility_certification_records_certificationStatus_idx" ON "defensibility_certification_records"("certificationStatus");
