-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "submitAction" TEXT NOT NULL DEFAULT 'CREATE_LEAD',
    "submitConfig" JSONB,
    "captchaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "utmTracking" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT,
    "customCss" TEXT,
    "totalSubmissions" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Form_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "source" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "leadId" TEXT,
    "contactId" TEXT,
    "processedAt" DATETIME,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormSubmission_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboundRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InboundRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebsiteVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "companyId" TEXT,
    "sessionId" TEXT,
    "pageUrl" TEXT NOT NULL,
    "pageTitle" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "country" TEXT,
    "city" TEXT,
    "visitScore" INTEGER NOT NULL DEFAULT 0,
    "isIdentified" BOOLEAN NOT NULL DEFAULT false,
    "leadId" TEXT,
    "contactId" TEXT,
    "metadata" JSONB,
    "visitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebsiteVisit_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WebsiteVisit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingPrep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "meetingId" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "companyOverview" TEXT,
    "contactProfile" TEXT,
    "previousInteractions" JSONB,
    "openDeals" JSONB,
    "recentEmails" JSONB,
    "suggestedQuestions" JSONB,
    "talkingPoints" JSONB,
    "summary" TEXT,
    "actionItems" JSONB,
    "followUpTasks" JSONB,
    "dealRisk" TEXT,
    "dealRiskReason" TEXT,
    "sentiment" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeetingPrep_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'DAILY',
    "date" DATETIME NOT NULL,
    "newLeads" INTEGER NOT NULL DEFAULT 0,
    "qualifiedLeads" INTEGER NOT NULL DEFAULT 0,
    "dealsCreated" INTEGER NOT NULL DEFAULT 0,
    "dealsWon" INTEGER NOT NULL DEFAULT 0,
    "dealsLost" INTEGER NOT NULL DEFAULT 0,
    "revenueWon" INTEGER NOT NULL DEFAULT 0,
    "revenuePipeline" INTEGER NOT NULL DEFAULT 0,
    "emailsSent" INTEGER NOT NULL DEFAULT 0,
    "emailsOpened" INTEGER NOT NULL DEFAULT 0,
    "emailsReplied" INTEGER NOT NULL DEFAULT 0,
    "emailsBounced" INTEGER NOT NULL DEFAULT 0,
    "callsMade" INTEGER NOT NULL DEFAULT 0,
    "callsConnected" INTEGER NOT NULL DEFAULT 0,
    "meetingsBooked" INTEGER NOT NULL DEFAULT 0,
    "meetingsHeld" INTEGER NOT NULL DEFAULT 0,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "sequencesEnrolled" INTEGER NOT NULL DEFAULT 0,
    "websiteVisits" INTEGER NOT NULL DEFAULT 0,
    "formSubmissions" INTEGER NOT NULL DEFAULT 0,
    "byUser" JSONB,
    "bySource" JSONB,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsSnapshot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Form_orgId_isActive_idx" ON "Form"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Form_orgId_slug_key" ON "Form"("orgId", "slug");

-- CreateIndex
CREATE INDEX "FormSubmission_orgId_formId_idx" ON "FormSubmission"("orgId", "formId");

-- CreateIndex
CREATE INDEX "FormSubmission_orgId_status_idx" ON "FormSubmission"("orgId", "status");

-- CreateIndex
CREATE INDEX "FormSubmission_orgId_createdAt_idx" ON "FormSubmission"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "InboundRule_orgId_isActive_priority_idx" ON "InboundRule"("orgId", "isActive", "priority");

-- CreateIndex
CREATE INDEX "WebsiteVisit_orgId_anonymousId_idx" ON "WebsiteVisit"("orgId", "anonymousId");

-- CreateIndex
CREATE INDEX "WebsiteVisit_orgId_companyId_idx" ON "WebsiteVisit"("orgId", "companyId");

-- CreateIndex
CREATE INDEX "WebsiteVisit_orgId_visitedAt_idx" ON "WebsiteVisit"("orgId", "visitedAt");

-- CreateIndex
CREATE INDEX "WebsiteVisit_orgId_isIdentified_idx" ON "WebsiteVisit"("orgId", "isIdentified");

-- CreateIndex
CREATE INDEX "MeetingPrep_orgId_meetingId_idx" ON "MeetingPrep"("orgId", "meetingId");

-- CreateIndex
CREATE INDEX "MeetingPrep_orgId_contactId_idx" ON "MeetingPrep"("orgId", "contactId");

-- CreateIndex
CREATE INDEX "MeetingPrep_orgId_companyId_idx" ON "MeetingPrep"("orgId", "companyId");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_orgId_period_idx" ON "AnalyticsSnapshot"("orgId", "period");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_orgId_date_idx" ON "AnalyticsSnapshot"("orgId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsSnapshot_orgId_period_date_key" ON "AnalyticsSnapshot"("orgId", "period", "date");
