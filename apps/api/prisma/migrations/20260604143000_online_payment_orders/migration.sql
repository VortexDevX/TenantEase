CREATE TYPE "OnlinePaymentOrderStatus" AS ENUM ('CREATED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "OnlinePaymentOrder" (
    "id" TEXT NOT NULL,
    "rentEntryId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "OnlinePaymentOrderStatus" NOT NULL DEFAULT 'CREATED',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "providerPayload" JSONB,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlinePaymentOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnlinePaymentOrder_razorpayOrderId_key" ON "OnlinePaymentOrder"("razorpayOrderId");
CREATE INDEX "OnlinePaymentOrder_tenantId_status_idx" ON "OnlinePaymentOrder"("tenantId", "status");
CREATE INDEX "OnlinePaymentOrder_rentEntryId_idx" ON "OnlinePaymentOrder"("rentEntryId");
CREATE INDEX "OnlinePaymentOrder_razorpayPaymentId_idx" ON "OnlinePaymentOrder"("razorpayPaymentId");

ALTER TABLE "OnlinePaymentOrder" ADD CONSTRAINT "OnlinePaymentOrder_rentEntryId_fkey" FOREIGN KEY ("rentEntryId") REFERENCES "RentEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentOrder" ADD CONSTRAINT "OnlinePaymentOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
