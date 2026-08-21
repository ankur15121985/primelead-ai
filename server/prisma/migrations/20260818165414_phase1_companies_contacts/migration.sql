-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "website" TEXT,
    "domain" TEXT,
    "industry" TEXT,
    "subIndustry" TEXT,
    "description" TEXT,
    "foundedYear" INTEGER,
    "employeeCount" INTEGER,
    "employeeRange" TEXT,
    "employeeGrowth" REAL,
    "revenueRange" TEXT,
    "fundingTotal" INTEGER,
    "fundingRounds" JSONB,
    "headquarters" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "technologies" JSONB,
    "socialProfiles" JSONB,
    "phone" TEXT,
    "emailDomains" JSONB,
    "naicsCode" TEXT,
    "sicCode" TEXT,
    "companyType" TEXT,
    "ownership" TEXT,
    "parentCompanyId" TEXT,
    "subsidiaries" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "score" INTEGER NOT NULL DEFAULT 0,
    "tags" JSONB,
    "customFields" JSONB,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Company_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanyContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "fullName" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "seniority" TEXT,
    "email" TEXT,
    "emailStatus" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "location" TEXT,
    "linkedinUrl" TEXT,
    "otherProfiles" JSONB,
    "yearsAtCompany" INTEGER,
    "employmentHistory" JSONB,
    "education" JSONB,
    "skills" JSONB,
    "notes" TEXT,
    "tags" JSONB,
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanyContact_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanyContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "baseUrl" TEXT,
    "config" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "costPerQuery" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastError" TEXT,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DataProvider_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataProvenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "providerId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "value" TEXT,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "confidence" REAL,
    "verifiedAt" DATETIME,
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataProvenance_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DataProvenance_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "DataProvider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entityType" TEXT NOT NULL DEFAULT 'companies',
    "filters" JSONB NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "alertEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastAlertAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedSearch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "List" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'STATIC',
    "entityType" TEXT NOT NULL DEFAULT 'companies',
    "filters" JSONB,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "tags" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "List_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Company_orgId_industry_idx" ON "Company"("orgId", "industry");

-- CreateIndex
CREATE INDEX "Company_orgId_country_idx" ON "Company"("orgId", "country");

-- CreateIndex
CREATE INDEX "Company_orgId_employeeCount_idx" ON "Company"("orgId", "employeeCount");

-- CreateIndex
CREATE INDEX "Company_orgId_status_idx" ON "Company"("orgId", "status");

-- CreateIndex
CREATE INDEX "Company_orgId_createdAt_idx" ON "Company"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Company_orgId_domain_key" ON "Company"("orgId", "domain");

-- CreateIndex
CREATE INDEX "CompanyContact_orgId_companyId_idx" ON "CompanyContact"("orgId", "companyId");

-- CreateIndex
CREATE INDEX "CompanyContact_orgId_seniority_idx" ON "CompanyContact"("orgId", "seniority");

-- CreateIndex
CREATE INDEX "CompanyContact_orgId_department_idx" ON "CompanyContact"("orgId", "department");

-- CreateIndex
CREATE INDEX "CompanyContact_orgId_status_idx" ON "CompanyContact"("orgId", "status");

-- CreateIndex
CREATE INDEX "CompanyContact_orgId_createdAt_idx" ON "CompanyContact"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyContact_orgId_email_key" ON "CompanyContact"("orgId", "email");

-- CreateIndex
CREATE INDEX "DataProvider_orgId_type_idx" ON "DataProvider"("orgId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DataProvider_orgId_name_key" ON "DataProvider"("orgId", "name");

-- CreateIndex
CREATE INDEX "DataProvenance_orgId_entityType_entityId_idx" ON "DataProvenance"("orgId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "DataProvenance_orgId_fieldName_idx" ON "DataProvenance"("orgId", "fieldName");

-- CreateIndex
CREATE INDEX "DataProvenance_orgId_providerId_idx" ON "DataProvenance"("orgId", "providerId");

-- CreateIndex
CREATE INDEX "DataProvenance_orgId_collectedAt_idx" ON "DataProvenance"("orgId", "collectedAt");

-- CreateIndex
CREATE INDEX "SavedSearch_orgId_userId_idx" ON "SavedSearch"("orgId", "userId");

-- CreateIndex
CREATE INDEX "SavedSearch_orgId_entityType_idx" ON "SavedSearch"("orgId", "entityType");

-- CreateIndex
CREATE INDEX "List_orgId_entityType_idx" ON "List"("orgId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "List_orgId_name_key" ON "List"("orgId", "name");

-- CreateIndex
CREATE INDEX "ListMember_orgId_listId_idx" ON "ListMember"("orgId", "listId");

-- CreateIndex
CREATE INDEX "ListMember_orgId_entityType_entityId_idx" ON "ListMember"("orgId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ListMember_listId_entityType_entityId_key" ON "ListMember"("listId", "entityType", "entityId");
