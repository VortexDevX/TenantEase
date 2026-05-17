-- AlterEnum
ALTER TYPE "PaymentMode" ADD VALUE 'ONLINE';

-- AlterTable
ALTER TABLE "Room" ADD COLUMN "floor" INTEGER DEFAULT 0;
