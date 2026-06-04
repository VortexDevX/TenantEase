-- CreateEnum
CREATE TYPE "UtilityType" AS ENUM ('ELECTRICITY', 'WATER', 'GAS', 'INTERNET');

-- CreateEnum
CREATE TYPE "BillingModel" AS ENUM ('FLAT_RATE', 'PER_TENANT', 'INDIVIDUAL_METER', 'SHARED_METER');

-- CreateEnum
CREATE TYPE "AnnouncementCategory" AS ENUM ('GENERAL', 'MAINTENANCE', 'PAYMENT', 'RULE_CHANGE', 'EMERGENCY');

-- AlterTable
ALTER TABLE "RentEntry" ADD COLUMN     "utilityCharges" JSONB;

-- CreateTable
CREATE TABLE "UtilityReading" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT,
    "utilityType" "UtilityType" NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "previousReading" INTEGER,
    "currentReading" INTEGER,
    "unitsConsumed" INTEGER,
    "ratePerUnit" INTEGER,
    "totalCharge" INTEGER NOT NULL,
    "billingModel" "BillingModel" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilityReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "AnnouncementCategory" NOT NULL DEFAULT 'GENERAL',
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "targetFloor" INTEGER,
    "targetRoomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "templateType" TEXT NOT NULL DEFAULT 'pg',
    "state" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "duration" TEXT,
    "customClauses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "agreementData" JSONB,
    "pdfPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UtilityReading_propertyId_month_year_idx" ON "UtilityReading"("propertyId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "UtilityReading_propertyId_roomId_utilityType_month_year_key" ON "UtilityReading"("propertyId", "roomId", "utilityType", "month", "year");

-- CreateIndex
CREATE INDEX "announcements_propertyId_idx" ON "announcements"("propertyId");

-- CreateIndex
CREATE INDEX "announcements_createdAt_idx" ON "announcements"("createdAt");

-- CreateIndex
CREATE INDEX "announcement_reads_announcementId_idx" ON "announcement_reads"("announcementId");

-- CreateIndex
CREATE INDEX "announcement_reads_tenantId_idx" ON "announcement_reads"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_reads_announcementId_tenantId_key" ON "announcement_reads"("announcementId", "tenantId");

-- CreateIndex
CREATE INDEX "agreements_tenantId_idx" ON "agreements"("tenantId");

-- CreateIndex
CREATE INDEX "agreements_propertyId_idx" ON "agreements"("propertyId");

-- AddForeignKey
ALTER TABLE "UtilityReading" ADD CONSTRAINT "UtilityReading_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityReading" ADD CONSTRAINT "UtilityReading_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
