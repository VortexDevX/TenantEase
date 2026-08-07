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
    const payment = await prisma.$transaction(async (tx) => {
      if (body.idempotencyKey) {
        const existing = await tx.payment.findFirst({
          where: {
            idempotencyKey: body.idempotencyKey,
            rentEntry: { tenant: { property: { ownerProfileId } } }
          }
        });
        if (existing) {
          if (
            existing.rentEntryId !== body.rentEntryId ||
            existing.amount !== body.amount ||
            existing.mode !== body.mode
          ) {
            throw new AppError(409, "VALIDATION_ERROR", "Idempotency key was already used for another payment");
          }
          return existing;
        }
      }

      const rentEntry = await tx.rentEntry.findFirst({
        where: {
          id: body.rentEntryId,
          tenant: { property: { ownerProfileId } }
        },
        include: { payments: true }
      });

      if (!rentEntry) {
        throw new AppError(404, "RENT_ENTRY_NOT_FOUND", "Rent entry not found");
      }

      const amountPaid = rentEntry.payments
        .filter((item) => !item.isVoided)
        .reduce((sum, item) => sum + item.amount, 0);
      const remaining = Math.max(0, rentEntry.amountDue - amountPaid);
      if (body.amount > remaining) {
        throw new AppError(422, "VALIDATION_ERROR", "Payment amount cannot exceed pending balance", { remaining });
      }

      const created = await tx.payment.create({
        data: {
          rentEntryId: body.rentEntryId,
          amount: body.amount,
          mode: body.mode,
          paidAt: new Date(body.paidAt),
          idempotencyKey: body.idempotencyKey,
          referenceNumber: body.referenceNumber ?? null,
          note: body.note ?? null
        }
      });
      await recalculateRentEntry(body.rentEntryId, tx);
      return created;
    }, { isolationLevel: "Serializable" });

    const receipt = await generateReceipt(payment.id, ownerProfileId).catch((error) => {
      request.log.error({ err: error, paymentId: payment.id }, "Receipt generation deferred");
      return null;
    });
    await createAuditLog({
      userId: request.user.sub,
      action: "payment.create",
      resource: "Payment",
      resourceId: payment.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });
    return ok({ payment: toPaymentDto(payment), receipt: receipt ? toReceiptDto(receipt) : null });
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

    if (payment.mode === "ONLINE") {
      throw new AppError(422, "VALIDATION_ERROR", "Online payments are immutable; use provider refund reconciliation");
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
    if (payment.paidAt < ninetyDaysAgo) {
      throw new AppError(422, "PAYMENT_TOO_OLD", "Cannot edit payment older than 90 days");
    }

    const nextIsVoided = body.isVoided ?? payment.isVoided;
    const updated = await prisma.$transaction(async (tx) => {
      const rentEntry = await tx.rentEntry.findUnique({
        where: { id: payment.rentEntryId },
        include: { payments: true }
      });
      if (!rentEntry) throw new AppError(404, "RENT_ENTRY_NOT_FOUND", "Rent entry not found");

      const otherPaid = rentEntry.payments
        .filter((item) => item.id !== payment.id && !item.isVoided)
        .reduce((sum, item) => sum + item.amount, 0);
      if (!nextIsVoided && body.amount !== undefined && body.amount > rentEntry.amountDue - otherPaid) {
        throw new AppError(422, "VALIDATION_ERROR", "Payment amount cannot exceed pending balance", {
          remaining: Math.max(0, rentEntry.amountDue - otherPaid)
        });
      }

      const next = await tx.payment.update({
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
      await recalculateRentEntry(next.rentEntryId, tx);
      return next;
    }, { isolationLevel: "Serializable" });
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

    if (payment.mode === "ONLINE") {
      throw new AppError(422, "VALIDATION_ERROR", "Online payments are immutable; use provider refund reconciliation");
    }

    if (payment.isVoided) {
      throw new AppError(422, "PAYMENT_ALREADY_VOIDED", "Payment is already voided");
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
    if (payment.paidAt < ninetyDaysAgo) {
      throw new AppError(422, "PAYMENT_TOO_OLD", "Cannot void payment older than 90 days");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.payment.update({
        where: { id: payment.id },
        data: {
          isVoided: true,
          voidedAt: new Date()
        }
      });
      await recalculateRentEntry(next.rentEntryId, tx);
      return next;
    }, { isolationLevel: "Serializable" });
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
