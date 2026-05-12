-- Phase D.1: Evidence Segmentation — Document, Page, Citation, Speaker, Timestamp models
-- Extends EvidenceStatement with additional fields for full citation preservation

-- EvidenceDocument
CREATE TABLE "evidence_documents" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evidenceId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "totalLines" INTEGER NOT NULL DEFAULT 0,
    "totalStatements" INTEGER NOT NULL DEFAULT 0,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "hash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_documents_pkey" PRIMARY KEY ("id")
);

-- EvidencePage
CREATE TABLE "evidence_pages" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "totalLines" INTEGER NOT NULL DEFAULT 0,
    "rawContent" TEXT NOT NULL,
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pages_pkey" PRIMARY KEY ("id")
);

-- StatementCitation
CREATE TABLE "statement_citations" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "citationType" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    "paragraphIndex" INTEGER,
    "exhibitRef" TEXT,
    "batesNumber" TEXT,
    "rawReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statement_citations_pkey" PRIMARY KEY ("id")
);

-- StatementSpeaker
CREATE TABLE "statement_speakers" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "speakerName" TEXT NOT NULL,
    "speakerRole" TEXT,
    "speakerConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "detectionMethod" TEXT NOT NULL DEFAULT 'pattern',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statement_speakers_pkey" PRIMARY KEY ("id")
);

-- StatementTimestamp
CREATE TABLE "statement_timestamps" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "rawTimestamp" TEXT NOT NULL,
    "normalizedTime" TEXT,
    "timestampType" TEXT NOT NULL DEFAULT 'event',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statement_timestamps_pkey" PRIMARY KEY ("id")
);

-- Extend evidence_statements with new D.1 columns (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'evidence_statements' AND column_name = 'documentId') THEN
    ALTER TABLE "evidence_statements" ADD COLUMN "documentId" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'evidence_statements' AND column_name = 'paragraphIndex') THEN
    ALTER TABLE "evidence_statements" ADD COLUMN "paragraphIndex" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'evidence_statements' AND column_name = 'exactText') THEN
    ALTER TABLE "evidence_statements" ADD COLUMN "exactText" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'evidence_statements' AND column_name = 'statementType') THEN
    ALTER TABLE "evidence_statements" ADD COLUMN "statementType" TEXT NOT NULL DEFAULT 'narrative';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'evidence_statements' AND column_name = 'hash') THEN
    ALTER TABLE "evidence_statements" ADD COLUMN "hash" TEXT;
  END IF;
END $$;

-- Indexes: evidence_documents
CREATE INDEX "evidence_documents_caseId_idx" ON "evidence_documents"("caseId");
CREATE INDEX "evidence_documents_tenantId_idx" ON "evidence_documents"("tenantId");
CREATE INDEX "evidence_documents_evidenceId_idx" ON "evidence_documents"("evidenceId");
CREATE INDEX "evidence_documents_documentType_idx" ON "evidence_documents"("documentType");
CREATE INDEX "evidence_documents_processingStatus_idx" ON "evidence_documents"("processingStatus");

-- Indexes: evidence_pages
CREATE UNIQUE INDEX "evidence_pages_documentId_pageNumber_key" ON "evidence_pages"("documentId", "pageNumber");
CREATE INDEX "evidence_pages_documentId_idx" ON "evidence_pages"("documentId");

-- Indexes: statement_citations
CREATE INDEX "statement_citations_statementId_idx" ON "statement_citations"("statementId");
CREATE INDEX "statement_citations_citationType_idx" ON "statement_citations"("citationType");

-- Indexes: statement_speakers
CREATE INDEX "statement_speakers_statementId_idx" ON "statement_speakers"("statementId");
CREATE INDEX "statement_speakers_speakerName_idx" ON "statement_speakers"("speakerName");
CREATE INDEX "statement_speakers_speakerRole_idx" ON "statement_speakers"("speakerRole");

-- Indexes: statement_timestamps
CREATE INDEX "statement_timestamps_statementId_idx" ON "statement_timestamps"("statementId");
CREATE INDEX "statement_timestamps_timestampType_idx" ON "statement_timestamps"("timestampType");

-- Indexes: evidence_statements (new columns)
CREATE INDEX IF NOT EXISTS "evidence_statements_documentId_idx" ON "evidence_statements"("documentId");
CREATE INDEX IF NOT EXISTS "evidence_statements_statementType_idx" ON "evidence_statements"("statementType");
CREATE INDEX IF NOT EXISTS "evidence_statements_hash_idx" ON "evidence_statements"("hash");

-- Foreign Keys: evidence_pages → evidence_documents
ALTER TABLE "evidence_pages" ADD CONSTRAINT "evidence_pages_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "evidence_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign Keys: evidence_statements → evidence_documents (optional)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_statements_documentId_fkey') THEN
    ALTER TABLE "evidence_statements" ADD CONSTRAINT "evidence_statements_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "evidence_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Foreign Keys: statement_citations → evidence_statements
ALTER TABLE "statement_citations" ADD CONSTRAINT "statement_citations_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "evidence_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign Keys: statement_speakers → evidence_statements
ALTER TABLE "statement_speakers" ADD CONSTRAINT "statement_speakers_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "evidence_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign Keys: statement_timestamps → evidence_statements
ALTER TABLE "statement_timestamps" ADD CONSTRAINT "statement_timestamps_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "evidence_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
