import type { FastifyInstance } from "fastify";
import { requireOwnerProfileId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { ok } from "../../lib/http.js";
import { assertPropertyOwnership } from "../common/owner.js";
import { notificationProvider } from "../../providers/mock-providers.js";
import { createAuditLog } from "../common/audit.js";
import { reminderConfigSchema, reminderSendSchema } from "../common/schemas.js";
import { toReminderConfigDto, toReminderLogDto } from "../common/serializers.js";

function daysBetween(a: Date, b: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const end = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((start - end) / msPerDay);
}

function render(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{{${key}}}`, String(value)),
    template
  );
}

export async function remindersRoutes(app: FastifyInstance) {
  app.get("/properties/:propertyId/reminders/config", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { propertyId: string };
    await assertPropertyOwnership(params.propertyId, requireOwnerProfileId(request.user.ownerProfileId));

    const config = await prisma.reminderConfig.upsert({
      where: { propertyId: params.propertyId },
      update: {},
      create: { propertyId: params.propertyId }
    });

    return ok(toReminderConfigDto(config));
  });

  app.put("/properties/:propertyId/reminders/config", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { propertyId: string };
    const body = reminderConfigSchema.parse(request.body);
    await assertPropertyOwnership(params.propertyId, requireOwnerProfileId(request.user.ownerProfileId));

    const config = await prisma.reminderConfig.upsert({
      where: { propertyId: params.propertyId },
      update: body,
      create: {
        propertyId: params.propertyId,
        ...body
      }
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "reminders.config.update",
      resource: "Property",
      resourceId: params.propertyId,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(toReminderConfigDto(config));
  });

  app.get("/properties/:propertyId/reminders/logs", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { propertyId: string };
    await assertPropertyOwnership(params.propertyId, requireOwnerProfileId(request.user.ownerProfileId));

    const logs = await prisma.reminderLog.findMany({
      where: { propertyId: params.propertyId },
      include: { tenant: { select: { fullName: true } } },
      orderBy: { sentAt: "desc" },
      take: 100
    });

    return ok(logs.map(toReminderLogDto));
  });

  app.post("/properties/:propertyId/reminders/send", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { propertyId: string };
    const body = reminderSendSchema.parse(request.body ?? {});
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    await assertPropertyOwnership(params.propertyId, ownerProfileId);

    const config = await prisma.reminderConfig.upsert({
      where: { propertyId: params.propertyId },
      update: {},
      create: { propertyId: params.propertyId }
    });

    const today = new Date();
    const entries = await prisma.rentEntry.findMany({
      where: {
        ...(body.billingMonth ? { billingMonth: body.billingMonth } : {}),
        status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
        tenant: {
          propertyId: params.propertyId,
          status: "ACTIVE"
        }
      },
      include: {
        tenant: true
      }
    });

    const eligible = entries.filter((entry) => {
      const daysFromDue = daysBetween(entry.dueDate, today);
      if (body.mode === "PRE_DUE") return daysFromDue === config.preDueDays;
      if (body.mode === "ON_DUE") return config.onDueEnabled && daysFromDue === 0;
      return daysFromDue < 0;
    });

    let sentCount = 0;
    for (const entry of eligible) {
      const pending = entry.amountDue - entry.amountPaid;
      const daysLate = Math.max(0, -daysBetween(entry.dueDate, today));
      const template = body.mode === "OVERDUE" ? config.overdueTemplate : config.friendlyTemplate;
      const message = render(template, {
        name: entry.tenant.fullName,
        month: entry.billingMonth,
        date: entry.dueDate.toISOString().slice(0, 10),
        days: daysLate,
        amount: pending / 100
      });
      const channels = [
        ...(config.inAppEnabled ? ["IN_APP"] : []),
        ...(config.smsEnabled ? ["SMS"] : []),
        ...(config.whatsappEnabled ? ["WHATSAPP"] : []),
        ...(config.emailEnabled ? ["EMAIL"] : [])
      ];

      for (const channel of channels) {
        try {
          if (channel === "SMS") await notificationProvider.sendSms(entry.tenant.phone, message);
          if (channel === "WHATSAPP") await notificationProvider.sendWhatsApp(entry.tenant.phone, message);
          if (channel === "IN_APP") {
            await prisma.notification.create({
              data: {
                tenantId: entry.tenant.id,
                propertyId: params.propertyId,
                title: body.mode === "OVERDUE" ? "Rent overdue" : "Rent reminder",
                content: message,
                category: "RENT"
              }
            });
          }
          await prisma.reminderLog.create({
            data: {
              propertyId: params.propertyId,
              tenantId: entry.tenant.id,
              rentEntryId: entry.id,
              channel,
              status: "SENT",
              message
            }
          });
          sentCount++;
        } catch (error) {
          await prisma.reminderLog.create({
            data: {
              propertyId: params.propertyId,
              tenantId: entry.tenant.id,
              rentEntryId: entry.id,
              channel,
              status: "FAILED",
              message,
              error: error instanceof Error ? error.message : "Unknown error"
            }
          });
        }
      }

      if (body.mode === "OVERDUE" && entry.status !== "OVERDUE") {
        await prisma.rentEntry.update({
          where: { id: entry.id },
          data: { status: "OVERDUE" }
        });
      }
    }

    await createAuditLog({
      userId: request.user.sub,
      action: "reminders.send",
      resource: "Property",
      resourceId: params.propertyId,
      payload: { mode: body.mode, sentCount },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok({ sentCount, eligibleCount: eligible.length });
  });

  app.post("/properties/:propertyId/reminders/overdue", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { propertyId: string };
    return app.inject({
      method: "POST",
      url: `/properties/${params.propertyId}/reminders/send`,
      headers: { authorization: request.headers.authorization ?? "" },
      payload: { mode: "OVERDUE" }
    }).then((response) => response.json());
  });
}
