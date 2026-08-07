-- Provider identifiers and client idempotency keys prevent duplicate financial records.
ALTER TABLE "Invoice" ADD COLUMN "razorpayInvoiceId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "providerPaymentId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "ReminderLog" ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "Invoice_razorpayInvoiceId_key" ON "Invoice"("razorpayInvoiceId");
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE UNIQUE INDEX "ReminderLog_dedupeKey_key" ON "ReminderLog"("dedupeKey");

CREATE TYPE "OfflinePaymentClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "OfflinePaymentClaim" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rentEntryId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "referenceNumber" TEXT,
    "note" TEXT,
    "status" "OfflinePaymentClaimStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OfflinePaymentClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OfflinePaymentClaim_idempotencyKey_key" ON "OfflinePaymentClaim"("idempotencyKey");
CREATE INDEX "OfflinePaymentClaim_propertyId_status_createdAt_idx" ON "OfflinePaymentClaim"("propertyId", "status", "createdAt");
CREATE INDEX "OfflinePaymentClaim_tenantId_createdAt_idx" ON "OfflinePaymentClaim"("tenantId", "createdAt");
ALTER TABLE "OfflinePaymentClaim" ADD CONSTRAINT "OfflinePaymentClaim_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfflinePaymentClaim" ADD CONSTRAINT "OfflinePaymentClaim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfflinePaymentClaim" ADD CONSTRAINT "OfflinePaymentClaim_rentEntryId_fkey" FOREIGN KEY ("rentEntryId") REFERENCES "RentEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Tenant" ADD COLUMN "expectedVacateDate" TIMESTAMP(3);
CREATE INDEX "Tenant_status_expectedVacateDate_idx" ON "Tenant"("status", "expectedVacateDate");
