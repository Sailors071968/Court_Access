-- CreateTable
CREATE TABLE "corpus_ingestion_state" (
    "id" TEXT NOT NULL,
    "corpusName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "lastProcessedOffset" INTEGER NOT NULL DEFAULT 0,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "totalRecords" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corpus_ingestion_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_ingestion_log" (
    "id" TEXT NOT NULL,
    "corpusName" TEXT NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "recordsInserted" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corpus_ingestion_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "corpusName" TEXT,
    "sourceFile" TEXT,
    "contentHash" TEXT NOT NULL,
    "corpusVersion" TEXT,
    "documentVersion" TEXT NOT NULL DEFAULT '1.0',
    "supersededBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_registry" (
    "id" TEXT NOT NULL,
    "corpusName" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "sourceAuthority" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "releaseDate" TIMESTAMP(3),
    "ingestionStatus" TEXT NOT NULL DEFAULT 'pending',
    "totalDocuments" INTEGER NOT NULL DEFAULT 0,
    "totalBytes" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corpus_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_ingestion_lock" (
    "id" TEXT NOT NULL,
    "corpusName" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,

    CONSTRAINT "corpus_ingestion_lock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "corpus_ingestion_state_corpusName_idx" ON "corpus_ingestion_state"("corpusName");

-- CreateIndex
CREATE INDEX "corpus_ingestion_state_status_idx" ON "corpus_ingestion_state"("status");

-- CreateIndex
CREATE UNIQUE INDEX "corpus_ingestion_state_corpusName_fileName_key" ON "corpus_ingestion_state"("corpusName", "fileName");

-- CreateIndex
CREATE INDEX "corpus_ingestion_log_corpusName_idx" ON "corpus_ingestion_log"("corpusName");

-- CreateIndex
CREATE INDEX "corpus_ingestion_log_timestamp_idx" ON "corpus_ingestion_log"("timestamp");

-- CreateIndex
CREATE INDEX "legal_documents_tenantId_idx" ON "legal_documents"("tenantId");

-- CreateIndex
CREATE INDEX "legal_documents_documentType_idx" ON "legal_documents"("documentType");

-- CreateIndex
CREATE INDEX "legal_documents_corpusName_idx" ON "legal_documents"("corpusName");

-- CreateIndex
CREATE INDEX "legal_documents_jurisdiction_idx" ON "legal_documents"("jurisdiction");

-- CreateIndex
CREATE INDEX "legal_documents_contentHash_idx" ON "legal_documents"("contentHash");

-- CreateIndex
CREATE INDEX "legal_documents_supersededBy_idx" ON "legal_documents"("supersededBy");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_contentHash_tenantId_key" ON "legal_documents"("contentHash", "tenantId");

-- CreateIndex
CREATE INDEX "corpus_registry_corpusName_idx" ON "corpus_registry"("corpusName");

-- CreateIndex
CREATE INDEX "corpus_registry_jurisdiction_idx" ON "corpus_registry"("jurisdiction");

-- CreateIndex
CREATE INDEX "corpus_registry_ingestionStatus_idx" ON "corpus_registry"("ingestionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "corpus_registry_corpusName_version_key" ON "corpus_registry"("corpusName", "version");

-- CreateIndex
CREATE UNIQUE INDEX "corpus_ingestion_lock_corpusName_key" ON "corpus_ingestion_lock"("corpusName");

-- CreateIndex
CREATE INDEX "corpus_ingestion_lock_corpusName_idx" ON "corpus_ingestion_lock"("corpusName");

-- CreateIndex
CREATE INDEX "corpus_ingestion_lock_expiresAt_idx" ON "corpus_ingestion_lock"("expiresAt");
