-- CreateEnum
ALTER TYPE "UserRole" ADD VALUE 'STAFF';

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('MANAGER', 'ACCOUNTANT', 'WARDEN');

-- CreateEnum
CREATE TYPE "StaffInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateTable
CREATE TABLE "staff_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "inviteStatus" "StaffInviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitePhone" TEXT NOT NULL,
    "inviteEmail" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_assignments_userId_propertyId_key" ON "staff_assignments"("userId", "propertyId");

-- CreateIndex
CREATE INDEX "staff_assignments_propertyId_idx" ON "staff_assignments"("propertyId");

-- CreateIndex
CREATE INDEX "staff_assignments_userId_idx" ON "staff_assignments"("userId");

-- CreateIndex
CREATE INDEX "staff_assignments_invitePhone_idx" ON "staff_assignments"("invitePhone");

-- CreateIndex
CREATE INDEX "staff_assignments_inviteStatus_isActive_idx" ON "staff_assignments"("inviteStatus", "isActive");

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
