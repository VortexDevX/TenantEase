import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import type { SubscriptionPlan } from "@tenantease/types";
import { z } from "zod";
import { requireOwnerProfileId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import {
  cancelRazorpaySubscription,
  createRazorpaySubscription,
  getRazorpayCheckoutKeyId,
  verifyRazorpayWebhookSignature
} from "../../providers/razorpay-provider.js";
import {
  ensureSubscription,
  getSubscriptionOverview,
  getPlanDefinition,
  listSubscriptionPlans,
  planData,
  toInvoiceDto
} from "./service.js";
import { beginWebhookEvent, finishWebhookEvent } from "../webhooks/events.js";

const paidPlanSchema = z.enum(["STARTER", "PRO", "BUSINESS"]);
const checkoutSchema = z.object({
  plan: paidPlanSchema
});
const cancelSchema = z.object({
  cancelAtCycleEnd: z.boolean().default(false)
});
const subscriptionWebhookSchema = z.object({
  event: z.string(),
  payload: z.object({
    subscription: z.object({
      entity: z.object({
        id: z.string(),
        current_start: z.number().int().nullable().optional(),
        current_end: z.number().int().nullable().optional(),
        notes: z.record(z.string(), z.string()).optional()
      }).passthrough()
    }).optional(),
    invoice: z.object({
      entity: z.object({
        id: z.string().optional(),
        subscription_id: z.string().optional(),
        payment_id: z.string().nullable().optional(),
        status: z.string().optional()
      }).passthrough()
    }).optional(),
    payment: z.object({
      entity: z.object({
        id: z.string().optional()
      }).passthrough()
    }).optional()
  }).passthrough()
}).passthrough();

function asJson(input: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue;
}

function invoiceNumber(subscriptionId: string) {
  return `INV-${new Date().getUTCFullYear()}-${subscriptionId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

async function serializeCheckout(subscriptionId: string, invoiceId: string, providerSubscriptionId: string, shortUrl: string | null) {
  const subscription = await prisma.subscription.findUniqueOrThrow({
    where: { id: subscriptionId }
  });
  const [propertyCount, staffCount, invoice] = await Promise.all([
    prisma.property.count({ where: { ownerProfileId: subscription.ownerProfileId } }),
    prisma.staffAssignment.count({
      where: {
        isActive: true,
        inviteStatus: { not: "REVOKED" },
        property: { ownerProfileId: subscription.ownerProfileId }
      }
    }),
    prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  ]);

  const pendingPlan = subscription.pendingPlan ?? subscription.plan;
  const definition = getPlanDefinition(pendingPlan);
  return {
    plan: pendingPlan,
    amount: definition.priceMonthly,
    providerSubscriptionId,
    shortUrl,
    keyId: getRazorpayCheckoutKeyId(),
    invoice: toInvoiceDto(invoice),
    subscription: {
      id: subscription.id,
      ownerProfileId: subscription.ownerProfileId,
      plan: subscription.plan,
      pendingPlan: subscription.pendingPlan,
      status: subscription.status,
      maxProperties: subscription.maxProperties,
      maxStaffAccounts: subscription.maxStaffAccounts,
      smsEnabled: subscription.smsEnabled,
      whatsappEnabled: subscription.whatsappEnabled,
      emailEnabled: subscription.emailEnabled,
      onlinePaymentsEnabled: subscription.onlinePaymentsEnabled,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      usage: {
        properties: propertyCount,
        staffAccounts: staffCount
      }
    }
  };
}

export async function subscriptionRoutes(app: FastifyInstance) {
  app.get("/subscription/plans", async () => {
    return ok(listSubscriptionPlans());
  });

  app.get("/subscription", { preHandler: [app.authenticate] }, async (request) => {
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    return ok(await getSubscriptionOverview(ownerProfileId));
  });

  app.get("/subscription/invoices", { preHandler: [app.authenticate] }, async (request) => {
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    const subscription = await ensureSubscription(ownerProfileId);
    const invoices = await prisma.invoice.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: "desc" },
      take: 24
    });

    return ok(invoices.map(toInvoiceDto));
  });

  app.post("/subscription/checkout", { preHandler: [app.authenticate] }, async (request) => {
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    const body = checkoutSchema.parse(request.body);
    const subscription = await ensureSubscription(ownerProfileId);

    if (subscription.plan === body.plan && subscription.status === "ACTIVE" && !subscription.pendingPlan) {
      throw new AppError(422, "VALIDATION_ERROR", "This plan is already active");
    }

    const providerSubscription = await createRazorpaySubscription({
      plan: body.plan,
      ownerProfileId
    });
    const now = new Date();
    const plan = getPlanDefinition(body.plan);

    const result = await prisma.$transaction(async (tx) => {
      await tx.invoice.updateMany({
        where: {
          subscriptionId: subscription.id,
          status: "PENDING"
        },
        data: { status: "VOID" }
      });

      const updatedSubscription = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          pendingPlan: body.plan,
          razorpaySubscriptionId: providerSubscription.id
        }
      });

      const invoice = await tx.invoice.create({
        data: {
          subscriptionId: updatedSubscription.id,
          invoiceNumber: invoiceNumber(updatedSubscription.id),
          amount: plan.priceMonthly,
          status: "PENDING",
          periodStart: now,
          periodEnd: addMonths(now, 1)
        }
      });

      return { subscriptionId: updatedSubscription.id, invoiceId: invoice.id };
    });

    return ok(await serializeCheckout(
      result.subscriptionId,
      result.invoiceId,
      providerSubscription.id,
      providerSubscription.shortUrl
    ));
  });

  app.post("/subscription/cancel", { preHandler: [app.authenticate] }, async (request) => {
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    const body = cancelSchema.parse(request.body);
    const subscription = await ensureSubscription(ownerProfileId);

    if (subscription.plan === "FREE" && !subscription.pendingPlan) {
      throw new AppError(422, "VALIDATION_ERROR", "Free plan does not need cancellation");
    }

    if (!body.cancelAtCycleEnd) {
      const [propertyCount, staffCount] = await Promise.all([
        prisma.property.count({ where: { ownerProfileId } }),
        prisma.staffAssignment.count({
          where: {
            isActive: true,
            inviteStatus: { not: "REVOKED" },
            property: { ownerProfileId }
          }
        })
      ]);
      const free = getPlanDefinition("FREE");
      if (propertyCount > free.maxProperties || staffCount > free.maxStaffAccounts) {
        throw new AppError(422, "VALIDATION_ERROR", "Reduce properties and staff to Free plan limits before immediate downgrade", {
          propertyCount,
          staffCount,
          maxProperties: free.maxProperties,
          maxStaffAccounts: free.maxStaffAccounts
        });
      }
    }

    if (subscription.razorpaySubscriptionId) {
      await cancelRazorpaySubscription({
        providerSubscriptionId: subscription.razorpaySubscriptionId,
        cancelAtCycleEnd: body.cancelAtCycleEnd
      });
    }

    if (body.cancelAtCycleEnd) {
      const updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          pendingPlan: "FREE",
          currentPeriodEnd: subscription.currentPeriodEnd ?? addMonths(new Date(), 1)
        }
      });
      return ok({
        cancelAtCycleEnd: true,
        subscription: await getSubscriptionOverview(updated.ownerProfileId)
      });
    }

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        ...planData("FREE"),
        status: "ACTIVE",
        pendingPlan: null,
        razorpaySubscriptionId: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: null
      }
    });

    await prisma.invoice.updateMany({
      where: {
        subscriptionId: updated.id,
        status: "PENDING"
      },
      data: { status: "VOID" }
    });
    await prisma.reminderConfig.updateMany({
      where: { property: { ownerProfileId } },
      data: { smsEnabled: false, whatsappEnabled: false, emailEnabled: true }
    });

    return ok({
      cancelAtCycleEnd: false,
      subscription: await getSubscriptionOverview(updated.ownerProfileId)
    });
  });

  app.post("/webhooks/razorpay/subscriptions", async (request) => {
    const rawBody = request.rawBody ?? JSON.stringify(request.body ?? {});
    const signature = request.headers["x-razorpay-signature"]?.toString();
    verifyRazorpayWebhookSignature(rawBody, signature);

    const eventId = request.headers["x-razorpay-event-id"]?.toString();
    const event = subscriptionWebhookSchema.parse(request.body);
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

    const providerSubscriptionId =
      event.payload.subscription?.entity.id ??
      event.payload.invoice?.entity.subscription_id;

    try {
      if (!providerSubscriptionId) {
        await finishWebhookEvent({
          id: trackedEvent.event.id,
          status: "IGNORED",
          error: "missing_subscription_id"
        });
        return ok({ processed: false, reason: "missing_subscription_id", eventId });
      }

      const subscription = await prisma.subscription.findFirst({
        where: { razorpaySubscriptionId: providerSubscriptionId }
      });

      if (!subscription) {
        throw new AppError(404, "SUBSCRIPTION_INACTIVE", "Subscription not found for Razorpay event");
      }

      if (event.event === "subscription.cancelled") {
        const [propertyCount, staffCount] = await Promise.all([
          prisma.property.count({ where: { ownerProfileId: subscription.ownerProfileId } }),
          prisma.staffAssignment.count({
            where: { isActive: true, inviteStatus: { not: "REVOKED" }, property: { ownerProfileId: subscription.ownerProfileId } }
          })
        ]);
        const free = getPlanDefinition("FREE");
        const exceedsFree = propertyCount > free.maxProperties || staffCount > free.maxStaffAccounts;
        await prisma.$transaction(async (tx) => {
          await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              ...planData("FREE"),
              status: exceedsFree ? "CANCELLED" : "ACTIVE",
              maxProperties: Math.max(free.maxProperties, propertyCount),
              maxStaffAccounts: Math.max(free.maxStaffAccounts, staffCount),
              pendingPlan: null,
              razorpaySubscriptionId: null,
              currentPeriodStart: new Date(),
              currentPeriodEnd: null
            }
          });
          await tx.reminderConfig.updateMany({
            where: { property: { ownerProfileId: subscription.ownerProfileId } },
            data: { smsEnabled: false, whatsappEnabled: false, emailEnabled: free.emailEnabled }
          });
        });
        await finishWebhookEvent({
          id: trackedEvent.event.id,
          status: "PROCESSED",
          resourceType: "Subscription",
          resourceId: subscription.id
        });
        return ok({ processed: true, eventId });
      }

      if (!["subscription.activated", "subscription.charged", "invoice.paid"].includes(event.event)) {
        await finishWebhookEvent({
          id: trackedEvent.event.id,
          status: "IGNORED",
          resourceType: "Subscription",
          resourceId: subscription.id,
          error: "ignored_event"
        });
        return ok({ processed: false, reason: "ignored_event", eventId });
      }

      const nextPlan = (subscription.pendingPlan ?? subscription.plan) as SubscriptionPlan;
      const currentStart = event.payload.subscription?.entity.current_start
        ? new Date(event.payload.subscription.entity.current_start * 1000)
        : new Date();
      const currentEnd = event.payload.subscription?.entity.current_end
        ? new Date(event.payload.subscription.entity.current_end * 1000)
        : addMonths(currentStart, 1);
      const paymentId = event.payload.invoice?.entity.payment_id ?? event.payload.payment?.entity.id ?? null;
      const providerInvoiceId = event.payload.invoice?.entity.id ?? null;

      await prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            ...planData(nextPlan),
            status: "ACTIVE",
            pendingPlan: null,
            razorpaySubscriptionId: providerSubscriptionId,
            currentPeriodStart: currentStart,
            currentPeriodEnd: currentEnd
          }
        });

        const pendingInvoice = await tx.invoice.findFirst({
          where: { subscriptionId: subscription.id, status: "PENDING" },
          orderBy: { createdAt: "desc" }
        });
        if (pendingInvoice) {
          await tx.invoice.update({
            where: { id: pendingInvoice.id },
            data: {
              status: "PAID",
              paidAt: new Date(),
              razorpayPaymentId: paymentId,
              razorpayInvoiceId: providerInvoiceId,
              periodStart: currentStart,
              periodEnd: currentEnd
            }
          });
        } else if (providerInvoiceId) {
          const definition = getPlanDefinition(nextPlan);
          await tx.invoice.upsert({
            where: { razorpayInvoiceId: providerInvoiceId },
            update: {
              status: "PAID",
              paidAt: new Date(),
              razorpayPaymentId: paymentId,
              periodStart: currentStart,
              periodEnd: currentEnd
            },
            create: {
              subscriptionId: subscription.id,
              invoiceNumber: invoiceNumber(subscription.id),
              amount: definition.priceMonthly,
              status: "PAID",
              paidAt: new Date(),
              razorpayPaymentId: paymentId,
              razorpayInvoiceId: providerInvoiceId,
              periodStart: currentStart,
              periodEnd: currentEnd
            }
          });
        }

        await tx.auditLog.create({
          data: {
            action: "subscription.webhook",
            resource: "Subscription",
            resourceId: subscription.id,
            payloadJson: asJson({ event, eventId })
          }
        });
      });

      await finishWebhookEvent({
        id: trackedEvent.event.id,
        status: "PROCESSED",
        resourceType: "Subscription",
        resourceId: subscription.id
      });

      return ok({ processed: true, eventId });
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
