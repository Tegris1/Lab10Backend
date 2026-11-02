BEGIN;

-- CreateTable
CREATE TABLE "Category" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "nameSortKey" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "product_category_code_idx" ON "Product"("categoryCode");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryCode_fkey" FOREIGN KEY ("categoryCode") REFERENCES "Category"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL constraints are part of migration history, including writes outside Prisma.
ALTER TABLE "Category"
  ADD CONSTRAINT "category_code_allowed"
    CHECK ("code" IN ('cpu', 'gpu', 'ram', 'disk')),
  ADD CONSTRAINT "category_name_nonblank"
    CHECK ("name" ~ '[^[:space:]]');

ALTER TABLE "Product"
  ADD CONSTRAINT "product_id_positive" CHECK ("id" > 0),
  ADD CONSTRAINT "product_code_format"
    CHECK (char_length("code") = 10 AND "code" COLLATE "C" ~ '^[A-Z0-9]{10}$'),
  ADD CONSTRAINT "product_name_nonblank" CHECK ("name" ~ '[^[:space:]]'),
  ADD CONSTRAINT "product_price_nonnegative" CHECK ("price" >= 0),
  ADD CONSTRAINT "product_amount_nonnegative" CHECK ("amount" >= 0);

-- Match the UTF-8 byte comparison of Lab 07's normalized name key.
-- Preserve the original display name in the separate "name" column.
ALTER TABLE "Product"
  ALTER COLUMN "nameSortKey" TYPE TEXT COLLATE "C";

COMMIT;
