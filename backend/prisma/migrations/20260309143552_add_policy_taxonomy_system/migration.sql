-- CreateTable
CREATE TABLE "agencies" (
    "agencyId" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "agencyType" TEXT,
    "city" TEXT,
    "county" TEXT,
    "populationEstimate" INTEGER,
    "jurisdictionRank" INTEGER,
    "website" TEXT,
    "postDirectoryUrl" TEXT,
    "recordsRequestUrl" TEXT,
    "policyCollectionUrl" TEXT,
    "policiesDiscovered" BOOLEAN NOT NULL DEFAULT false,
    "crawlStatus" TEXT NOT NULL DEFAULT 'pending',
    "crawlError" TEXT,
    "lastCrawledAt" TIMESTAMP(3),
    "pagesFound" INTEGER NOT NULL DEFAULT 0,
    "policyPagesFound" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("agencyId")
);

-- CreateTable
CREATE TABLE "policy_topics" (
    "id" TEXT NOT NULL,
    "topicName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "description" TEXT,
    "chpReference" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_documents" (
    "documentId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "topicId" TEXT,
    "documentType" TEXT,
    "title" TEXT,
    "policyNumber" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "s3Url" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "textExtracted" BOOLEAN NOT NULL DEFAULT false,
    "textContent" TEXT,
    "ocrStatus" TEXT NOT NULL DEFAULT 'pending',
    "ocrError" TEXT,
    "classificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "classificationScore" DOUBLE PRECISION,
    "isChpCanonical" BOOLEAN NOT NULL DEFAULT false,
    "matchedTopicConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_documents_pkey" PRIMARY KEY ("documentId")
);

-- CreateTable
CREATE TABLE "policy_coverage" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "policyFound" BOOLEAN NOT NULL DEFAULT false,
    "documentId" TEXT,
    "sourceUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_coverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agencies_county_idx" ON "agencies"("county");

-- CreateIndex
CREATE INDEX "agencies_agencyType_idx" ON "agencies"("agencyType");

-- CreateIndex
CREATE INDEX "agencies_crawlStatus_idx" ON "agencies"("crawlStatus");

-- CreateIndex
CREATE INDEX "agencies_jurisdictionRank_idx" ON "agencies"("jurisdictionRank");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_agencyName_county_key" ON "agencies"("agencyName", "county");

-- CreateIndex
CREATE UNIQUE INDEX "policy_topics_topicName_key" ON "policy_topics"("topicName");

-- CreateIndex
CREATE INDEX "policy_topics_category_idx" ON "policy_topics"("category");

-- CreateIndex
CREATE INDEX "policy_documents_agencyId_idx" ON "policy_documents"("agencyId");

-- CreateIndex
CREATE INDEX "policy_documents_topicId_idx" ON "policy_documents"("topicId");

-- CreateIndex
CREATE INDEX "policy_documents_documentType_idx" ON "policy_documents"("documentType");

-- CreateIndex
CREATE INDEX "policy_documents_ocrStatus_idx" ON "policy_documents"("ocrStatus");

-- CreateIndex
CREATE INDEX "policy_documents_classificationStatus_idx" ON "policy_documents"("classificationStatus");

-- CreateIndex
CREATE INDEX "policy_documents_isChpCanonical_idx" ON "policy_documents"("isChpCanonical");

-- CreateIndex
CREATE INDEX "policy_coverage_agencyId_idx" ON "policy_coverage"("agencyId");

-- CreateIndex
CREATE INDEX "policy_coverage_topicId_idx" ON "policy_coverage"("topicId");

-- CreateIndex
CREATE INDEX "policy_coverage_policyFound_idx" ON "policy_coverage"("policyFound");

-- CreateIndex
CREATE UNIQUE INDEX "policy_coverage_agencyId_topicId_key" ON "policy_coverage"("agencyId", "topicId");

-- AddForeignKey
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("agencyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "policy_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_coverage" ADD CONSTRAINT "policy_coverage_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("agencyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_coverage" ADD CONSTRAINT "policy_coverage_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "policy_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
