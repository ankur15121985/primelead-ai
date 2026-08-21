-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "contactId" TEXT,
    "companyId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT,
    "sourceRef" TEXT,
    "evidence" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "geoLocation" TEXT,
    "grantedAt" DATETIME,
    "withdrawnAt" DATETIME,
    "expiresAt" DATETIME,
    "lawfulBasis" TEXT,
    "version" TEXT,
    "verifiedAt" DATETIME,
    "verifiedBy" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConsentRecord_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuppressionEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "contactId" TEXT,
    "companyId" TEXT,
    "reason" TEXT NOT NULL,
    "reasonDetail" TEXT,
    "source" TEXT,
    "sourceRef" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "suppressedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "removedAt" DATETIME,
    "removedBy" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SuppressionEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entityType" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "autoDelete" BOOLEAN NOT NULL DEFAULT false,
    "actionBeforeDelete" TEXT,
    "notifyBeforeDelete" BOOLEAN NOT NULL DEFAULT false,
    "notifyEmail" TEXT,
    "notifyDaysBefore" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" DATETIME,
    "recordsDeleted" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RetentionPolicy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'CSV',
    "filters" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "ipAddress" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExportJob_id_fkey" FOREIGN KEY ("id") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataAccessRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "contactEmail" TEXT,
    "contactId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "responseNotes" TEXT,
    "dataProvided" BOOLEAN NOT NULL DEFAULT false,
    "dataDeleted" BOOLEAN NOT NULL DEFAULT false,
    "dataAnonymized" BOOLEAN NOT NULL DEFAULT false,
    "deadlineAt" DATETIME,
    "completedAt" DATETIME,
    "completedBy" TEXT,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DataAccessRequest_id_fkey" FOREIGN KEY ("id") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "rateLimit" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" DATETIME,
    "lastUsedIp" TEXT,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "revokedReason" TEXT,
    "createdBy" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "events" JSONB NOT NULL,
    "ipWhitelist" JSONB,
    "signatureHeader" TEXT DEFAULT 'x-webhook-signature',
    "retryPolicy" TEXT,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "timeoutMs" INTEGER NOT NULL DEFAULT 5000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastTriggeredAt" DATETIME,
    "lastStatus" TEXT,
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebhookEndpoint_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "httpStatus" INTEGER,
    "responseBody" TEXT,
    "responseHeaders" JSONB,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" DATETIME,
    "signature" TEXT,
    "ipAddress" TEXT,
    "durationMs" INTEGER,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ConsentRecord_orgId_type_idx" ON "ConsentRecord"("orgId", "type");

-- CreateIndex
CREATE INDEX "ConsentRecord_orgId_contactId_idx" ON "ConsentRecord"("orgId", "contactId");

-- CreateIndex
CREATE INDEX "ConsentRecord_orgId_status_idx" ON "ConsentRecord"("orgId", "status");

-- CreateIndex
CREATE INDEX "ConsentRecord_orgId_createdAt_idx" ON "ConsentRecord"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "SuppressionEntry_orgId_type_idx" ON "SuppressionEntry"("orgId", "type");

-- CreateIndex
CREATE INDEX "SuppressionEntry_orgId_contactId_idx" ON "SuppressionEntry"("orgId", "contactId");

-- CreateIndex
CREATE INDEX "SuppressionEntry_orgId_value_idx" ON "SuppressionEntry"("orgId", "value");

-- CreateIndex
CREATE INDEX "SuppressionEntry_orgId_createdAt_idx" ON "SuppressionEntry"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SuppressionEntry_orgId_type_value_key" ON "SuppressionEntry"("orgId", "type", "value");

-- CreateIndex
CREATE INDEX "RetentionPolicy_orgId_entityType_idx" ON "RetentionPolicy"("orgId", "entityType");

-- CreateIndex
CREATE INDEX "RetentionPolicy_orgId_isActive_idx" ON "RetentionPolicy"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_orgId_name_key" ON "RetentionPolicy"("orgId", "name");

-- CreateIndex
CREATE INDEX "ExportJob_orgId_userId_idx" ON "ExportJob"("orgId", "userId");

-- CreateIndex
CREATE INDEX "ExportJob_orgId_status_idx" ON "ExportJob"("orgId", "status");

-- CreateIndex
CREATE INDEX "ExportJob_orgId_entityType_idx" ON "ExportJob"("orgId", "entityType");

-- CreateIndex
CREATE INDEX "ExportJob_orgId_createdAt_idx" ON "ExportJob"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "DataAccessRequest_orgId_status_idx" ON "DataAccessRequest"("orgId", "status");

-- CreateIndex
CREATE INDEX "DataAccessRequest_orgId_type_idx" ON "DataAccessRequest"("orgId", "type");

-- CreateIndex
CREATE INDEX "DataAccessRequest_orgId_userId_idx" ON "DataAccessRequest"("orgId", "userId");

-- CreateIndex
CREATE INDEX "DataAccessRequest_orgId_createdAt_idx" ON "DataAccessRequest"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiKey_orgId_isActive_idx" ON "ApiKey"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "ApiKey_keyPrefix_idx" ON "ApiKey"("keyPrefix");

-- CreateIndex
CREATE INDEX "ApiKey_orgId_createdAt_idx" ON "ApiKey"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_orgId_name_key" ON "ApiKey"("orgId", "name");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_orgId_isActive_idx" ON "WebhookEndpoint"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_orgId_createdAt_idx" ON "WebhookEndpoint"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEndpoint_orgId_name_key" ON "WebhookEndpoint"("orgId", "name");

-- CreateIndex
CREATE INDEX "WebhookDelivery_orgId_endpointId_idx" ON "WebhookDelivery"("orgId", "endpointId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_orgId_event_idx" ON "WebhookDelivery"("orgId", "event");

-- CreateIndex
CREATE INDEX "WebhookDelivery_orgId_status_idx" ON "WebhookDelivery"("orgId", "status");

-- CreateIndex
CREATE INDEX "WebhookDelivery_orgId_createdAt_idx" ON "WebhookDelivery"("orgId", "createdAt");
