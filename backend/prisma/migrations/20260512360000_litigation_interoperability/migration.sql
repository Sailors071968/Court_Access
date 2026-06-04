-- Phase I.1: Judicial / Evidentiary Interoperability + Litigation Exchange Framework
-- 10 tables for export packages, court documents, interchange manifests, package verification,
-- custody exports, multi-format exports, exhibit bundles, external verification,
-- archive packaging, and provenance manifests. Additive only.

-- 1. Standardized Export Packages
CREATE TABLE "standardized_export_packages" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "packageType" TEXT NOT NULL,
    "exportFormat" TEXT NOT NULL,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "layersIncluded" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "packageSizeBytes" INTEGER NOT NULL DEFAULT 0,
    "generatedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "standardized_export_packages_pkey" PRIMARY KEY ("id")
);

-- 2. Court-Compatible Documents
CREATE TABLE "court_compatible_documents" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentSummary" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT NOT NULL,
    "courtFormat" TEXT NOT NULL,
    "complianceStatus" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "court_compatible_documents_pkey" PRIMARY KEY ("id")
);

-- 3. Litigation Interchange Manifests
CREATE TABLE "litigation_interchange_manifests" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "manifestVersion" TEXT NOT NULL DEFAULT '1.0',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "itemInventory" TEXT NOT NULL,
    "integrityHash" TEXT NOT NULL,
    "generatedAt" TEXT NOT NULL,
    "expiresAt" TEXT,
    "recipientType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "litigation_interchange_manifests_pkey" PRIMARY KEY ("id")
);

-- 4. Evidence Package Verification
CREATE TABLE "evidence_package_verifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "verificationMethod" TEXT NOT NULL,
    "expectedHash" TEXT NOT NULL,
    "actualHash" TEXT NOT NULL,
    "hashMatch" BOOLEAN NOT NULL DEFAULT true,
    "expectedRecordCount" INTEGER NOT NULL DEFAULT 0,
    "actualRecordCount" INTEGER NOT NULL DEFAULT 0,
    "countMatch" BOOLEAN NOT NULL DEFAULT true,
    "discrepancies" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_package_verifications_pkey" PRIMARY KEY ("id")
);

-- 5. External Chain-of-Custody Export
CREATE TABLE "external_chain_of_custody_exports" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "custodyChain" TEXT NOT NULL,
    "totalTransfers" INTEGER NOT NULL DEFAULT 0,
    "chainIntegrityHash" TEXT NOT NULL,
    "exportFormat" TEXT NOT NULL,
    "chainComplete" BOOLEAN NOT NULL DEFAULT true,
    "gapDetected" BOOLEAN NOT NULL DEFAULT false,
    "gapDetails" TEXT,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_chain_of_custody_exports_pkey" PRIMARY KEY ("id")
);

-- 6. Multi-Format Litigation Export
CREATE TABLE "multi_format_litigation_exports" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceLayer" TEXT NOT NULL,
    "exportFormat" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT NOT NULL,
    "formatCompliance" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "exportedFields" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "multi_format_litigation_exports_pkey" PRIMARY KEY ("id")
);

-- 7. Exhibit Bundle Validation
CREATE TABLE "exhibit_bundle_validations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "bundleType" TEXT NOT NULL,
    "totalExhibits" INTEGER NOT NULL DEFAULT 0,
    "validatedExhibits" INTEGER NOT NULL DEFAULT 0,
    "failedExhibits" INTEGER NOT NULL DEFAULT 0,
    "exhibitInventory" TEXT NOT NULL,
    "bundleHash" TEXT NOT NULL,
    "sequenceValid" BOOLEAN NOT NULL DEFAULT true,
    "crossReferenceValid" BOOLEAN NOT NULL DEFAULT true,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exhibit_bundle_validations_pkey" PRIMARY KEY ("id")
);

-- 8. External Integrity Verification
CREATE TABLE "external_integrity_verifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "verificationTarget" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "verifierType" TEXT NOT NULL,
    "integrityPassed" BOOLEAN NOT NULL DEFAULT true,
    "checksPerformed" TEXT NOT NULL,
    "failedChecks" TEXT,
    "verificationTimestamp" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_integrity_verifications_pkey" PRIMARY KEY ("id")
);

-- 9. Litigation Archive Packages
CREATE TABLE "litigation_archive_packages" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "archiveType" TEXT NOT NULL,
    "archiveScope" TEXT,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "totalSizeBytes" INTEGER NOT NULL DEFAULT 0,
    "archiveHash" TEXT NOT NULL,
    "compressionMethod" TEXT NOT NULL,
    "retentionPeriod" TEXT,
    "archiveStatus" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "litigation_archive_packages_pkey" PRIMARY KEY ("id")
);

-- 10. Export Provenance Manifests
CREATE TABLE "export_provenance_manifests" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "exportId" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "provenanceChain" TEXT NOT NULL,
    "originLayer" TEXT NOT NULL,
    "originRecordCount" INTEGER NOT NULL DEFAULT 0,
    "transformationSteps" INTEGER NOT NULL DEFAULT 0,
    "finalHash" TEXT NOT NULL,
    "chainVerified" BOOLEAN NOT NULL DEFAULT true,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "export_provenance_manifests_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "standardized_export_packages_caseId_idx" ON "standardized_export_packages"("caseId");
CREATE INDEX "standardized_export_packages_packageType_idx" ON "standardized_export_packages"("packageType");
CREATE INDEX "standardized_export_packages_status_idx" ON "standardized_export_packages"("status");

CREATE INDEX "court_compatible_documents_caseId_idx" ON "court_compatible_documents"("caseId");
CREATE INDEX "court_compatible_documents_documentType_idx" ON "court_compatible_documents"("documentType");
CREATE INDEX "court_compatible_documents_courtFormat_idx" ON "court_compatible_documents"("courtFormat");

CREATE INDEX "litigation_interchange_manifests_caseId_idx" ON "litigation_interchange_manifests"("caseId");
CREATE INDEX "litigation_interchange_manifests_recipientType_idx" ON "litigation_interchange_manifests"("recipientType");
CREATE INDEX "litigation_interchange_manifests_status_idx" ON "litigation_interchange_manifests"("status");

CREATE INDEX "evidence_package_verifications_caseId_idx" ON "evidence_package_verifications"("caseId");
CREATE INDEX "evidence_package_verifications_packageId_idx" ON "evidence_package_verifications"("packageId");
CREATE INDEX "evidence_package_verifications_hashMatch_idx" ON "evidence_package_verifications"("hashMatch");

CREATE INDEX "external_chain_of_custody_exports_caseId_idx" ON "external_chain_of_custody_exports"("caseId");
CREATE INDEX "external_chain_of_custody_exports_evidenceId_idx" ON "external_chain_of_custody_exports"("evidenceId");
CREATE INDEX "external_chain_of_custody_exports_chainComplete_idx" ON "external_chain_of_custody_exports"("chainComplete");

CREATE INDEX "multi_format_litigation_exports_caseId_idx" ON "multi_format_litigation_exports"("caseId");
CREATE INDEX "multi_format_litigation_exports_sourceLayer_idx" ON "multi_format_litigation_exports"("sourceLayer");
CREATE INDEX "multi_format_litigation_exports_exportFormat_idx" ON "multi_format_litigation_exports"("exportFormat");

CREATE INDEX "exhibit_bundle_validations_caseId_idx" ON "exhibit_bundle_validations"("caseId");
CREATE INDEX "exhibit_bundle_validations_bundleType_idx" ON "exhibit_bundle_validations"("bundleType");

CREATE INDEX "external_integrity_verifications_caseId_idx" ON "external_integrity_verifications"("caseId");
CREATE INDEX "external_integrity_verifications_verificationTarget_idx" ON "external_integrity_verifications"("verificationTarget");
CREATE INDEX "external_integrity_verifications_integrityPassed_idx" ON "external_integrity_verifications"("integrityPassed");

CREATE INDEX "litigation_archive_packages_caseId_idx" ON "litigation_archive_packages"("caseId");
CREATE INDEX "litigation_archive_packages_archiveType_idx" ON "litigation_archive_packages"("archiveType");
CREATE INDEX "litigation_archive_packages_archiveStatus_idx" ON "litigation_archive_packages"("archiveStatus");

CREATE INDEX "export_provenance_manifests_caseId_idx" ON "export_provenance_manifests"("caseId");
CREATE INDEX "export_provenance_manifests_exportId_idx" ON "export_provenance_manifests"("exportId");
CREATE INDEX "export_provenance_manifests_exportType_idx" ON "export_provenance_manifests"("exportType");
