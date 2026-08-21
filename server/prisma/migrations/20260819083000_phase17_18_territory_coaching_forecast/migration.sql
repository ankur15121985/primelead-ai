-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "countries" TEXT NOT NULL DEFAULT '[]',
    "states" TEXT NOT NULL DEFAULT '[]',
    "cities" TEXT NOT NULL DEFAULT '[]',
    "zipCodes" TEXT NOT NULL DEFAULT '[]',
    "industries" TEXT NOT NULL DEFAULT '[]',
    "employeeRanges" TEXT NOT NULL DEFAULT '[]',
    "ownerId" TEXT,
    "teamId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Territory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Territory_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccountOwnership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "coOwnerId" TEXT,
    "territoryId" TEXT,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lostAt" DATETIME,
    "lostReason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "changedBy" TEXT,
    "changeReason" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccountOwnership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountOwnership_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccountOwnership_coOwnerId_fkey" FOREIGN KEY ("coOwnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccountOwnership_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoachingInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'MONTH',
    "activityScore" INTEGER NOT NULL DEFAULT 0,
    "callMetrics" JSONB,
    "emailMetrics" JSONB,
    "meetingMetrics" JSONB,
    "pipelineMetrics" JSONB,
    "strengths" TEXT NOT NULL DEFAULT '[]',
    "improvements" TEXT NOT NULL DEFAULT '[]',
    "recommendations" TEXT NOT NULL DEFAULT '[]',
    "summary" TEXT,
    "generatedBy" TEXT NOT NULL DEFAULT 'SYSTEM',
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoachingInsight_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoachingInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ForecastEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'MONTH',
    "userId" TEXT,
    "territoryId" TEXT,
    "pipelineValue" INTEGER NOT NULL DEFAULT 0,
    "commitValue" INTEGER NOT NULL DEFAULT 0,
    "bestCaseValue" INTEGER NOT NULL DEFAULT 0,
    "closedWon" INTEGER NOT NULL DEFAULT 0,
    "closedLost" INTEGER NOT NULL DEFAULT 0,
    "manualCommit" INTEGER,
    "manualBestCase" INTEGER,
    "manualPipeline" INTEGER,
    "confidence" REAL NOT NULL DEFAULT 0,
    "dealCount" INTEGER NOT NULL DEFAULT 0,
    "weightedPipeline" INTEGER NOT NULL DEFAULT 0,
    "aiPrediction" INTEGER,
    "aiConfidence" REAL,
    "aiFactors" TEXT NOT NULL DEFAULT '[]',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ForecastEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForecastEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Territory_orgId_isActive_idx" ON "Territory"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Territory_orgId_name_key" ON "Territory"("orgId", "name");

-- CreateIndex
CREATE INDEX "AccountOwnership_orgId_ownerId_idx" ON "AccountOwnership"("orgId", "ownerId");

-- CreateIndex
CREATE INDEX "AccountOwnership_orgId_entityType_idx" ON "AccountOwnership"("orgId", "entityType");

-- CreateIndex
CREATE INDEX "AccountOwnership_orgId_territoryId_idx" ON "AccountOwnership"("orgId", "territoryId");

-- CreateIndex
CREATE INDEX "AccountOwnership_orgId_isActive_idx" ON "AccountOwnership"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AccountOwnership_orgId_entityType_entityId_isActive_key" ON "AccountOwnership"("orgId", "entityType", "entityId", "isActive");

-- CreateIndex
CREATE INDEX "CoachingInsight_orgId_period_idx" ON "CoachingInsight"("orgId", "period");

-- CreateIndex
CREATE INDEX "CoachingInsight_orgId_userId_idx" ON "CoachingInsight"("orgId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachingInsight_orgId_userId_period_key" ON "CoachingInsight"("orgId", "userId", "period");

-- CreateIndex
CREATE INDEX "ForecastEntry_orgId_period_idx" ON "ForecastEntry"("orgId", "period");

-- CreateIndex
CREATE INDEX "ForecastEntry_orgId_userId_idx" ON "ForecastEntry"("orgId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastEntry_orgId_period_userId_key" ON "ForecastEntry"("orgId", "period", "userId");
