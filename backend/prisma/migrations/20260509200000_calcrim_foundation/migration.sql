-- Phase C.1: CALCRIM Foundation — Prosecution Burden Schema
-- Phase C.2: Evidence Statement Normalization
-- Phase C.3: Element-Statement Link

-- CalcrimInstruction
CREATE TABLE "calcrim_instructions" (
    "id" TEXT NOT NULL,
    "instructionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "crimeCategory" TEXT NOT NULL,
    "description" TEXT,
    "penalCode" TEXT NOT NULL,
    "intentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calcrim_instructions_pkey" PRIMARY KEY ("id")
);

-- CalcrimElement
CREATE TABLE "calcrim_elements" (
    "id" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "elementNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prosecutionBurden" TEXT NOT NULL,
    "isEssential" BOOLEAN NOT NULL DEFAULT true,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calcrim_elements_pkey" PRIMARY KEY ("id")
);

-- ElementAlias
CREATE TABLE "element_aliases" (
    "id" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "element_aliases_pkey" PRIMARY KEY ("id")
);

-- ElementKeyword
CREATE TABLE "element_keywords" (
    "id" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'action',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "element_keywords_pkey" PRIMARY KEY ("id")
);

-- EvidenceStatement
CREATE TABLE "evidence_statements" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "page" INTEGER,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    "timestamp" TEXT,
    "speaker" TEXT,
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "extractionConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "extractionMethod" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_statements_pkey" PRIMARY KEY ("id")
);

-- ElementStatementLink
CREATE TABLE "element_statement_links" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "matchMethod" TEXT NOT NULL DEFAULT 'keyword',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "supportType" TEXT NOT NULL DEFAULT 'supports',
    "matchedKeywords" TEXT,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "element_statement_links_pkey" PRIMARY KEY ("id")
);

-- =========================================================================
-- Charge table handling: Safe for all 3 production scenarios
-- Scenario A: "Charge" exists (quoted PascalCase) → add columns + rename
-- Scenario B: "charge" exists (unquoted lowercase)  → add columns + rename
-- Scenario C: No Charge table exists               → CREATE TABLE "charges"
-- =========================================================================

DO $$
BEGIN
  -- Scenario A: Table exists as "Charge" (quoted PascalCase)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Charge') THEN
    -- Add new columns if they don't already exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Charge' AND column_name = 'severity') THEN
      ALTER TABLE "Charge" ADD COLUMN "severity" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Charge' AND column_name = 'calcrimInstructionId') THEN
      ALTER TABLE "Charge" ADD COLUMN "calcrimInstructionId" TEXT;
    END IF;
    -- Rename to "charges"
    ALTER TABLE "Charge" RENAME TO "charges";

  -- Scenario B: Table exists as "charge" (lowercase, unquoted creation)
  ELSIF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'charge') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'charge' AND column_name = 'severity') THEN
      ALTER TABLE "charge" ADD COLUMN "severity" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'charge' AND column_name = 'calcrimInstructionId') THEN
      ALTER TABLE "charge" ADD COLUMN "calcrimInstructionId" TEXT;
    END IF;
    ALTER TABLE "charge" RENAME TO "charges";

  -- Scenario C: Table does not exist — create fresh
  ELSIF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'charges') THEN
    CREATE TABLE "charges" (
      "id" TEXT NOT NULL,
      "caseId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "section" TEXT NOT NULL,
      "title" TEXT,
      "dateOfOffense" TIMESTAMP(3),
      "victim" TEXT NOT NULL,
      "severity" TEXT,
      "calcrimInstructionId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "charges_caseId_idx" ON "charges"("caseId");

  -- Scenario D: Table already exists as "charges" (idempotent re-run)
  ELSE
    -- Add columns if missing (idempotent)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'charges' AND column_name = 'severity') THEN
      ALTER TABLE "charges" ADD COLUMN "severity" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'charges' AND column_name = 'calcrimInstructionId') THEN
      ALTER TABLE "charges" ADD COLUMN "calcrimInstructionId" TEXT;
    END IF;
  END IF;
END
$$;

-- Indexes: calcrim_instructions
CREATE UNIQUE INDEX "calcrim_instructions_instructionNumber_key" ON "calcrim_instructions"("instructionNumber");
CREATE INDEX "calcrim_instructions_instructionNumber_idx" ON "calcrim_instructions"("instructionNumber");
CREATE INDEX "calcrim_instructions_penalCode_idx" ON "calcrim_instructions"("penalCode");
CREATE INDEX "calcrim_instructions_crimeCategory_idx" ON "calcrim_instructions"("crimeCategory");

-- Indexes: calcrim_elements
CREATE UNIQUE INDEX "calcrim_elements_instructionId_elementNumber_key" ON "calcrim_elements"("instructionId", "elementNumber");
CREATE INDEX "calcrim_elements_instructionId_idx" ON "calcrim_elements"("instructionId");

-- Indexes: element_aliases
CREATE INDEX "element_aliases_elementId_idx" ON "element_aliases"("elementId");
CREATE INDEX "element_aliases_alias_idx" ON "element_aliases"("alias");

-- Indexes: element_keywords
CREATE INDEX "element_keywords_elementId_idx" ON "element_keywords"("elementId");
CREATE INDEX "element_keywords_keyword_idx" ON "element_keywords"("keyword");
CREATE INDEX "element_keywords_category_idx" ON "element_keywords"("category");

-- Indexes: evidence_statements
CREATE INDEX "evidence_statements_caseId_idx" ON "evidence_statements"("caseId");
CREATE INDEX "evidence_statements_tenantId_idx" ON "evidence_statements"("tenantId");
CREATE INDEX "evidence_statements_sourceDocumentId_idx" ON "evidence_statements"("sourceDocumentId");
CREATE INDEX "evidence_statements_speaker_idx" ON "evidence_statements"("speaker");

-- Indexes: element_statement_links
CREATE UNIQUE INDEX "element_statement_links_statementId_elementId_chargeId_key" ON "element_statement_links"("statementId", "elementId", "chargeId");
CREATE INDEX "element_statement_links_statementId_idx" ON "element_statement_links"("statementId");
CREATE INDEX "element_statement_links_elementId_idx" ON "element_statement_links"("elementId");
CREATE INDEX "element_statement_links_chargeId_idx" ON "element_statement_links"("chargeId");
CREATE INDEX "element_statement_links_supportType_idx" ON "element_statement_links"("supportType");

-- Indexes: charges (formerly Charge) — idempotent
CREATE INDEX IF NOT EXISTS "charges_code_section_idx" ON "charges"("code", "section");

-- Foreign Keys — idempotent via DO blocks
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'charges_caseId_fkey') THEN
    ALTER TABLE "charges" ADD CONSTRAINT "charges_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "criminal_cases"("caseId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'charges_calcrimInstructionId_fkey') THEN
    ALTER TABLE "charges" ADD CONSTRAINT "charges_calcrimInstructionId_fkey" FOREIGN KEY ("calcrimInstructionId") REFERENCES "calcrim_instructions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "calcrim_elements" ADD CONSTRAINT "calcrim_elements_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "calcrim_instructions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "element_aliases" ADD CONSTRAINT "element_aliases_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "calcrim_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "element_keywords" ADD CONSTRAINT "element_keywords_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "calcrim_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "element_statement_links" ADD CONSTRAINT "element_statement_links_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "evidence_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "element_statement_links" ADD CONSTRAINT "element_statement_links_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "calcrim_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "element_statement_links" ADD CONSTRAINT "element_statement_links_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
