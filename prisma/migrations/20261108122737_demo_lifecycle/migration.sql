-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "current_net_price_cents" INTEGER;

-- AlterTable
ALTER TABLE "DemoLease" ADD COLUMN "bought_out_on" TEXT;

-- CreateTable
CREATE TABLE "DemoEarlyExit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lease_id" TEXT NOT NULL,
    "requested_on" TEXT NOT NULL,
    "months_elapsed" INTEGER NOT NULL,
    "remaining_contract_cents" INTEGER NOT NULL,
    "market_value_cents" INTEGER NOT NULL,
    "settlement_cents" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemoEarlyExit_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "DemoLease" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DemoReturnInspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asset_id" TEXT NOT NULL,
    "lease_id" TEXT,
    "inspected_on" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "usage_unit" TEXT NOT NULL,
    "usage_value" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemoReturnInspection_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DemoReturnInspection_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "DemoLease" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DemoRefurbishment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspection_id" TEXT NOT NULL,
    "completed_on" TEXT NOT NULL,
    "target_condition" TEXT NOT NULL,
    "usage_after" INTEGER NOT NULL,
    "cost_cents" INTEGER NOT NULL,
    "market_price_cents" INTEGER NOT NULL,
    "monthly_net_cents" INTEGER NOT NULL,
    "term_months" INTEGER NOT NULL,
    "waitlist_id" TEXT NOT NULL,
    "steps_json" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemoRefurbishment_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "DemoReturnInspection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoEarlyExit_lease_id_key" ON "DemoEarlyExit"("lease_id");

-- CreateIndex
CREATE UNIQUE INDEX "DemoReturnInspection_lease_id_key" ON "DemoReturnInspection"("lease_id");

-- CreateIndex
CREATE INDEX "DemoReturnInspection_asset_id_inspected_on_idx" ON "DemoReturnInspection"("asset_id", "inspected_on");

-- CreateIndex
CREATE UNIQUE INDEX "DemoRefurbishment_inspection_id_key" ON "DemoRefurbishment"("inspection_id");
