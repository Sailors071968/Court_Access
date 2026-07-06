-- Program 12 — Investigator Workbench persistence

CREATE TABLE "case_witnesses" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'identified',
    "interviewStatus" TEXT NOT NULL DEFAULT 'not_scheduled',
    "notes" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_witnesses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "investigation_leads" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assignedTo" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investigation_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_notes" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "noteType" TEXT NOT NULL DEFAULT 'general',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "evidenceId" TEXT,
    "witnessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "investigation_assignments" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "investigatorId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'lead',
    "status" TEXT NOT NULL DEFAULT 'active',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,

    CONSTRAINT "investigation_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "case_witnesses_caseId_tenantId_idx" ON "case_witnesses"("caseId", "tenantId");
CREATE INDEX "investigation_leads_caseId_tenantId_idx" ON "investigation_leads"("caseId", "tenantId");
CREATE INDEX "field_notes_caseId_tenantId_idx" ON "field_notes"("caseId", "tenantId");
CREATE INDEX "field_notes_userId_idx" ON "field_notes"("userId");
CREATE UNIQUE INDEX "investigation_assignments_caseId_tenantId_investigatorId_key" ON "investigation_assignments"("caseId", "tenantId", "investigatorId");
CREATE INDEX "investigation_assignments_investigatorId_idx" ON "investigation_assignments"("investigatorId");
