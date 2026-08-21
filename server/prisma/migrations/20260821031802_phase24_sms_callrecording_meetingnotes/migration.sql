-- CreateTable
CREATE TABLE "SmsInbound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT,
    "contactId" TEXT,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT,
    "body" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsInbound_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SmsInbound_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "callId" TEXT,
    "meetingId" TEXT,
    "leadId" TEXT,
    "userId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'AUDIO',
    "status" TEXT NOT NULL DEFAULT 'RECORDING',
    "fileName" TEXT,
    "fileUrl" TEXT,
    "fileSizeBytes" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "mimeType" TEXT,
    "transcript" TEXT,
    "summary" TEXT,
    "sentiment" TEXT,
    "actionItems" JSONB,
    "keyTopics" JSONB,
    "speakers" JSONB,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recording_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recording_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Recording_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Recording_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingNotes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "callId" TEXT,
    "meetingId" TEXT,
    "recordingId" TEXT,
    "leadId" TEXT,
    "userId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'AUTO_GENERATED',
    "title" TEXT,
    "notes" TEXT NOT NULL,
    "summary" TEXT,
    "keyDecisions" JSONB,
    "actionItems" JSONB,
    "followUpItems" JSONB,
    "sentiment" TEXT,
    "attendees" JSONB,
    "durationMinutes" INTEGER,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeetingNotes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetingNotes_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MeetingNotes_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MeetingNotes_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MeetingNotes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SmsInbound_orgId_fromNumber_idx" ON "SmsInbound"("orgId", "fromNumber");

-- CreateIndex
CREATE INDEX "SmsInbound_orgId_status_idx" ON "SmsInbound"("orgId", "status");

-- CreateIndex
CREATE INDEX "SmsInbound_orgId_receivedAt_idx" ON "SmsInbound"("orgId", "receivedAt");

-- CreateIndex
CREATE INDEX "Recording_orgId_callId_idx" ON "Recording"("orgId", "callId");

-- CreateIndex
CREATE INDEX "Recording_orgId_meetingId_idx" ON "Recording"("orgId", "meetingId");

-- CreateIndex
CREATE INDEX "Recording_orgId_userId_idx" ON "Recording"("orgId", "userId");

-- CreateIndex
CREATE INDEX "Recording_orgId_status_idx" ON "Recording"("orgId", "status");

-- CreateIndex
CREATE INDEX "MeetingNotes_orgId_callId_idx" ON "MeetingNotes"("orgId", "callId");

-- CreateIndex
CREATE INDEX "MeetingNotes_orgId_meetingId_idx" ON "MeetingNotes"("orgId", "meetingId");

-- CreateIndex
CREATE INDEX "MeetingNotes_orgId_leadId_idx" ON "MeetingNotes"("orgId", "leadId");

-- CreateIndex
CREATE INDEX "MeetingNotes_orgId_userId_idx" ON "MeetingNotes"("orgId", "userId");
