-- CreateTable
CREATE TABLE "ScoringRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" JSONB,
    "points" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScoringRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntentSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "type" TEXT NOT NULL,
    "topic" TEXT,
    "source" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntentSignal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanySignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0,
    "evidence" JSONB,
    "metadata" JSONB,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanySignal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalEnrolled" INTEGER NOT NULL DEFAULT 0,
    "totalCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalReplied" INTEGER NOT NULL DEFAULT 0,
    "totalBounced" INTEGER NOT NULL DEFAULT 0,
    "totalUnsubscribed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sequence_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SequenceStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequenceId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "templateId" TEXT,
    "waitDays" INTEGER,
    "waitHours" INTEGER,
    "conditionType" TEXT,
    "conditionValue" TEXT,
    "aiPrompt" TEXT,
    "aiAction" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SequenceEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "contactId" TEXT,
    "leadId" TEXT,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENROLLED',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "nextActionAt" DATETIME,
    "lastActivityAt" DATETIME,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "opens" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "enrolledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SequenceEnrollment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SequenceEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SequenceEmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "errorMessage" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" DATETIME,
    "openedAt" DATETIME,
    "clickedAt" DATETIME,
    "bouncedAt" DATETIME,
    CONSTRAINT "SequenceEmailLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SequenceEmailLog_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "SequenceEnrollment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliverabilityMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domain" TEXT,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "bounced" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "clicked" INTEGER NOT NULL DEFAULT 0,
    "replied" INTEGER NOT NULL DEFAULT 0,
    "unsubscribed" INTEGER NOT NULL DEFAULT 0,
    "spamComplaints" INTEGER NOT NULL DEFAULT 0,
    "deliverabilityScore" INTEGER NOT NULL DEFAULT 100,
    "reputationScore" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliverabilityMetric_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ScoringRule_orgId_enabled_idx" ON "ScoringRule"("orgId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringRule_orgId_name_key" ON "ScoringRule"("orgId", "name");

-- CreateIndex
CREATE INDEX "IntentSignal_orgId_companyId_idx" ON "IntentSignal"("orgId", "companyId");

-- CreateIndex
CREATE INDEX "IntentSignal_orgId_contactId_idx" ON "IntentSignal"("orgId", "contactId");

-- CreateIndex
CREATE INDEX "IntentSignal_orgId_type_idx" ON "IntentSignal"("orgId", "type");

-- CreateIndex
CREATE INDEX "IntentSignal_orgId_createdAt_idx" ON "IntentSignal"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanySignal_orgId_companyId_idx" ON "CompanySignal"("orgId", "companyId");

-- CreateIndex
CREATE INDEX "CompanySignal_orgId_type_idx" ON "CompanySignal"("orgId", "type");

-- CreateIndex
CREATE INDEX "CompanySignal_orgId_detectedAt_idx" ON "CompanySignal"("orgId", "detectedAt");

-- CreateIndex
CREATE INDEX "Sequence_orgId_status_idx" ON "Sequence"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_orgId_name_key" ON "Sequence"("orgId", "name");

-- CreateIndex
CREATE INDEX "SequenceStep_sequenceId_order_idx" ON "SequenceStep"("sequenceId", "order");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_orgId_status_idx" ON "SequenceEnrollment"("orgId", "status");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_orgId_sequenceId_idx" ON "SequenceEnrollment"("orgId", "sequenceId");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_orgId_nextActionAt_idx" ON "SequenceEnrollment"("orgId", "nextActionAt");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceEnrollment_sequenceId_email_key" ON "SequenceEnrollment"("sequenceId", "email");

-- CreateIndex
CREATE INDEX "SequenceEmailLog_orgId_enrollmentId_idx" ON "SequenceEmailLog"("orgId", "enrollmentId");

-- CreateIndex
CREATE INDEX "SequenceEmailLog_orgId_status_idx" ON "SequenceEmailLog"("orgId", "status");

-- CreateIndex
CREATE INDEX "SequenceEmailLog_orgId_sentAt_idx" ON "SequenceEmailLog"("orgId", "sentAt");

-- CreateIndex
CREATE INDEX "DeliverabilityMetric_orgId_date_idx" ON "DeliverabilityMetric"("orgId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DeliverabilityMetric_orgId_date_domain_key" ON "DeliverabilityMetric"("orgId", "date", "domain");
