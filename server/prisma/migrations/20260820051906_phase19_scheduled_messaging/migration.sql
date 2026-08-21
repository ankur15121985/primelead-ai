-- CreateTable
CREATE TABLE "ScheduledMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "type" TEXT NOT NULL DEFAULT 'DIRECT',
    "recipientPhone" TEXT,
    "recipientEmail" TEXT,
    "recipientName" TEXT,
    "leadId" TEXT,
    "contactId" TEXT,
    "conversationId" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "templateName" TEXT,
    "templateParams" JSONB,
    "templateLanguage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "sentAt" DATETIME,
    "failedAt" DATETIME,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "nextRetryAt" DATETIME,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "batchId" TEXT,
    "providerCostPaise" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "source" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduledMessage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduledMessageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "provider" TEXT,
    "httpStatus" INTEGER,
    "responseBody" TEXT,
    "error" TEXT,
    "durationMs" INTEGER,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduledMessageLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduledMessageLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ScheduledMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ScheduledMessage_orgId_status_idx" ON "ScheduledMessage"("orgId", "status");

-- CreateIndex
CREATE INDEX "ScheduledMessage_orgId_scheduledAt_idx" ON "ScheduledMessage"("orgId", "scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledMessage_orgId_channel_idx" ON "ScheduledMessage"("orgId", "channel");

-- CreateIndex
CREATE INDEX "ScheduledMessage_orgId_status_scheduledAt_idx" ON "ScheduledMessage"("orgId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledMessage_orgId_batchId_idx" ON "ScheduledMessage"("orgId", "batchId");

-- CreateIndex
CREATE INDEX "ScheduledMessage_status_scheduledAt_priority_idx" ON "ScheduledMessage"("status", "scheduledAt", "priority");

-- CreateIndex
CREATE INDEX "ScheduledMessageLog_orgId_messageId_idx" ON "ScheduledMessageLog"("orgId", "messageId");

-- CreateIndex
CREATE INDEX "ScheduledMessageLog_orgId_status_idx" ON "ScheduledMessageLog"("orgId", "status");

-- CreateIndex
CREATE INDEX "ScheduledMessageLog_orgId_createdAt_idx" ON "ScheduledMessageLog"("orgId", "createdAt");
