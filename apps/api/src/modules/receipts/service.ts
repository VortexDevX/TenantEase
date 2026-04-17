import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { storageProvider, pdfProvider } from "../../providers/mock-providers.js";

export async function generateReceipt(paymentId: string, ownerProfileId: string) {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      rentEntry: {
        tenant: {
          property: { ownerProfileId }
        }
      }
    },
    include: {
      receipt: true,
      rentEntry: {
        include: {
          tenant: {
            include: {
              property: true
            }
          }
        }
      }
    }
  });

  if (!payment) {
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  }

  if (payment.isVoided) {
    throw new AppError(422, "PAYMENT_NOT_FOUND", "Cannot generate receipt for a voided payment");
  }

  if (payment.receipt) {
    return payment.receipt;
  }

  const receiptNumber = `RCPT-${new Date().getUTCFullYear()}-${payment.id.slice(0, 8).toUpperCase()}`;
  const pdf = await pdfProvider.createReceiptPdf({
    receiptNumber,
    propertyName: payment.rentEntry.tenant.property.name,
    tenantName: payment.rentEntry.tenant.fullName,
    amount: payment.amount,
    paidAt: payment.paidAt.toISOString(),
    mode: payment.mode
  });

  const filePath = await storageProvider.saveBuffer(`receipts/${receiptNumber}.pdf`, pdf);

  return prisma.receipt.create({
    data: {
      paymentId: payment.id,
      receiptNumber,
      filePath
    }
  });
}

