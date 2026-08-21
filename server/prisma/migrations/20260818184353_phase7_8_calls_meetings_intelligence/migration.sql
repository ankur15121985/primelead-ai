-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT,
    "contactId" TEXT,
    "userId" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "status" TEXT NOT NULL,
    "fromNumber" TEXT,
    "toNumber" TEXT,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "disposition" TEXT,
    "notes" TEXT,
    "recordingUrl" TEXT,
    "recordingConsent" BOOLEAN NOT NULL DEFAULT false,
    "transcript" TEXT,
    "summary" TEXT,
    "sentiment" TEXT,
    "actionItems" JSONB,
    "metadata" JSONB,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Call_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Meeting" (
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
    CONSTRAINT "Meeting_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "callId" TEXT,
    "meetingId" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "type" TEXT NOT NULL,
    "summary" TEXT,
    "topics" JSONB,
    "objections" JSONB,
    "competitors" JSONB,
    "pricingDiscussed" BOOLEAN NOT NULL DEFAULT false,
    "buyingSignals" JSONB,
    "nextSteps" JSONB,
    "sentiment" TEXT,
    "riskLevel" TEXT,
    "sentimentScore" REAL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationAnalysis_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Call_orgId_leadId_idx" ON "Call"("orgId", "leadId");

-- CreateIndex
CREATE INDEX "Call_orgId_userId_idx" ON "Call"("orgId", "userId");

-- CreateIndex
CREATE INDEX "Call_orgId_status_idx" ON "Call"("orgId", "status");

-- CreateIndex
CREATE INDEX "Call_orgId_createdAt_idx" ON "Call"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Meeting_orgId_hostId_idx" ON "Meeting"("orgId", "hostId");

-- CreateIndex
CREATE INDEX "Meeting_orgId_leadId_idx" ON "Meeting"("orgId", "leadId");

-- CreateIndex
CREATE INDEX "Meeting_orgId_status_idx" ON "Meeting"("orgId", "status");

-- CreateIndex
CREATE INDEX "Meeting_orgId_startAt_idx" ON "Meeting"("orgId", "startAt");

-- CreateIndex
CREATE INDEX "ConversationAnalysis_orgId_callId_idx" ON "ConversationAnalysis"("orgId", "callId");

-- CreateIndex
CREATE INDEX "ConversationAnalysis_orgId_meetingId_idx" ON "ConversationAnalysis"("orgId", "meetingId");

-- CreateIndex
CREATE INDEX "ConversationAnalysis_orgId_contactId_idx" ON "ConversationAnalysis"("orgId", "contactId");

-- CreateIndex
CREATE INDEX "ConversationAnalysis_orgId_type_idx" ON "ConversationAnalysis"("orgId", "type");

-- CreateIndex
CREATE INDEX "ConversationAnalysis_orgId_createdAt_idx" ON "ConversationAnalysis"("orgId", "createdAt");
