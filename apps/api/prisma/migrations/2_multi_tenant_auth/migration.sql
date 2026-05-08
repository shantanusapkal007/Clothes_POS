-- Multi-tenant base tables.
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stores" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "memberships" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "email" TEXT,
  "role" TEXT NOT NULL DEFAULT 'owner',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

INSERT INTO "organizations" ("id", "name")
VALUES ('legacy_org_default', 'Clothing Store')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "stores" ("id", "organization_id", "name")
VALUES ('legacy_store_default', 'legacy_org_default', 'Clothing Store')
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "store_id" TEXT;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "store_id" TEXT;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "cashier_user_id" TEXT;
ALTER TABLE "bill_items" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
ALTER TABLE "bill_items" ADD COLUMN IF NOT EXISTS "store_id" TEXT;

UPDATE "products"
SET "organization_id" = 'legacy_org_default',
    "store_id" = 'legacy_store_default'
WHERE "organization_id" IS NULL OR "store_id" IS NULL;

UPDATE "bills"
SET "organization_id" = 'legacy_org_default',
    "store_id" = 'legacy_store_default'
WHERE "organization_id" IS NULL OR "store_id" IS NULL;

UPDATE "bill_items" AS "item"
SET "organization_id" = "bill"."organization_id",
    "store_id" = "bill"."store_id"
FROM "bills" AS "bill"
WHERE "item"."bill_id" = "bill"."id"
  AND ("item"."organization_id" IS NULL OR "item"."store_id" IS NULL);

ALTER TABLE "products" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "bills" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "bills" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "bill_items" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "bill_items" ALTER COLUMN "store_id" SET NOT NULL;

DROP INDEX IF EXISTS "products_barcode_key";

CREATE UNIQUE INDEX IF NOT EXISTS "memberships_organization_id_user_id_key" ON "memberships"("organization_id", "user_id");
CREATE INDEX IF NOT EXISTS "memberships_user_id_idx" ON "memberships"("user_id");
CREATE INDEX IF NOT EXISTS "memberships_store_id_idx" ON "memberships"("store_id");
CREATE INDEX IF NOT EXISTS "stores_organization_id_idx" ON "stores"("organization_id");
CREATE INDEX IF NOT EXISTS "products_organization_id_idx" ON "products"("organization_id");
CREATE INDEX IF NOT EXISTS "products_store_id_idx" ON "products"("store_id");
CREATE UNIQUE INDEX IF NOT EXISTS "products_store_id_barcode_key" ON "products"("store_id", "barcode");
CREATE INDEX IF NOT EXISTS "bills_organization_id_idx" ON "bills"("organization_id");
CREATE INDEX IF NOT EXISTS "bills_store_id_idx" ON "bills"("store_id");
CREATE INDEX IF NOT EXISTS "bill_items_organization_id_idx" ON "bill_items"("organization_id");
CREATE INDEX IF NOT EXISTS "bill_items_store_id_idx" ON "bill_items"("store_id");

ALTER TABLE "stores"
  ADD CONSTRAINT "stores_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "products"
  ADD CONSTRAINT "products_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "products"
  ADD CONSTRAINT "products_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bills"
  ADD CONSTRAINT "bills_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bills"
  ADD CONSTRAINT "bills_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Replace broad authenticated-user policies with tenant-scoped policies.
DROP POLICY IF EXISTS "Products are readable by authenticated users" ON "products";
DROP POLICY IF EXISTS "Products full access for service role" ON "products";
DROP POLICY IF EXISTS "Bills are readable by authenticated users" ON "bills";
DROP POLICY IF EXISTS "Bills can be created by authenticated users" ON "bills";
DROP POLICY IF EXISTS "Bills full access for service role" ON "bills";
DROP POLICY IF EXISTS "Bill items are readable by authenticated users" ON "bill_items";
DROP POLICY IF EXISTS "Bill items can be created by authenticated users" ON "bill_items";
DROP POLICY IF EXISTS "Bill items full access for service role" ON "bill_items";

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bill_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can read organizations"
  ON "organizations"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "memberships"
      WHERE "memberships"."organization_id" = "organizations"."id"
        AND "memberships"."user_id" = auth.uid()::text
    )
  );

CREATE POLICY "Organization members can read stores"
  ON "stores"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "memberships"
      WHERE "memberships"."store_id" = "stores"."id"
        AND "memberships"."user_id" = auth.uid()::text
    )
  );

CREATE POLICY "Users can read their memberships"
  ON "memberships"
  FOR SELECT
  USING ("user_id" = auth.uid()::text);

CREATE POLICY "Store members can read products"
  ON "products"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "memberships"
      WHERE "memberships"."store_id" = "products"."store_id"
        AND "memberships"."user_id" = auth.uid()::text
    )
  );

CREATE POLICY "Store members can write products"
  ON "products"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "memberships"
      WHERE "memberships"."store_id" = "products"."store_id"
        AND "memberships"."user_id" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "memberships"
      WHERE "memberships"."store_id" = "products"."store_id"
        AND "memberships"."user_id" = auth.uid()::text
    )
  );

CREATE POLICY "Store members can read bills"
  ON "bills"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "memberships"
      WHERE "memberships"."store_id" = "bills"."store_id"
        AND "memberships"."user_id" = auth.uid()::text
    )
  );

CREATE POLICY "Store members can create bills"
  ON "bills"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "memberships"
      WHERE "memberships"."store_id" = "bills"."store_id"
        AND "memberships"."user_id" = auth.uid()::text
    )
  );

CREATE POLICY "Store members can read bill items"
  ON "bill_items"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "memberships"
      WHERE "memberships"."store_id" = "bill_items"."store_id"
        AND "memberships"."user_id" = auth.uid()::text
    )
  );

CREATE POLICY "Store members can create bill items"
  ON "bill_items"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "memberships"
      WHERE "memberships"."store_id" = "bill_items"."store_id"
        AND "memberships"."user_id" = auth.uid()::text
    )
  );
