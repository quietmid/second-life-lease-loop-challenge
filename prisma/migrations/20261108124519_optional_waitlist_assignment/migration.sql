-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DemoRefurbishment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspection_id" TEXT NOT NULL,
    "completed_on" TEXT NOT NULL,
    "target_condition" TEXT NOT NULL,
    "usage_after" INTEGER NOT NULL,
    "cost_cents" INTEGER NOT NULL,
    "market_price_cents" INTEGER NOT NULL,
    "monthly_net_cents" INTEGER NOT NULL,
    "term_months" INTEGER NOT NULL,
    "waitlist_id" TEXT,
    "match_status" TEXT NOT NULL DEFAULT 'unassigned',
    "steps_json" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemoRefurbishment_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "DemoReturnInspection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DemoRefurbishment" ("completed_on", "cost_cents", "created_at", "id", "inspection_id", "market_price_cents", "monthly_net_cents", "steps_json", "target_condition", "term_months", "usage_after", "waitlist_id") SELECT "completed_on", "cost_cents", "created_at", "id", "inspection_id", "market_price_cents", "monthly_net_cents", "steps_json", "target_condition", "term_months", "usage_after", "waitlist_id" FROM "DemoRefurbishment";
DROP TABLE "DemoRefurbishment";
ALTER TABLE "new_DemoRefurbishment" RENAME TO "DemoRefurbishment";
CREATE UNIQUE INDEX "DemoRefurbishment_inspection_id_key" ON "DemoRefurbishment"("inspection_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
