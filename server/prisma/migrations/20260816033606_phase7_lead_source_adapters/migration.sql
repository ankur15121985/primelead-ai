-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "integrationId" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "leadId" TEXT,
    "message" TEXT,
    "externalId" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntegrationLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Integration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB,
    "webhookSecret" TEXT,
    "webhookUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "lastSyncAt" DATETIME,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Integration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Integration" ("config", "createdAt", "enabled", "id", "lastSyncAt", "name", "orgId", "source", "status", "updatedAt", "webhookSecret", "webhookUrl") SELECT "config", "createdAt", "enabled", "id", "lastSyncAt", "name", "orgId", "source", "status", "updatedAt", "webhookSecret", "webhookUrl" FROM "Integration";
DROP TABLE "Integration";
ALTER TABLE "new_Integration" RENAME TO "Integration";
CREATE UNIQUE INDEX "Integration_orgId_source_key" ON "Integration"("orgId", "source");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "IntegrationLog_orgId_source_createdAt_idx" ON "IntegrationLog"("orgId", "source", "createdAt");
