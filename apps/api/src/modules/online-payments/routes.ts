import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import {
  createRazorpayOrder,
  getRazorpayCheckoutKeyId,
  verifyRazorpayWebhookSignature
} from "../../providers/razorpay-provider.js";
import { generateReceipt } from "../receipts/service.js";
import { recalculateRentEntry } from "../rent/service.js";
import { beginWebhookEvent, finishWebhookEvent } from "../webhooks/events.js";

const createOrderSchema = z.object({
  rentEntryId: z.string().uuid()
});

const webhookSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string(),
        order_id: z.string().nullable().optional(),
        amount: z.number().int().positive(),
        currency: z.string().default("INR"),
        status: z.string().optional(),
        captured_at: z.number().int().optional()
      })
    }).optional()
  }).passthrough()
}).passthrough();

function serializeOrder(order: {
  id: string;
  rentEntryId: string;
  amount: number;
  currency: string;
  status: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  createdAt: Date;
}) {
  return {
    id: order.id,
    rentEntryId: order.rentEntryId,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    providerOrderId: order.razorpayOrderId ?? "",
    providerPaymentId: order.razorpayPaymentId,
    keyId: getRazorpayCheckoutKeyId(),
    createdAt: order.createdAt.toISOString()
  };
}

function asJson(input: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue;
}

export async function onlinePaymentRoutes(app: FastifyInstance) {
  app.post("/tenant-portal/payments/orders", { preHandler: [app.authenticateTenant] }, async (request) => {
    const tenantId = request.user.tenantId;
    if (!tenantId) {
      throw new AppError(403, "AUTH_FORBIDDEN", "Tenant account required");
    }

    const body = createOrderSchema.parse(request.body);
    const rentEntry = await prisma.rentEntry.findFirst({
      where: {
        id: body.rentEntryId,
        tenantId
      },
      include: {
        tenant: {
          include: {
            property: {
              include: {
                ownerProfile: {
                  include: { subscription: true }
                }
              }
            }
          }
        }
      }
    });

    if (!rentEntry) {
      throw new AppError(404, "RENT_ENTRY_NOT_FOUND", "Rent entry not found");
    }

    const subscription = rentEntry.tenant.property.ownerProfile.subscription;
    if (!subscription?.onlinePaymentsEnabled || subscription.status !== "ACTIVE") {
      throw new AppError(402, "ONLINE_PAYMENTS_DISABLED", "Online payments are not enabled for this property");
    }

    const pendingAmount = rentEntry.amountDue - rentEntry.amountPaid;
    if (pendingAmount <= 0 || rentEntry.status === "PAID") {
      throw new AppError(422, "VALIDATION_ERROR", "Rent entry is already paid");
    }

    const existing = await prisma.onlinePaymentOrder.findFirst({
      where: {
        rentEntryId: rentEntry.id,
        tenantId,
        status: "CREATED"
      },
      orderBy: { createdAt: "desc" }
    });

    if (
      existing?.razorpayOrderId &&
      existing.amount === pendingAmount &&
      (!existing.expiresAt || existing.expiresAt > new Date())
    ) {
      return ok(serializeOrder(existing));
    }

    if (existing) {
      await prisma.onlinePaymentOrder.update({
        where: { id: existing.id },
        data: { status: "EXPIRED" }
      });
    }

    const localOrder = await prisma.onlinePaymentOrder.create({
      data: {
        rentEntryId: rentEntry.id,
        tenantId,
        amount: pendingAmount,
        currency: "INR",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    const providerOrder = await createRazorpayOrder({
      amount: localOrder.amount,
      currency: localOrder.currency,
      receipt: localOrder.id.slice(0, 40),
      notes: {
        tenantId,
        rentEntryId: rentEntry.id,
        propertyId: rentEntry.tenant.propertyId
      }
    });

    const updated = await prisma.onlinePaymentOrder.update({
      where: { id: localOrder.id },
      data: {
        razorpayOrderId: providerOrder.id,
        providerPayload: asJson(providerOrder.raw)
      }
    });

    return ok(serializeOrder(updated));
  });

  app.post("/webhooks/razorpay/payments", async (request) => {
    const rawBody = request.rawBody ?? JSON.stringify(request.body ?? {});
    const signature = request.headers["x-razorpay-signature"]?.toString();
    verifyRazorpayWebhookSignature(rawBody, signature);

    const eventId = request.headers["x-razorpay-event-id"]?.toString();
    const event = webhookSchema.parse(request.body);
    const trackedEvent = await beginWebhookEvent({
      provider: "razorpay",
      eventId,
      eventType: event.event,
      rawBody,
      payload: event
    });
    if (trackedEvent.duplicate) {
      return ok({ processed: false, reason: "duplicate_event", eventId });
    }

    const paymentEntity = event.payload.payment?.entity;

    try {
      if (!paymentEntity?.order_id) {
        await finishWebhookEvent({
          id: trackedEvent.event.id,
          status: "IGNORED",
          error: "missing_order_id"
        });
        return ok({ processed: false, reason: "missing_order_id", eventId });
      }

      const onlineOrder = await prisma.onlinePaymentOrder.findUnique({
        where: { razorpayOrderId: paymentEntity.order_id },
        include: {
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

      if (!onlineOrder) {
        throw new AppError(404, "ONLINE_PAYMENT_ORDER_NOT_FOUND", "Online payment order not found");
      }

      if (onlineOrder.status === "PAID" && event.event === "payment.failed") {
        await finishWebhookEvent({
          id: trackedEvent.event.id,
          status: "IGNORED",
          resourceType: "OnlinePaymentOrder",
          resourceId: onlineOrder.id,
          error: "order_already_paid"
        });
        return ok({ processed: false, reason: "order_already_paid", eventId });
      }

      if (
        onlineOrder.status === "PAID" &&
        onlineOrder.razorpayPaymentId &&
        onlineOrder.razorpayPaymentId !== paymentEntity.id
      ) {
        throw new AppError(409, "VALIDATION_ERROR", "Paid order received a different provider payment id");
      }

      if (event.event === "payment.failed") {
        const failedOrder = await prisma.onlinePaymentOrder.update({
          where: { id: onlineOrder.id },
          data: {
            status: "FAILED",
            razorpayPaymentId: paymentEntity.id,
            providerPayload: asJson(event)
          }
        });
        await finishWebhookEvent({
          id: trackedEvent.event.id,
          status: "PROCESSED",
          resourceType: "OnlinePaymentOrder",
          resourceId: failedOrder.id
        });
        return ok({ processed: true, order: serializeOrder(failedOrder), eventId });
      }

      if (event.event !== "payment.captured") {
        await finishWebhookEvent({
          id: trackedEvent.event.id,
          status: "IGNORED",
          resourceType: "OnlinePaymentOrder",
          resourceId: onlineOrder.id,
          error: "ignored_event"
        });
        return ok({ processed: false, reason: "ignored_event", eventId });
      }

      if (paymentEntity.amount !== onlineOrder.amount || paymentEntity.currency !== onlineOrder.currency) {
        await prisma.onlinePaymentOrder.update({
          where: { id: onlineOrder.id },
          data: {
            status: "FAILED",
            razorpayPaymentId: paymentEntity.id,
            providerPayload: asJson(event)
          }
        });
        throw new AppError(422, "VALIDATION_ERROR", "Payment amount or currency did not match the order");
      }

      const ownerProfileId = onlineOrder.rentEntry.tenant.property.ownerProfileId;
      const paidAt = paymentEntity.captured_at ? new Date(paymentEntity.captured_at * 1000) : new Date();
      const { payment, paidOrder } = await prisma.$transaction(async (tx) => {
        const existingPayment = await tx.payment.findUnique({
          where: { providerPaymentId: paymentEntity.id }
        });
        if (existingPayment && existingPayment.rentEntryId !== onlineOrder.rentEntryId) {
          throw new AppError(409, "VALIDATION_ERROR", "Provider payment was linked to another rent entry");
        }

        const payment = existingPayment ?? await tx.payment.create({
          data: {
            rentEntryId: onlineOrder.rentEntryId,
            amount: onlineOrder.amount,
            mode: "ONLINE",
            paidAt,
            referenceNumber: paymentEntity.id,
            providerPaymentId: paymentEntity.id,
            note: "Razorpay online rent payment"
          }
        });

        const paidOrder = await tx.onlinePaymentOrder.update({
          where: { id: onlineOrder.id },
          data: {
            status: "PAID",
            razorpayPaymentId: paymentEntity.id,
            razorpaySignature: signature,
            providerPayload: asJson(event),
            paidAt
          }
        });

        await recalculateRentEntry(onlineOrder.rentEntryId, tx);
        return { payment, paidOrder };
      }, { isolationLevel: "Serializable" });

      const receipt = await generateReceipt(payment.id, ownerProfileId);
      await finishWebhookEvent({
        id: trackedEvent.event.id,
        status: "PROCESSED",
        resourceType: "Payment",
        resourceId: payment.id
      });

      return ok({
        processed: true,
        order: serializeOrder(paidOrder),
        paymentId: payment.id,
        receiptId: receipt.id,
        eventId
      });
    } catch (error) {
      await finishWebhookEvent({
        id: trackedEvent.event.id,
        status: "FAILED",
        error: error instanceof Error ? error.message : "Webhook processing failed"
      }).catch(() => undefined);
      throw error;
    }
  });
}
