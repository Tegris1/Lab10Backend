BEGIN;

-- Historical orders have no request key. New checkouts use a per-user key for safe retries.
ALTER TABLE "Order" ADD COLUMN "requestKey" TEXT;

CREATE UNIQUE INDEX "Order_userId_requestKey_key" ON "Order"("userId", "requestKey");

ALTER TABLE "Order" ADD CONSTRAINT "order_request_key_uuid"
  CHECK ("requestKey" IS NULL OR "requestKey" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');

COMMIT;
