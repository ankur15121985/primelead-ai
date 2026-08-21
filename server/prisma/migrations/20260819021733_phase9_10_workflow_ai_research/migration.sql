-- CreateTable
CREATE TABLE "WorkflowNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "ruleId" TEXT,
    "nodeType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "config" JSONB,
    "positionX" REAL NOT NULL DEFAULT 0,
    "positionY" REAL NOT NULL DEFAULT 0,
    "connections" JSONB,
    "branches" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkflowNode_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowNode_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "templateData" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkflowTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiResearchReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "reportType" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "leadId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "sections" JSONB NOT NULL,
    "sources" JSONB,
    "confidence" REAL NOT NULL DEFAULT 0,
    "sectionLabels" JSONB,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "costPaise" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiResearchReport_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiRecommendation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT,
    "contactId" TEXT,
    "hostId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULEED',
    "meetingType" TEXT NOT NULL DEFAULT '1_1',
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "calendarEventId" TEXT,
    "calendarProvider" TEXT,
    "meetingUrl" TEXT,
    "prepNotes" TEXT,
    "summary" TEXT,
    "actionItems" JSONB,
    "followUpTaskId" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meeting_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Meeting_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Meeting" ("actionItems", "calendarEventId", "calendarProvider", "contactId", "createdAt", "description", "durationMinutes", "endAt", "followUpTaskId", "hostId", "id", "leadId", "meetingType", "meetingUrl", "metadata", "orgId", "prepNotes", "startAt", "status", "summary", "timezone", "title", "updatedAt") SELECT "actionItems", "calendarEventId", "calendarProvider", "contactId", "createdAt", "description", "durationMinutes", "endAt", "followUpTaskId", "hostId", "id", "leadId", "meetingType", "meetingUrl", "metadata", "orgId", "prepNotes", "startAt", "status", "summary", "timezone", "title", "updatedAt" FROM "Meeting";
DROP TABLE "Meeting";
ALTER TABLE "new_Meeting" RENAME TO "Meeting";
CREATE INDEX "Meeting_orgId_hostId_idx" ON "Meeting"("orgId", "hostId");
CREATE INDEX "Meeting_orgId_leadId_idx" ON "Meeting"("orgId", "leadId");
CREATE INDEX "Meeting_orgId_status_idx" ON "Meeting"("orgId", "status");
CREATE INDEX "Meeting_orgId_startAt_idx" ON "Meeting"("orgId", "startAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "WorkflowNode_orgId_ruleId_idx" ON "WorkflowNode"("orgId", "ruleId");

-- CreateIndex
CREATE INDEX "WorkflowNode_orgId_nodeType_idx" ON "WorkflowNode"("orgId", "nodeType");

-- CreateIndex
CREATE INDEX "WorkflowTemplate_orgId_category_idx" ON "WorkflowTemplate"("orgId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTemplate_orgId_name_key" ON "WorkflowTemplate"("orgId", "name");

-- CreateIndex
CREATE INDEX "AiResearchReport_orgId_reportType_idx" ON "AiResearchReport"("orgId", "reportType");

-- CreateIndex
CREATE INDEX "AiResearchReport_orgId_companyId_idx" ON "AiResearchReport"("orgId", "companyId");

-- CreateIndex
CREATE INDEX "AiResearchReport_orgId_contactId_idx" ON "AiResearchReport"("orgId", "contactId");

-- CreateIndex
CREATE INDEX "AiResearchReport_orgId_userId_idx" ON "AiResearchReport"("orgId", "userId");

-- CreateIndex
CREATE INDEX "AiResearchReport_orgId_createdAt_idx" ON "AiResearchReport"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AiRecommendation_orgId_type_idx" ON "AiRecommendation"("orgId", "type");

-- CreateIndex
CREATE INDEX "AiRecommendation_orgId_entityType_entityId_idx" ON "AiRecommendation"("orgId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AiRecommendation_orgId_userId_status_idx" ON "AiRecommendation"("orgId", "userId", "status");

-- CreateIndex
CREATE INDEX "AiRecommendation_orgId_status_createdAt_idx" ON "AiRecommendation"("orgId", "status", "createdAt");
