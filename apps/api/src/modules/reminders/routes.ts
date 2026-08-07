import type { FastifyInstance } from "fastify";
import { assertPropertyAccess } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";
import { reminderConfigSchema, reminderSendSchema } from "../common/schemas.js";
import { toReminderConfigDto, toReminderLogDto } from "../common/serializers.js";
import { sendDueReminders } from "./service.js";
import { ensureSubscription } from "../subscriptions/service.js";
import { AppError } from "../../lib/errors.js";

export async function remindersRoutes(app: FastifyInstance) {
  app.get("/properties/:propertyId/reminders/config", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { propertyId: string };
    await assertPropertyAccess(request, params.propertyId, "reminder:read");

    const config = await prisma.reminderConfig.upsert({
      where: { propertyId: params.propertyId },
      update: {},
      create: { propertyId: params.propertyId }
    });

    return ok(toReminderConfigDto(config));
  });

  app.put("/properties/:propertyId/reminders/config", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { propertyId: string };
    const body = reminderConfigSchema.parse(request.body);
    const { ownerProfileId } = await assertPropertyAccess(request, params.propertyId, "reminder:write");
    const subscription = await ensureSubscription(ownerProfileId);
    if (body.smsEnabled && !subscription.smsEnabled) {
      throw new AppError(402, "AUTH_FORBIDDEN", "Current plan does not include SMS reminders");
    }
    if (body.whatsappEnabled && !subscription.whatsappEnabled) {
      throw new AppError(402, "AUTH_FORBIDDEN", "Current plan does not include WhatsApp reminders");
    }
    if (body.emailEnabled && !subscription.emailEnabled) {
      throw new AppError(402, "AUTH_FORBIDDEN", "Current plan does not include email reminders");
    }

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

  app.get("/properties/:propertyId/reminders/logs", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { propertyId: string };
    await assertPropertyAccess(request, params.propertyId, "reminder:read");

    const logs = await prisma.reminderLog.findMany({
      where: { propertyId: params.propertyId },
      include: { tenant: { select: { fullName: true } } },
      orderBy: { sentAt: "desc" },
      take: 100
    });

    return ok(logs.map(toReminderLogDto));
  });

  app.post("/properties/:propertyId/reminders/send", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { propertyId: string };
    const body = reminderSendSchema.parse(request.body ?? {});
    await assertPropertyAccess(request, params.propertyId, "reminder:write");

    const result = await sendDueReminders({
      propertyId: params.propertyId,
      mode: body.mode,
      billingMonth: body.billingMonth
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "reminders.send",
      resource: "Property",
      resourceId: params.propertyId,
      payload: { mode: body.mode, sentCount: result.sentCount },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(result);
  });

  app.post("/properties/:propertyId/reminders/overdue", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { propertyId: string };
    return app.inject({
      method: "POST",
      url: `/properties/${params.propertyId}/reminders/send`,
      headers: { authorization: request.headers.authorization ?? "" },
      payload: { mode: "OVERDUE" }
    }).then((response) => response.json());
  });
}
