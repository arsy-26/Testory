/*
  Warnings:

  - A unique constraint covering the columns `[trackingToken]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `trackingToken` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Order_orderNumber_idx";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "trackingToken" TEXT;

UPDATE "Order" 
SET "trackingToken" = 'tk_' || encode(gen_random_bytes(8), 'hex')
WHERE "trackingToken" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "trackingToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_trackingToken_key" ON "Order"("trackingToken");