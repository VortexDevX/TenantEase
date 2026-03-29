import { RentStatus } from "@prisma/client";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { monthKey } from "../../lib/date.js";

export function computeRentStatus(amountDue: number, amountPaid: number, dueDate: Date) {
  if (amountPaid >= amountDue) {
    return RentStatus.PAID;
  }

  if (amountPaid > 0) {
    return RentStatus.PARTIAL;
  }

  if (dueDate < new Date()) {
    return RentStatus.OVERDUE;
  }

  return RentStatus.UNPAID;
}

export async function generateMonthlyRentEntries(propertyId: string, ownerProfileId: string, month?: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerProfileId },
    include: {
      tenants: {
        where: { status: { in: ["ACTIVE", "NOTICE"] } }
      }
    }
  });

  if (!property) {
    throw new AppError(404, "PROPERTY_NOT_FOUND", "Property not found");
  }

  const now = new Date();
  const targetMonth = month ?? monthKey(now);
  const dueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 5));

  for (const tenant of property.tenants) {
    await prisma.rentEntry.upsert({
      where: {
        tenantId_billingMonth: {
          tenantId: tenant.id,
          billingMonth: targetMonth
        }
      },
      update: {},
      create: {
        tenantId: tenant.id,
        billingMonth: targetMonth,
        dueDate,
        amountDue: tenant.monthlyRent,
        status: computeRentStatus(tenant.monthlyRent, 0, dueDate)
      }
    });
  }

  return {
    propertyId,
    billingMonth: targetMonth,
    generatedCount: property.tenants.length
  };
}

export async function recalculateRentEntry(rentEntryId: string) {
  const rentEntry = await prisma.rentEntry.findUnique({
    where: { id: rentEntryId },
    include: { payments: true }
  });

  if (!rentEntry) {
    throw new AppError(404, "RENT_ENTRY_NOT_FOUND", "Rent entry not found");
  }

  const amountPaid = rentEntry.payments
    .filter((payment) => !payment.isVoided)
    .reduce((sum, payment) => sum + payment.amount, 0);

  return prisma.rentEntry.update({
    where: { id: rentEntryId },
    data: {
      amountPaid,
      status: computeRentStatus(rentEntry.amountDue, amountPaid, rentEntry.dueDate)
    }
  });
}

