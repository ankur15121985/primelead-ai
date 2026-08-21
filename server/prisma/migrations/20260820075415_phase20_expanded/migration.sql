-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "textContent" TEXT,
    "variables" JSONB,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "replyTo" TEXT,
    "tags" JSONB,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduledReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "reportConfig" JSONB NOT NULL,
    "schedule" JSONB NOT NULL,
    "recipients" JSONB,
    "webhookUrl" TEXT,
    "format" TEXT NOT NULL DEFAULT 'CSV',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" DATETIME,
    "nextRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduledReport_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduledReportLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "format" TEXT,
    "rowCount" INTEGER,
    "filename" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduledReportLog_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ScheduledReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EmailTemplate_orgId_category_idx" ON "EmailTemplate"("orgId", "category");

-- CreateIndex
CREATE INDEX "EmailTemplate_orgId_name_idx" ON "EmailTemplate"("orgId", "name");

-- CreateIndex
CREATE INDEX "ScheduledReport_orgId_enabled_idx" ON "ScheduledReport"("orgId", "enabled");

-- CreateIndex
CREATE INDEX "ScheduledReport_orgId_nextRunAt_idx" ON "ScheduledReport"("orgId", "nextRunAt");

-- CreateIndex
CREATE INDEX "ScheduledReportLog_orgId_reportId_idx" ON "ScheduledReportLog"("orgId", "reportId");

-- CreateIndex
CREATE INDEX "ScheduledReportLog_orgId_createdAt_idx" ON "ScheduledReportLog"("orgId", "createdAt");
