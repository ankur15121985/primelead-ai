-- CreateTable
CREATE TABLE "SavedReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entityType" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "dimensions" JSONB NOT NULL,
    "filters" JSONB,
    "chartType" TEXT NOT NULL DEFAULT 'TABLE',
    "dateRange" TEXT,
    "dateField" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sharedWithUserIds" TEXT NOT NULL DEFAULT '[]',
    "sharedWithTeamIds" TEXT NOT NULL DEFAULT '[]',
    "scheduledCron" TEXT,
    "lastGeneratedAt" DATETIME,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedReport_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SavedReport_orgId_entityType_idx" ON "SavedReport"("orgId", "entityType");

-- CreateIndex
CREATE INDEX "SavedReport_orgId_createdAt_idx" ON "SavedReport"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedReport_orgId_name_key" ON "SavedReport"("orgId", "name");
