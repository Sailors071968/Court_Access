-- CreateTable
CREATE TABLE "DocumentEntity" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityValue" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sourceContext" TEXT NOT NULL DEFAULT '',
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityIndex" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityValue" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL DEFAULT '',
    "documentId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "firstSeenTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "eventType" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "description" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptStatement" (
    "id" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL DEFAULT 0,
    "statementText" TEXT NOT NULL,
    "statementType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceConflict" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "documentA" TEXT NOT NULL,
    "documentB" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "conflictType" TEXT NOT NULL DEFAULT 'contradiction',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentEntity_documentId_idx" ON "DocumentEntity"("documentId");

-- CreateIndex
CREATE INDEX "DocumentEntity_caseId_idx" ON "DocumentEntity"("caseId");

-- CreateIndex
CREATE INDEX "DocumentEntity_entityType_idx" ON "DocumentEntity"("entityType");

-- CreateIndex
CREATE INDEX "DocumentEntity_entityValue_idx" ON "DocumentEntity"("entityValue");

-- CreateIndex
CREATE INDEX "EntityIndex_entityType_idx" ON "EntityIndex"("entityType");

-- CreateIndex
CREATE INDEX "EntityIndex_entityValue_idx" ON "EntityIndex"("entityValue");

-- CreateIndex
CREATE INDEX "EntityIndex_normalizedValue_idx" ON "EntityIndex"("normalizedValue");

-- CreateIndex
CREATE INDEX "EntityIndex_documentId_idx" ON "EntityIndex"("documentId");

-- CreateIndex
CREATE INDEX "EntityIndex_caseId_idx" ON "EntityIndex"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityIndex_entityType_normalizedValue_documentId_key" ON "EntityIndex"("entityType", "normalizedValue", "documentId");

-- CreateIndex
CREATE INDEX "CaseEvent_caseId_idx" ON "CaseEvent"("caseId");

-- CreateIndex
CREATE INDEX "CaseEvent_timestamp_idx" ON "CaseEvent"("timestamp");

-- CreateIndex
CREATE INDEX "CaseEvent_eventType_idx" ON "CaseEvent"("eventType");

-- CreateIndex
CREATE INDEX "CaseEvent_sourceDocumentId_idx" ON "CaseEvent"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "TranscriptStatement_transcriptId_idx" ON "TranscriptStatement"("transcriptId");

-- CreateIndex
CREATE INDEX "TranscriptStatement_caseId_idx" ON "TranscriptStatement"("caseId");

-- CreateIndex
CREATE INDEX "TranscriptStatement_speaker_idx" ON "TranscriptStatement"("speaker");

-- CreateIndex
CREATE INDEX "TranscriptStatement_statementType_idx" ON "TranscriptStatement"("statementType");

-- CreateIndex
CREATE INDEX "EvidenceConflict_caseId_idx" ON "EvidenceConflict"("caseId");

-- CreateIndex
CREATE INDEX "EvidenceConflict_entity_idx" ON "EvidenceConflict"("entity");

-- CreateIndex
CREATE INDEX "EvidenceConflict_conflictType_idx" ON "EvidenceConflict"("conflictType");
