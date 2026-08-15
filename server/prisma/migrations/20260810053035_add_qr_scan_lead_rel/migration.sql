-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QrScan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qrId" TEXT NOT NULL,
    "leadId" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QrScan_qrId_fkey" FOREIGN KEY ("qrId") REFERENCES "QrCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QrScan_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QrScan" ("createdAt", "id", "ip", "leadId", "qrId") SELECT "createdAt", "id", "ip", "leadId", "qrId" FROM "QrScan";
DROP TABLE "QrScan";
ALTER TABLE "new_QrScan" RENAME TO "QrScan";
CREATE INDEX "QrScan_qrId_idx" ON "QrScan"("qrId");
CREATE INDEX "QrScan_leadId_idx" ON "QrScan"("leadId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
