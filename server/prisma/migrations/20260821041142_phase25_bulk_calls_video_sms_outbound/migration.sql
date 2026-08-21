-- CreateTable
CREATE TABLE "VideoRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "leadId" TEXT,
    "meetingId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "maxParticipants" INTEGER NOT NULL DEFAULT 10,
    "recordingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoRoom_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoRoom_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VideoRoom_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PARTICIPANT',
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isVideoOff" BOOLEAN NOT NULL DEFAULT false,
    "sdp" TEXT,
    "sdpType" TEXT,
    "iceCandidates" JSONB,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    CONSTRAINT "VideoParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "VideoRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsOutbound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "leadId" TEXT,
    "toNumber" TEXT NOT NULL,
    "fromNumber" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "error" TEXT,
    "cost" REAL,
    "sentAt" DATETIME,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsOutbound_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SmsOutbound_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoRoom_roomId_key" ON "VideoRoom"("roomId");

-- CreateIndex
CREATE INDEX "VideoRoom_orgId_status_idx" ON "VideoRoom"("orgId", "status");

-- CreateIndex
CREATE INDEX "VideoRoom_orgId_hostId_idx" ON "VideoRoom"("orgId", "hostId");

-- CreateIndex
CREATE INDEX "VideoParticipant_roomId_userId_idx" ON "VideoParticipant"("roomId", "userId");

-- CreateIndex
CREATE INDEX "SmsOutbound_orgId_leadId_idx" ON "SmsOutbound"("orgId", "leadId");

-- CreateIndex
CREATE INDEX "SmsOutbound_orgId_status_idx" ON "SmsOutbound"("orgId", "status");

-- CreateIndex
CREATE INDEX "SmsOutbound_orgId_createdAt_idx" ON "SmsOutbound"("orgId", "createdAt");
