-- Phase F.1: Unified Criminal Defense Intelligence Graph + Cross-Case Pattern Engine
-- 10 tables for graph nodes/edges, cross-case witness/forensic/contradiction indexing,
-- prosecutor theory recurrence, Brady patterns, LE credibility, evidence provenance, timeline correlation.
-- Additive only — no existing tables modified.

-- 1. Intelligence Graph Node
CREATE TABLE "intelligence_graph_nodes" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "sourceTable" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_graph_nodes_pkey" PRIMARY KEY ("id")
);

-- 2. Intelligence Graph Edge
CREATE TABLE "intelligence_graph_edges" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "edgeType" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_graph_edges_pkey" PRIMARY KEY ("id")
);

-- 3. Cross-Case Witness Index
CREATE TABLE "cross_case_witness_indexes" (
    "id" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "caseIds" TEXT NOT NULL,
    "totalAppearances" INTEGER NOT NULL DEFAULT 1,
    "roles" TEXT NOT NULL,
    "credibilityHistory" TEXT NOT NULL,
    "inconsistencyCount" INTEGER NOT NULL DEFAULT 0,
    "recantationCount" INTEGER NOT NULL DEFAULT 0,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_case_witness_indexes_pkey" PRIMARY KEY ("id")
);

-- 4. Cross-Case Forensic Pattern
CREATE TABLE "cross_case_forensic_patterns" (
    "id" TEXT NOT NULL,
    "forensicType" TEXT NOT NULL,
    "methodologyUsed" TEXT NOT NULL,
    "caseIds" TEXT NOT NULL,
    "totalOccurrences" INTEGER NOT NULL DEFAULT 1,
    "reliabilityRange" TEXT NOT NULL,
    "challengedCount" INTEGER NOT NULL DEFAULT 0,
    "excludedCount" INTEGER NOT NULL DEFAULT 0,
    "currentScientificStatus" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_case_forensic_patterns_pkey" PRIMARY KEY ("id")
);

-- 5. Global Contradiction Network
CREATE TABLE "global_contradiction_networks" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "contradictionId" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "contradictionType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "connectedContradictionIds" TEXT NOT NULL,
    "networkSize" INTEGER NOT NULL DEFAULT 1,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_contradiction_networks_pkey" PRIMARY KEY ("id")
);

-- 6. Prosecutor Theory Recurrence
CREATE TABLE "prosecutor_theory_recurrences" (
    "id" TEXT NOT NULL,
    "theoryPattern" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "caseIds" TEXT NOT NULL,
    "totalOccurrences" INTEGER NOT NULL DEFAULT 1,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "commonWeaknesses" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prosecutor_theory_recurrences_pkey" PRIMARY KEY ("id")
);

-- 7. Recurring Brady/Giglio Pattern
CREATE TABLE "recurring_brady_patterns" (
    "id" TEXT NOT NULL,
    "patternType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "caseIds" TEXT NOT NULL,
    "totalOccurrences" INTEGER NOT NULL DEFAULT 1,
    "materialityAssessments" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_brady_patterns_pkey" PRIMARY KEY ("id")
);

-- 8. Law Enforcement Credibility Index
CREATE TABLE "law_enforcement_credibility_indexes" (
    "id" TEXT NOT NULL,
    "officerIdentifier" TEXT NOT NULL,
    "caseIds" TEXT NOT NULL,
    "totalCaseAppearances" INTEGER NOT NULL DEFAULT 1,
    "inconsistencyCount" INTEGER NOT NULL DEFAULT 0,
    "bradyIssueCount" INTEGER NOT NULL DEFAULT 0,
    "pitchessRelevant" BOOLEAN NOT NULL DEFAULT false,
    "aggregateCredibility" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "law_enforcement_credibility_indexes_pkey" PRIMARY KEY ("id")
);

-- 9. Evidence Provenance Graph
CREATE TABLE "evidence_provenance_graphs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "provenanceChain" TEXT NOT NULL,
    "chainLength" INTEGER NOT NULL DEFAULT 0,
    "integrityStatus" TEXT NOT NULL,
    "gapLocations" TEXT NOT NULL,
    "custodyTransfers" INTEGER NOT NULL DEFAULT 0,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_provenance_graphs_pkey" PRIMARY KEY ("id")
);

-- 10. Multi-Case Timeline Correlation
CREATE TABLE "multi_case_timeline_correlations" (
    "id" TEXT NOT NULL,
    "correlationType" TEXT NOT NULL,
    "caseIdA" TEXT NOT NULL,
    "caseIdB" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "correlationStrength" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sharedElements" TEXT NOT NULL,
    "legalSignificance" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "multi_case_timeline_correlations_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "intelligence_graph_nodes_sourceTable_sourceId_key" ON "intelligence_graph_nodes"("sourceTable", "sourceId");
CREATE UNIQUE INDEX "cross_case_witness_indexes_normalizedName_key" ON "cross_case_witness_indexes"("normalizedName");
CREATE UNIQUE INDEX "law_enforcement_credibility_indexes_officerIdentifier_key" ON "law_enforcement_credibility_indexes"("officerIdentifier");

-- Performance indexes
CREATE INDEX "intelligence_graph_nodes_caseId_idx" ON "intelligence_graph_nodes"("caseId");
CREATE INDEX "intelligence_graph_nodes_nodeType_idx" ON "intelligence_graph_nodes"("nodeType");

CREATE INDEX "intelligence_graph_edges_caseId_idx" ON "intelligence_graph_edges"("caseId");
CREATE INDEX "intelligence_graph_edges_sourceNodeId_idx" ON "intelligence_graph_edges"("sourceNodeId");
CREATE INDEX "intelligence_graph_edges_targetNodeId_idx" ON "intelligence_graph_edges"("targetNodeId");
CREATE INDEX "intelligence_graph_edges_edgeType_idx" ON "intelligence_graph_edges"("edgeType");

CREATE INDEX "cross_case_witness_indexes_normalizedName_idx" ON "cross_case_witness_indexes"("normalizedName");
CREATE INDEX "cross_case_witness_indexes_totalAppearances_idx" ON "cross_case_witness_indexes"("totalAppearances");

CREATE INDEX "cross_case_forensic_patterns_forensicType_idx" ON "cross_case_forensic_patterns"("forensicType");
CREATE INDEX "cross_case_forensic_patterns_totalOccurrences_idx" ON "cross_case_forensic_patterns"("totalOccurrences");

CREATE INDEX "global_contradiction_networks_caseId_idx" ON "global_contradiction_networks"("caseId");
CREATE INDEX "global_contradiction_networks_witnessName_idx" ON "global_contradiction_networks"("witnessName");
CREATE INDEX "global_contradiction_networks_severity_idx" ON "global_contradiction_networks"("severity");

CREATE INDEX "prosecutor_theory_recurrences_theoryPattern_idx" ON "prosecutor_theory_recurrences"("theoryPattern");
CREATE INDEX "prosecutor_theory_recurrences_totalOccurrences_idx" ON "prosecutor_theory_recurrences"("totalOccurrences");

CREATE INDEX "recurring_brady_patterns_patternType_idx" ON "recurring_brady_patterns"("patternType");
CREATE INDEX "recurring_brady_patterns_totalOccurrences_idx" ON "recurring_brady_patterns"("totalOccurrences");

CREATE INDEX "law_enforcement_credibility_indexes_officerIdentifier_idx" ON "law_enforcement_credibility_indexes"("officerIdentifier");
CREATE INDEX "law_enforcement_credibility_indexes_aggregateCredibility_idx" ON "law_enforcement_credibility_indexes"("aggregateCredibility");

CREATE INDEX "evidence_provenance_graphs_caseId_idx" ON "evidence_provenance_graphs"("caseId");
CREATE INDEX "evidence_provenance_graphs_integrityStatus_idx" ON "evidence_provenance_graphs"("integrityStatus");

CREATE INDEX "multi_case_timeline_correlations_caseIdA_idx" ON "multi_case_timeline_correlations"("caseIdA");
CREATE INDEX "multi_case_timeline_correlations_caseIdB_idx" ON "multi_case_timeline_correlations"("caseIdB");
CREATE INDEX "multi_case_timeline_correlations_correlationType_idx" ON "multi_case_timeline_correlations"("correlationType");
