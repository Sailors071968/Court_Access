-- AddUniqueConstraint
CREATE UNIQUE INDEX "EvidenceReference_caseId_tenantId_sourceDocumentId_referenc_key" ON "EvidenceReference"("caseId", "tenantId", "sourceDocumentId", "referenceType", "referenceValue");
