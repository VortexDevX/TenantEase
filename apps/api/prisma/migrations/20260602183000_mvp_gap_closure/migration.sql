-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "referenceNumber" TEXT;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN "isVoided" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "replacedByReceiptId" TEXT;

-- DropIndex
DROP INDEX IF EXISTS "Receipt_paymentId_key";

-- CreateTable
CREATE TABLE "PropertySettings" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "rentDueDay" INTEGER NOT NULL DEFAULT 5,
    "lateFeePerDay" INTEGER NOT NULL DEFAULT 0,
    "lateFeeGraceDays" INTEGER NOT NULL DEFAULT 0,
    "ownerPan" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderConfig" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "preDueDays" INTEGER NOT NULL DEFAULT 3,
    "onDueEnabled" BOOLEAN NOT NULL DEFAULT true,
    "overdueFrequency" TEXT NOT NULL DEFAULT 'DAILY',
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "friendlyTemplate" TEXT NOT NULL DEFAULT 'Hi {{name}}, your rent for {{month}} is due on {{date}}.',
    "overdueTemplate" TEXT NOT NULL DEFAULT 'Dear {{name}}, your rent is overdue by {{days}} days. Please pay immediately.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceStatusChange" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "MaintenanceStatus",
    "toStatus" "MaintenanceStatus" NOT NULL,
    "changedByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rentEntryId" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "propertyId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomTransferRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fromRoomId" TEXT NOT NULL,
    "toRoomId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "monthlyRentBefore" INTEGER NOT NULL,
    "monthlyRentAfter" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomTransferRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacateRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "vacatedAt" TIMESTAMP(3) NOT NULL,
    "depositPaid" INTEGER NOT NULL,
    "damageDeduction" INTEGER NOT NULL DEFAULT 0,
    "pendingRent" INTEGER NOT NULL DEFAULT 0,
    "refundAmount" INTEGER NOT NULL DEFAULT 0,
    "refundStatus" TEXT NOT NULL DEFAULT 'pending',
    "finalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VacateRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertySettings_propertyId_key" ON "PropertySettings"("propertyId");
CREATE UNIQUE INDEX "ReminderConfig_propertyId_key" ON "ReminderConfig"("propertyId");
CREATE INDEX "MaintenanceStatusChange_requestId_idx" ON "MaintenanceStatusChange"("requestId");
CREATE INDEX "MaintenanceStatusChange_changedByUserId_idx" ON "MaintenanceStatusChange"("changedByUserId");
CREATE INDEX "ReminderLog_propertyId_sentAt_idx" ON "ReminderLog"("propertyId", "sentAt");
CREATE INDEX "ReminderLog_tenantId_idx" ON "ReminderLog"("tenantId");
CREATE INDEX "ReminderLog_rentEntryId_idx" ON "ReminderLog"("rentEntryId");
CREATE INDEX "Receipt_paymentId_idx" ON "Receipt"("paymentId");
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");
CREATE INDEX "Notification_propertyId_idx" ON "Notification"("propertyId");
CREATE INDEX "RoomTransferRecord_tenantId_idx" ON "RoomTransferRecord"("tenantId");
CREATE INDEX "RoomTransferRecord_propertyId_idx" ON "RoomTransferRecord"("propertyId");
CREATE INDEX "VacateRecord_tenantId_idx" ON "VacateRecord"("tenantId");
CREATE INDEX "VacateRecord_propertyId_idx" ON "VacateRecord"("propertyId");

-- AddForeignKey
ALTER TABLE "PropertySettings" ADD CONSTRAINT "PropertySettings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderConfig" ADD CONSTRAINT "ReminderConfig_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceStatusChange" ADD CONSTRAINT "MaintenanceStatusChange_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceStatusChange" ADD CONSTRAINT "MaintenanceStatusChange_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_rentEntryId_fkey" FOREIGN KEY ("rentEntryId") REFERENCES "RentEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomTransferRecord" ADD CONSTRAINT "RoomTransferRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomTransferRecord" ADD CONSTRAINT "RoomTransferRecord_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomTransferRecord" ADD CONSTRAINT "RoomTransferRecord_fromRoomId_fkey" FOREIGN KEY ("fromRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomTransferRecord" ADD CONSTRAINT "RoomTransferRecord_toRoomId_fkey" FOREIGN KEY ("toRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VacateRecord" ADD CONSTRAINT "VacateRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VacateRecord" ADD CONSTRAINT "VacateRecord_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VacateRecord" ADD CONSTRAINT "VacateRecord_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
