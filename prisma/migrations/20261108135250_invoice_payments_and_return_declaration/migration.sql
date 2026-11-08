-- AlterTable
ALTER TABLE "DemoLease" ADD COLUMN "return_condition" TEXT;
ALTER TABLE "DemoLease" ADD COLUMN "return_usage_value" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DemoInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lease_id" TEXT NOT NULL,
    "issue_date" TEXT NOT NULL,
    "due_date" TEXT NOT NULL,
    "period_start" TEXT NOT NULL,
    "period_end_exclusive" TEXT NOT NULL,
    "net_cents" INTEGER NOT NULL,
    "vat_rate_percent" REAL NOT NULL,
    "vat_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'unpaid',
    "payment_method" TEXT,
    "paid_on" TEXT,
    CONSTRAINT "DemoInvoice_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "DemoLease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DemoInvoice" ("due_date", "id", "issue_date", "lease_id", "net_cents", "period_end_exclusive", "period_start", "total_cents", "vat_cents", "vat_rate_percent") SELECT "due_date", "id", "issue_date", "lease_id", "net_cents", "period_end_exclusive", "period_start", "total_cents", "vat_cents", "vat_rate_percent" FROM "DemoInvoice";
DROP TABLE "DemoInvoice";
ALTER TABLE "new_DemoInvoice" RENAME TO "DemoInvoice";
CREATE INDEX "DemoInvoice_lease_id_issue_date_idx" ON "DemoInvoice"("lease_id", "issue_date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
