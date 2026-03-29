import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { paymentInputSchema, paymentUpdateSchema } from "../common/schemas.js";
import { toPaymentDto } from "../common/serializers.js";
import { recalculateRentEntry } from "../rent/service.js";

export async function paymentRoutes(app: FastifyInstance) {
  app.post("/payments", { preHandler: [app.authenticate] }, async (request) => {
    const body = paymentInputSchema.parse(request.body);
    const rentEntry = await prisma.rentEntry.findFirst({
      where: {
        id: body.rentEntryId,
        tenant: {
          property: { ownerProfileId: request.user.ownerProfileId }
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
        note: body.note ?? null
      }
    });

    await recalculateRentEntry(body.rentEntryId);
    return ok(toPaymentDto(payment));
  });

  app.get("/payments/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    const payment = await prisma.payment.findFirst({
      where: {
        id: params.id,
        rentEntry: {
          tenant: { property: { ownerProfileId: request.user.ownerProfileId } }
        }
      }
    });

    if (!payment) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }

    return ok(toPaymentDto(payment));
  });

  app.put("/payments/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    const body = paymentUpdateSchema.parse(request.body);
    const payment = await prisma.payment.findFirst({
      where: {
        id: params.id,
        rentEntry: {
          tenant: { property: { ownerProfileId: request.user.ownerProfileId } }
        }
      }
    });

    if (!payment) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        amount: body.amount,
        mode: body.mode,
        note: body.note,
        isVoided: body.isVoided ?? payment.isVoided,
        voidedAt: body.isVoided ? new Date() : null
      }
    });

    await recalculateRentEntry(updated.rentEntryId);
    return ok(toPaymentDto(updated));
  });
}

