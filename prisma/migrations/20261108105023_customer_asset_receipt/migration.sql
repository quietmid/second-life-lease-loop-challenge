-- CreateTable
CREATE TABLE "DemoAssetReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lease_id" TEXT NOT NULL,
    "received_on" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "usage_unit" TEXT NOT NULL,
    "usage_value" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemoAssetReceipt_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "DemoLease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoAssetReceipt_lease_id_key" ON "DemoAssetReceipt"("lease_id");
