-- Phase D.6: Judicial Motion Intelligence + Evidentiary Objection Framework
-- Additive only. No existing tables modified.

-- EvidentiaryObjection
CREATE TABLE "evidentiary_objections" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "statementId" TEXT,
    "documentId" TEXT,
    "objectionType" TEXT NOT NULL,
    "evidenceCodeSection" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "citedText" TEXT NOT NULL,
    "citedPage" INTEGER,
    "citedLine" INTEGER,
    "citedSpeaker" TEXT,
    "citedDocument" TEXT,
    "strength" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'identified',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "evidentiary_objections_pkey" PRIMARY KEY ("id")
);

-- HearsayIssue
CREATE TABLE "hearsay_issues" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "statementId" TEXT,
    "declarant" TEXT NOT NULL,
    "reportingSpeaker" TEXT,
    "hearsayLevel" TEXT NOT NULL,
    "statementText" TEXT NOT NULL,
    "page" INTEGER,
    "lineStart" INTEGER,
    "documentId" TEXT,
    "exceptionClaimed" TEXT,
    "exceptionAnalysis" TEXT,
    "objectionBasis" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hearsay_issues_pkey" PRIMARY KEY ("id")
);

-- FoundationDefect
CREATE TABLE "foundation_defects" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "statementId" TEXT,
    "documentId" TEXT,
    "defectType" TEXT NOT NULL,
    "evidenceCodeSection" TEXT NOT NULL,
    "affectedText" TEXT NOT NULL,
    "page" INTEGER,
    "lineStart" INTEGER,
    "speaker" TEXT,
    "explanation" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "foundation_defects_pkey" PRIMARY KEY ("id")
);

-- AuthenticationChallenge
CREATE TABLE "authentication_challenges" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "documentId" TEXT,
    "challengeType" TEXT NOT NULL,
    "evidenceCodeSection" TEXT NOT NULL,
    "documentDescription" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "supportingEvidence" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "authentication_challenges_pkey" PRIMARY KEY ("id")
);

-- ChainOfCustodyIssue
CREATE TABLE "chain_of_custody_issues" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceItem" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "timelineGap" TEXT,
    "affectedStatements" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chain_of_custody_issues_pkey" PRIMARY KEY ("id")
);

-- ConstitutionalIssue
CREATE TABLE "constitutional_issues" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "amendmentBasis" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "factualBasis" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "affectedEvidence" TEXT NOT NULL,
    "suppressionPotential" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "constitutional_issues_pkey" PRIMARY KEY ("id")
);

-- DiscoveryViolation
CREATE TABLE "discovery_violations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "violationType" TEXT NOT NULL,
    "penalCodeSection" TEXT,
    "description" TEXT NOT NULL,
    "affectedEvidence" TEXT NOT NULL,
    "discoveryTimeline" TEXT NOT NULL,
    "prejudiceAnalysis" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "remedySought" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "discovery_violations_pkey" PRIMARY KEY ("id")
);

-- BradyGiglioIssue
CREATE TABLE "brady_giglio_issues" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "materialityAnalysis" TEXT NOT NULL,
    "favorabilityBasis" TEXT NOT NULL,
    "suppressionEvidence" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "discoveredVia" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brady_giglio_issues_pkey" PRIMARY KEY ("id")
);

-- SuppressionIssue
CREATE TABLE "suppression_issues" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "suppressionBasis" TEXT NOT NULL,
    "evidenceToSuppress" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "factualBasis" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "affectedCharges" TEXT NOT NULL,
    "impactAnalysis" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "suppression_issues_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "evidentiary_objections_caseId_idx" ON "evidentiary_objections"("caseId");
CREATE INDEX "evidentiary_objections_objectionType_idx" ON "evidentiary_objections"("objectionType");
CREATE INDEX "evidentiary_objections_strength_idx" ON "evidentiary_objections"("strength");
CREATE INDEX "evidentiary_objections_status_idx" ON "evidentiary_objections"("status");

CREATE INDEX "hearsay_issues_caseId_idx" ON "hearsay_issues"("caseId");
CREATE INDEX "hearsay_issues_declarant_idx" ON "hearsay_issues"("declarant");
CREATE INDEX "hearsay_issues_hearsayLevel_idx" ON "hearsay_issues"("hearsayLevel");

CREATE INDEX "foundation_defects_caseId_idx" ON "foundation_defects"("caseId");
CREATE INDEX "foundation_defects_defectType_idx" ON "foundation_defects"("defectType");

CREATE INDEX "authentication_challenges_caseId_idx" ON "authentication_challenges"("caseId");
CREATE INDEX "authentication_challenges_challengeType_idx" ON "authentication_challenges"("challengeType");

CREATE INDEX "chain_of_custody_issues_caseId_idx" ON "chain_of_custody_issues"("caseId");
CREATE INDEX "chain_of_custody_issues_issueType_idx" ON "chain_of_custody_issues"("issueType");

CREATE INDEX "constitutional_issues_caseId_idx" ON "constitutional_issues"("caseId");
CREATE INDEX "constitutional_issues_amendmentBasis_idx" ON "constitutional_issues"("amendmentBasis");
CREATE INDEX "constitutional_issues_issueType_idx" ON "constitutional_issues"("issueType");
CREATE INDEX "constitutional_issues_suppressionPotential_idx" ON "constitutional_issues"("suppressionPotential");

CREATE INDEX "discovery_violations_caseId_idx" ON "discovery_violations"("caseId");
CREATE INDEX "discovery_violations_violationType_idx" ON "discovery_violations"("violationType");

CREATE INDEX "brady_giglio_issues_caseId_idx" ON "brady_giglio_issues"("caseId");
CREATE INDEX "brady_giglio_issues_issueType_idx" ON "brady_giglio_issues"("issueType");

CREATE INDEX "suppression_issues_caseId_idx" ON "suppression_issues"("caseId");
CREATE INDEX "suppression_issues_suppressionBasis_idx" ON "suppression_issues"("suppressionBasis");
