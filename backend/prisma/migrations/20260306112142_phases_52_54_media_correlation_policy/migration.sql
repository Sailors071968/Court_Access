-- CreateTable
CREATE TABLE "MediaTranscript" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "speakerLabel" TEXT NOT NULL DEFAULT '',
    "startTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "endTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transcriptText" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "language" TEXT NOT NULL DEFAULT 'en',
    "modelVersion" TEXT NOT NULL DEFAULT 'whisper-1',
    "fullTranscript" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceCorrelation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceEvidenceId" TEXT NOT NULL,
    "relatedEvidenceId" TEXT NOT NULL,
    "correlationType" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "description" TEXT NOT NULL,
    "sourceSnippet" TEXT NOT NULL DEFAULT '',
    "relatedSnippet" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceCorrelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyDocument" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "sections" JSONB NOT NULL DEFAULT '[]',
    "uploadedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyComplianceFinding" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "policyDocumentId" TEXT NOT NULL,
    "policySection" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyComplianceFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaTranscript_evidenceId_idx" ON "MediaTranscript"("evidenceId");

-- CreateIndex
CREATE INDEX "MediaTranscript_caseId_idx" ON "MediaTranscript"("caseId");

-- CreateIndex
CREATE INDEX "MediaTranscript_caseId_evidenceId_idx" ON "MediaTranscript"("caseId", "evidenceId");

-- CreateIndex
CREATE INDEX "MediaTranscript_status_idx" ON "MediaTranscript"("status");

-- CreateIndex
CREATE INDEX "EvidenceCorrelation_caseId_idx" ON "EvidenceCorrelation"("caseId");

-- CreateIndex
CREATE INDEX "EvidenceCorrelation_sourceEvidenceId_idx" ON "EvidenceCorrelation"("sourceEvidenceId");

-- CreateIndex
CREATE INDEX "EvidenceCorrelation_relatedEvidenceId_idx" ON "EvidenceCorrelation"("relatedEvidenceId");

-- CreateIndex
CREATE INDEX "EvidenceCorrelation_caseId_correlationType_idx" ON "EvidenceCorrelation"("caseId", "correlationType");

-- CreateIndex
CREATE INDEX "PolicyDocument_caseId_idx" ON "PolicyDocument"("caseId");

-- CreateIndex
CREATE INDEX "PolicyDocument_caseId_documentType_idx" ON "PolicyDocument"("caseId", "documentType");

-- CreateIndex
CREATE INDEX "PolicyComplianceFinding_caseId_idx" ON "PolicyComplianceFinding"("caseId");

-- CreateIndex
CREATE INDEX "PolicyComplianceFinding_evidenceId_idx" ON "PolicyComplianceFinding"("evidenceId");

-- CreateIndex
CREATE INDEX "PolicyComplianceFinding_policyDocumentId_idx" ON "PolicyComplianceFinding"("policyDocumentId");

-- CreateIndex
CREATE INDEX "PolicyComplianceFinding_caseId_severity_idx" ON "PolicyComplianceFinding"("caseId", "severity");

-- AddForeignKey
ALTER TABLE "PolicyComplianceFinding" ADD CONSTRAINT "PolicyComplianceFinding_policyDocumentId_fkey" FOREIGN KEY ("policyDocumentId") REFERENCES "PolicyDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
