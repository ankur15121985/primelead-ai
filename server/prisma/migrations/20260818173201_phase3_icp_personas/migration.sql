-- CreateTable
CREATE TABLE "Icp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "industries" JSONB,
    "subIndustries" JSONB,
    "employeeRanges" JSONB,
    "revenueRanges" JSONB,
    "countries" JSONB,
    "states" JSONB,
    "cities" JSONB,
    "companyTypes" JSONB,
    "technologies" JSONB,
    "fundingRanges" JSONB,
    "foundedAfter" INTEGER,
    "foundedBefore" INTEGER,
    "jobTitles" JSONB,
    "seniorities" JSONB,
    "departments" JSONB,
    "buyingSignals" JSONB,
    "painPoints" JSONB,
    "keywords" JSONB,
    "aiSummary" TEXT,
    "aiRecommendations" JSONB,
    "matchScore" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Icp_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "jobTitles" JSONB,
    "seniorities" JSONB,
    "departments" JSONB,
    "industries" JSONB,
    "companySizes" JSONB,
    "locations" JSONB,
    "painPoints" JSONB,
    "goals" JSONB,
    "objections" JSONB,
    "messagingTips" JSONB,
    "valuePropositions" JSONB,
    "preferredChannels" JSONB,
    "bestApproach" TEXT,
    "contactCount" INTEGER NOT NULL DEFAULT 0,
    "avgScore" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Persona_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Icp_orgId_isActive_idx" ON "Icp"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Icp_orgId_name_key" ON "Icp"("orgId", "name");

-- CreateIndex
CREATE INDEX "Persona_orgId_isActive_idx" ON "Persona"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Persona_orgId_name_key" ON "Persona"("orgId", "name");
