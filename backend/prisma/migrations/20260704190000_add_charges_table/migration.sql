-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "title" TEXT,
    "dateOfOffense" TIMESTAMP(3),
    "victim" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Charge_caseId_idx" ON "Charge"("caseId");
