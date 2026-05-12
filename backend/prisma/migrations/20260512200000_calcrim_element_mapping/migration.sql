-- Phase D.2: CALCRIM Element Mapping — deterministic statement-to-element mapping
-- Additive only. No existing tables modified.

-- CalcrimElementMapping
CREATE TABLE "calcrim_element_mappings" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "mappingMethod" TEXT NOT NULL DEFAULT 'lexical',
    "lexicalTriggers" TEXT,
    "semanticCategory" TEXT,
    "prosecutorTheoryWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "evidenceClassification" TEXT NOT NULL DEFAULT 'act',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calcrim_element_mappings_pkey" PRIMARY KEY ("id")
);

-- CalcrimNarrativeCluster
CREATE TABLE "calcrim_narrative_clusters" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "narrativeType" TEXT NOT NULL,
    "prosecutionTheory" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalStatements" INTEGER NOT NULL DEFAULT 0,
    "elementsCovered" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calcrim_narrative_clusters_pkey" PRIMARY KEY ("id")
);

-- NarrativeClusterStatement
CREATE TABLE "narrative_cluster_statements" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "narrative_cluster_statements_pkey" PRIMARY KEY ("id")
);

-- Indexes: calcrim_element_mappings
CREATE INDEX "calcrim_element_mappings_statementId_idx" ON "calcrim_element_mappings"("statementId");
CREATE INDEX "calcrim_element_mappings_instructionId_idx" ON "calcrim_element_mappings"("instructionId");
CREATE INDEX "calcrim_element_mappings_elementId_idx" ON "calcrim_element_mappings"("elementId");
CREATE INDEX "calcrim_element_mappings_semanticCategory_idx" ON "calcrim_element_mappings"("semanticCategory");
CREATE INDEX "calcrim_element_mappings_evidenceClassification_idx" ON "calcrim_element_mappings"("evidenceClassification");
CREATE INDEX "calcrim_element_mappings_confidence_idx" ON "calcrim_element_mappings"("confidence");

-- Indexes: calcrim_narrative_clusters
CREATE INDEX "calcrim_narrative_clusters_caseId_idx" ON "calcrim_narrative_clusters"("caseId");
CREATE INDEX "calcrim_narrative_clusters_instructionId_idx" ON "calcrim_narrative_clusters"("instructionId");
CREATE INDEX "calcrim_narrative_clusters_narrativeType_idx" ON "calcrim_narrative_clusters"("narrativeType");

-- Indexes: narrative_cluster_statements
CREATE UNIQUE INDEX "narrative_cluster_statements_clusterId_statementId_key" ON "narrative_cluster_statements"("clusterId", "statementId");
CREATE INDEX "narrative_cluster_statements_clusterId_idx" ON "narrative_cluster_statements"("clusterId");
CREATE INDEX "narrative_cluster_statements_statementId_idx" ON "narrative_cluster_statements"("statementId");

-- Foreign Key: narrative_cluster_statements → calcrim_narrative_clusters
ALTER TABLE "narrative_cluster_statements" ADD CONSTRAINT "narrative_cluster_statements_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "calcrim_narrative_clusters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
