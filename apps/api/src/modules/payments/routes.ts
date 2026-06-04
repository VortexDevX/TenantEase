import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { assertPaymentAccess, assertRentEntryAccess } from "../../lib/auth-guards.js";
import { createAuditLog } from "../common/audit.js";
import { paymentInputSchema, paymentUpdateSchema } from "../common/schemas.js";
import { toPaymentDto, toReceiptDto } from "../common/serializers.js";
import { recalculateRentEntry } from "../rent/service.js";
import { generateReceipt, replaceReceiptForPayment, voidActiveReceiptsForPayment } from "../receipts/service.js";

export async function paymentRoutes(app: FastifyInstance) {
  app.post("/payments", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const body = paymentInputSchema.parse(request.body);
    const { ownerProfileId } = await assertRentEntryAccess(request, body.rentEntryId, "payment:write");
    const rentEntry = await prisma.rentEntry.findFirst({
      where: {
        id: body.rentEntryId,
        tenant: {
          property: { ownerProfileId }
        }
      }
    });

    if (!rentEntry) {
      throw new AppError(404, "RENT_ENTRY_NOT_FOUND", "Rent entry not found");
    }

    const payment = await prisma.payment.create({
      data: {
        rentEntryId: body.rentEntryId,
        amount: body.amount,
        mode: body.mode,
        paidAt: new Date(body.paidAt),
        referenceNumber: body.referenceNumber ?? null,
        note: body.note ?? null
      }
    });

    await recalculateRentEntry(body.rentEntryId);
    const receipt = await generateReceipt(payment.id, ownerProfileId);
    await createAuditLog({
      userId: request.user.sub,
      action: "payment.create",
      resource: "Payment",
      resourceId: payment.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });
    return ok({ payment: toPaymentDto(payment), receipt: toReceiptDto(receipt) });
  });

  app.get("/payments/:id", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    const { ownerProfileId } = await assertPaymentAccess(request, params.id, "payment:read");
    const payment = await prisma.payment.findFirst({
      where: {
        id: params.id,
        rentEntry: {
          tenant: { property: { ownerProfileId } }
        }
      }
    });

    if (!payment) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }

    return ok(toPaymentDto(payment));
  });

  app.put("/payments/:id", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    const body = paymentUpdateSchema.parse(request.body);
    const { ownerProfileId } = await assertPaymentAccess(request, params.id, "payment:write");
    const payment = await prisma.payment.findFirst({
      where: {
        id: params.id,
        rentEntry: {
          tenant: { property: { ownerProfileId } }
        }
      }
    });

    if (!payment) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
    if (payment.paidAt < ninetyDaysAgo) {
      throw new AppError(422, "PAYMENT_TOO_OLD", "Cannot edit payment older than 90 days");
    }

    const nextIsVoided = body.isVoided ?? payment.isVoided;
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        amount: body.amount,
        mode: body.mode,
        paidAt: body.paidAt ? new Date(body.paidAt) : undefined,
        referenceNumber: body.referenceNumber,
        note: body.note,
        isVoided: nextIsVoided,
        voidedAt: nextIsVoided ? (payment.voidedAt ?? new Date()) : null
      }
    });

    await recalculateRentEntry(updated.rentEntryId);
    const receipt = nextIsVoided
      ? await voidActiveReceiptsForPayment(updated.id).then(() => null)
      : await replaceReceiptForPayment(updated.id, ownerProfileId);
    await createAuditLog({
      userId: request.user.sub,
      action: body.isVoided ? "payment.void" : "payment.update",
      resource: "Payment",
      resourceId: updated.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });
    return ok({ payment: toPaymentDto(updated), receipt: receipt ? toReceiptDto(receipt) : null });
  });

  app.delete("/payments/:id", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    const { ownerProfileId } = await assertPaymentAccess(request, params.id, "payment:write");
    const payment = await prisma.payment.findFirst({
      where: {
        id: params.id,
        rentEntry: {
          tenant: { property: { ownerProfileId } }
        }
      }
    });

    if (!payment) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }

    if (payment.isVoided) {
      throw new AppError(422, "PAYMENT_ALREADY_VOIDED", "Payment is already voided");
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
    if (payment.paidAt < ninetyDaysAgo) {
      throw new AppError(422, "PAYMENT_TOO_OLD", "Cannot void payment older than 90 days");
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        isVoided: true,
        voidedAt: new Date()
      }
    });
    await recalculateRentEntry(updated.rentEntryId);
    await voidActiveReceiptsForPayment(updated.id);

    await createAuditLog({
      userId: request.user.sub,
      action: "payment.void",
      resource: "Payment",
      resourceId: updated.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok({ payment: toPaymentDto(updated), receipt: null });
  });
}
