-- CreateTable
CREATE TABLE "DemoQuote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asset_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "quote_date" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL,
    "term_months" INTEGER NOT NULL,
    "down_cents" INTEGER NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "price_version" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemoQuote_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DemoLease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quote_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "signed_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "term_months" INTEGER NOT NULL,
    "list_price_cents" INTEGER NOT NULL,
    "down_cents" INTEGER NOT NULL,
    "monthly_net_cents" INTEGER NOT NULL,
    "buyout_cents" INTEGER NOT NULL,
    "price_version" INTEGER NOT NULL,
    "return_requested_on" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemoLease_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "DemoQuote" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DemoLease_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DemoInvoice" (
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
    CONSTRAINT "DemoInvoice_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "DemoLease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DemoQuote_customer_id_idx" ON "DemoQuote"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "DemoLease_quote_id_key" ON "DemoLease"("quote_id");

-- CreateIndex
CREATE INDEX "DemoLease_customer_id_idx" ON "DemoLease"("customer_id");

-- CreateIndex
CREATE INDEX "DemoInvoice_lease_id_issue_date_idx" ON "DemoInvoice"("lease_id", "issue_date");
