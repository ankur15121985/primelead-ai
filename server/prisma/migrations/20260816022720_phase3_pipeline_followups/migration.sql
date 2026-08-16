-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "expectedCloseAt" DATETIME;
ALTER TABLE "Lead" ADD COLUMN "lostReason" TEXT;
ALTER TABLE "Lead" ADD COLUMN "wonReason" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pipeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Sales Pipeline',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pipeline_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Pipeline" ("createdAt", "id", "isDefault", "name", "orgId") SELECT "createdAt", "id", "isDefault", "name", "orgId" FROM "Pipeline";
DROP TABLE "Pipeline";
ALTER TABLE "new_Pipeline" RENAME TO "Pipeline";
CREATE INDEX "Pipeline_orgId_idx" ON "Pipeline"("orgId");
CREATE TABLE "new_PipelineStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PipelineStage" ("color", "createdAt", "id", "isLost", "isWon", "name", "order", "orgId", "pipelineId") SELECT "color", "createdAt", "id", "isLost", "isWon", "name", "order", "orgId", "pipelineId" FROM "PipelineStage";
DROP TABLE "PipelineStage";
ALTER TABLE "new_PipelineStage" RENAME TO "PipelineStage";
CREATE INDEX "PipelineStage_orgId_idx" ON "PipelineStage"("orgId");
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'FOLLOW_UP',
    "dueAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "repeatEveryDays" INTEGER,
    "notes" TEXT,
    "completedAt" DATETIME,
    "overdueNotifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("completedAt", "createdAt", "dueAt", "id", "kind", "leadId", "notes", "orgId", "overdueNotifiedAt", "status", "title", "updatedAt", "userId") SELECT "completedAt", "createdAt", "dueAt", "id", "kind", "leadId", "notes", "orgId", "overdueNotifiedAt", "status", "title", "updatedAt", "userId" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_orgId_userId_status_idx" ON "Task"("orgId", "userId", "status");
CREATE INDEX "Task_orgId_dueAt_idx" ON "Task"("orgId", "dueAt");
CREATE INDEX "Task_orgId_leadId_idx" ON "Task"("orgId", "leadId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
