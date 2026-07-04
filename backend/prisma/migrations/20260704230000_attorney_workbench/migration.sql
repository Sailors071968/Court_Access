-- Domain V — Attorney Workbench persistence

CREATE TABLE "attorney_notes" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attorney_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workbench_pins" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pinType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workbench_pins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "investigation_tasks" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assignedTo" TEXT,
    "dueDate" TIMESTAMP(3),
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investigation_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attorney_notes_caseId_tenantId_idx" ON "attorney_notes"("caseId", "tenantId");
CREATE INDEX "attorney_notes_userId_idx" ON "attorney_notes"("userId");
CREATE INDEX "attorney_notes_entityType_entityId_idx" ON "attorney_notes"("entityType", "entityId");

CREATE UNIQUE INDEX "workbench_pins_caseId_tenantId_userId_pinType_entityId_key" ON "workbench_pins"("caseId", "tenantId", "userId", "pinType", "entityId");
CREATE INDEX "workbench_pins_caseId_tenantId_idx" ON "workbench_pins"("caseId", "tenantId");
CREATE INDEX "workbench_pins_userId_idx" ON "workbench_pins"("userId");

CREATE INDEX "investigation_tasks_caseId_tenantId_idx" ON "investigation_tasks"("caseId", "tenantId");
CREATE INDEX "investigation_tasks_status_idx" ON "investigation_tasks"("status");
CREATE INDEX "investigation_tasks_assignedTo_idx" ON "investigation_tasks"("assignedTo");
