-- Epic 2A-004: StatuteRecord schema extension on legal_documents
ALTER TABLE "legal_documents" ADD COLUMN IF NOT EXISTS "statuteCode" TEXT;
ALTER TABLE "legal_documents" ADD COLUMN IF NOT EXISTS "statuteSection" TEXT;
ALTER TABLE "legal_documents" ADD COLUMN IF NOT EXISTS "statuteHierarchy" TEXT;
ALTER TABLE "legal_documents" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;
ALTER TABLE "legal_documents" ADD COLUMN IF NOT EXISTS "retrievedAt" TIMESTAMP(3);
ALTER TABLE "legal_documents" ADD COLUMN IF NOT EXISTS "effectiveDate" TEXT;
ALTER TABLE "legal_documents" ADD COLUMN IF NOT EXISTS "extractionAudit" TEXT;

CREATE INDEX IF NOT EXISTS "legal_documents_statuteCode_statuteSection_idx"
  ON "legal_documents"("statuteCode", "statuteSection");
