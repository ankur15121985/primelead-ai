/*
  Warnings:

  - You are about to alter the column `discount` on the `Invoice` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `paidAmount` on the `Invoice` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `subtotal` on the `Invoice` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `total` on the `Invoice` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `amount` on the `InvoiceItem` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `cgst` on the `InvoiceItem` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `igst` on the `InvoiceItem` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `rate` on the `InvoiceItem` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `sgst` on the `InvoiceItem` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `expectedValue` on the `Lead` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `priceMonthly` on the `Plan` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `priceYearly` on the `Plan` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `discount` on the `Quotation` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `subtotal` on the `Quotation` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `total` on the `Quotation` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `amount` on the `QuotationItem` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `cgst` on the `QuotationItem` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `igst` on the `QuotationItem` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `rate` on the `QuotationItem` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `sgst` on the `QuotationItem` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `commissionAmount` on the `Referral` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `amount` on the `ReferralPayout` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.

*/
-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "deviceName" TEXT,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "reason" TEXT,
    "newDevice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MfaSecret" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MfaSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Role_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "leadId" TEXT,
    "quotationId" TEXT,
    "customerName" TEXT NOT NULL,
    "company" TEXT,
    "billingAddress" TEXT,
    "gstin" TEXT,
    "hsnSac" TEXT,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "gstSummary" JSONB,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "dueDate" DATETIME,
    "terms" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("billingAddress", "company", "createdAt", "customerName", "discount", "dueDate", "gstSummary", "gstin", "hsnSac", "id", "leadId", "number", "orgId", "paidAmount", "quotationId", "status", "subtotal", "terms", "total", "updatedAt") SELECT "billingAddress", "company", "createdAt", "customerName", "discount", "dueDate", "gstSummary", "gstin", "hsnSac", "id", "leadId", "number", "orgId", "paidAmount", "quotationId", "status", "subtotal", "terms", "total", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_orgId_status_idx" ON "Invoice"("orgId", "status");
CREATE UNIQUE INDEX "Invoice_orgId_number_key" ON "Invoice"("orgId", "number");
CREATE TABLE "new_InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hsnSac" TEXT,
    "quantity" REAL NOT NULL DEFAULT 1,
    "rate" INTEGER NOT NULL DEFAULT 0,
    "discountPct" REAL NOT NULL DEFAULT 0,
    "taxPct" REAL NOT NULL DEFAULT 0,
    "cgst" INTEGER NOT NULL DEFAULT 0,
    "sgst" INTEGER NOT NULL DEFAULT 0,
    "igst" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceItem" ("amount", "cgst", "createdAt", "description", "discountPct", "hsnSac", "id", "igst", "invoiceId", "quantity", "rate", "sgst", "taxPct") SELECT "amount", "cgst", "createdAt", "description", "discountPct", "hsnSac", "id", "igst", "invoiceId", "quantity", "rate", "sgst", "taxPct" FROM "InvoiceItem";
DROP TABLE "InvoiceItem";
ALTER TABLE "new_InvoiceItem" RENAME TO "InvoiceItem";
CREATE TABLE "new_Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "company" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "campaignId" TEXT,
    "campaignName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "stageId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "score" INTEGER NOT NULL DEFAULT 0,
    "expectedValue" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "tags" JSONB,
    "customFields" JSONB,
    "lastContactedAt" DATETIME,
    "nextFollowUpAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("campaignId", "campaignName", "company", "createdAt", "customFields", "deletedAt", "email", "expectedValue", "id", "lastContactedAt", "name", "nextFollowUpAt", "notes", "orgId", "ownerId", "phone", "priority", "score", "source", "stageId", "status", "tags", "updatedAt") SELECT "campaignId", "campaignName", "company", "createdAt", "customFields", "deletedAt", "email", "expectedValue", "id", "lastContactedAt", "name", "nextFollowUpAt", "notes", "orgId", "ownerId", "phone", "priority", "score", "source", "stageId", "status", "tags", "updatedAt" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE INDEX "Lead_orgId_status_idx" ON "Lead"("orgId", "status");
CREATE INDEX "Lead_orgId_stageId_idx" ON "Lead"("orgId", "stageId");
CREATE INDEX "Lead_orgId_ownerId_idx" ON "Lead"("orgId", "ownerId");
CREATE INDEX "Lead_orgId_source_idx" ON "Lead"("orgId", "source");
CREATE INDEX "Lead_orgId_createdAt_idx" ON "Lead"("orgId", "createdAt");
CREATE INDEX "Lead_orgId_nextFollowUpAt_idx" ON "Lead"("orgId", "nextFollowUpAt");
CREATE UNIQUE INDEX "Lead_orgId_phone_key" ON "Lead"("orgId", "phone");
CREATE UNIQUE INDEX "Lead_orgId_email_key" ON "Lead"("orgId", "email");
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerPaymentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "createdAt", "currency", "id", "orgId", "provider", "providerPaymentId", "status", "subscriptionId") SELECT "amount", "createdAt", "currency", "id", "orgId", "provider", "providerPaymentId", "status", "subscriptionId" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_orgId_idx" ON "Payment"("orgId");
CREATE TABLE "new_Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "priceYearly" INTEGER NOT NULL,
    "features" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Plan" ("active", "createdAt", "features", "id", "name", "priceMonthly", "priceYearly", "slug") SELECT "active", "createdAt", "features", "id", "name", "priceMonthly", "priceYearly", "slug" FROM "Plan";
DROP TABLE "Plan";
ALTER TABLE "new_Plan" RENAME TO "Plan";
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");
CREATE TABLE "new_Quotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "leadId" TEXT,
    "customerName" TEXT NOT NULL,
    "company" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "gstSummary" JSONB,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "terms" TEXT,
    "validityDays" INTEGER NOT NULL DEFAULT 15,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "invoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quotation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Quotation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Quotation" ("address", "company", "createdAt", "customerName", "discount", "email", "gstSummary", "gstin", "id", "invoiceId", "leadId", "number", "orgId", "phone", "status", "subtotal", "terms", "total", "updatedAt", "validityDays") SELECT "address", "company", "createdAt", "customerName", "discount", "email", "gstSummary", "gstin", "id", "invoiceId", "leadId", "number", "orgId", "phone", "status", "subtotal", "terms", "total", "updatedAt", "validityDays" FROM "Quotation";
DROP TABLE "Quotation";
ALTER TABLE "new_Quotation" RENAME TO "Quotation";
CREATE INDEX "Quotation_orgId_status_idx" ON "Quotation"("orgId", "status");
CREATE UNIQUE INDEX "Quotation_orgId_number_key" ON "Quotation"("orgId", "number");
CREATE TABLE "new_QuotationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quotationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "rate" INTEGER NOT NULL DEFAULT 0,
    "discountPct" REAL NOT NULL DEFAULT 0,
    "taxPct" REAL NOT NULL DEFAULT 0,
    "cgst" INTEGER NOT NULL DEFAULT 0,
    "sgst" INTEGER NOT NULL DEFAULT 0,
    "igst" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuotationItem" ("amount", "cgst", "createdAt", "description", "discountPct", "id", "igst", "quantity", "quotationId", "rate", "sgst", "taxPct") SELECT "amount", "cgst", "createdAt", "description", "discountPct", "id", "igst", "quantity", "quotationId", "rate", "sgst", "taxPct" FROM "QuotationItem";
DROP TABLE "QuotationItem";
ALTER TABLE "new_QuotationItem" RENAME TO "QuotationItem";
CREATE TABLE "new_Referral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "referredOrgId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "commissionPct" REAL NOT NULL DEFAULT 10,
    "commissionAmount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Referral_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Referral_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Referral_referredOrgId_fkey" FOREIGN KEY ("referredOrgId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Referral" ("commissionAmount", "commissionPct", "createdAt", "id", "notes", "orgId", "referralCode", "referredOrgId", "referrerUserId", "status", "updatedAt") SELECT "commissionAmount", "commissionPct", "createdAt", "id", "notes", "orgId", "referralCode", "referredOrgId", "referrerUserId", "status", "updatedAt" FROM "Referral";
DROP TABLE "Referral";
ALTER TABLE "new_Referral" RENAME TO "Referral";
CREATE UNIQUE INDEX "Referral_referralCode_key" ON "Referral"("referralCode");
CREATE UNIQUE INDEX "Referral_referredOrgId_key" ON "Referral"("referredOrgId");
CREATE INDEX "Referral_orgId_referrerUserId_idx" ON "Referral"("orgId", "referrerUserId");
CREATE INDEX "Referral_referralCode_idx" ON "Referral"("referralCode");
CREATE TABLE "new_ReferralPayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referralId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralPayout_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReferralPayout" ("amount", "createdAt", "currency", "id", "paidAt", "referralId", "status") SELECT "amount", "createdAt", "currency", "id", "paidAt", "referralId", "status" FROM "ReferralPayout";
DROP TABLE "ReferralPayout";
ALTER TABLE "new_ReferralPayout" RENAME TO "ReferralPayout";
CREATE INDEX "ReferralPayout_referralId_idx" ON "ReferralPayout"("referralId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SALES',
    "title" TEXT,
    "teamId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "emailVerifiedAt" DATETIME,
    "avatarUrl" TEXT,
    "lastLoginAt" DATETIME,
    "lastAssignmentAt" DATETIME,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("active", "avatarUrl", "createdAt", "email", "emailVerifiedAt", "id", "lastAssignmentAt", "lastLoginAt", "name", "orgId", "passwordHash", "phone", "role", "title", "updatedAt") SELECT "active", "avatarUrl", "createdAt", "email", "emailVerifiedAt", "id", "lastAssignmentAt", "lastLoginAt", "name", "orgId", "passwordHash", "phone", "role", "title", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE INDEX "User_orgId_role_idx" ON "User"("orgId", "role");
CREATE INDEX "User_orgId_teamId_idx" ON "User"("orgId", "teamId");
CREATE UNIQUE INDEX "User_orgId_email_key" ON "User"("orgId", "email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginHistory_userId_createdAt_idx" ON "LoginHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginHistory_email_createdAt_idx" ON "LoginHistory"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MfaSecret_userId_key" ON "MfaSecret"("userId");

-- CreateIndex
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");

-- CreateIndex
CREATE INDEX "Role_orgId_idx" ON "Role"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_orgId_key_key" ON "Role"("orgId", "key");

-- CreateIndex
CREATE INDEX "Team_orgId_idx" ON "Team"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_orgId_name_key" ON "Team"("orgId", "name");
