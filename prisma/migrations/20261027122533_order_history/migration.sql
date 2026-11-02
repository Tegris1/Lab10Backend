BEGIN;

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'SHIPPED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "orderedAt" TIMESTAMPTZ(3) NOT NULL,
    "totalGrosze" BIGINT NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productId" INTEGER,
    "nameSnapshot" TEXT NOT NULL,
    "codeSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceGrosze" BIGINT NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE INDEX "Order_userId_orderedAt_idx" ON "Order"("userId", "orderedAt");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_lineNumber_key" ON "OrderItem"("orderId", "lineNumber");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve exact nonnegative grosze and positive quantities even outside the application.
ALTER TABLE "Order"
  ADD CONSTRAINT "order_total_nonnegative" CHECK ("totalGrosze" >= 0),
  ADD CONSTRAINT "order_number_nonblank" CHECK ("number" ~ '[^[:space:]]');

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "order_item_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_item_price_nonnegative" CHECK ("unitPriceGrosze" >= 0),
  ADD CONSTRAINT "order_item_line_positive" CHECK ("lineNumber" > 0),
  ADD CONSTRAINT "order_item_name_nonblank" CHECK ("nameSnapshot" ~ '[^[:space:]]'),
  ADD CONSTRAINT "order_item_code_format"
    CHECK (char_length("codeSnapshot") = 10 AND "codeSnapshot" COLLATE "C" ~ '^[A-Z0-9]{10}$');

COMMIT;
