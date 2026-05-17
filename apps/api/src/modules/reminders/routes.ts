import type { FastifyInstance } from "fastify";
import { requireOwnerProfileId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { ok } from "../../lib/http.js";
import { assertPropertyOwnership } from "../common/owner.js";
import { notificationProvider } from "../../providers/mock-providers.js";
import { createAuditLog } from "../common/audit.js";

export async function remindersRoutes(app: FastifyInstance) {
  app.post("/properties/:propertyId/reminders/overdue", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { propertyId: string };
    await assertPropertyOwnership(params.propertyId, requireOwnerProfileId(request.user.ownerProfileId));

    // Find all overdue rent entries for this property
    const overdueEntries = await prisma.rentEntry.findMany({
      where: {
        status: "OVERDUE",
        tenant: {
          propertyId: params.propertyId,
          status: "ACTIVE"
        }
      },
      include: {
        tenant: true
      }
    });

    if (overdueEntries.length === 0) {
      return ok({ sentCount: 0, message: "No overdue tenants found" });
    }

    let sentCount = 0;

    for (const entry of overdueEntries) {
      const remaining = (entry.amountDue - entry.amountPaid) / 100;
      const message = `Reminder from TenantEase: Your rent of ₹${remaining} for ${entry.billingMonth} is overdue. Please pay at the earliest to avoid late fees.`;
      
      // Dispatch securely via mock provider
      await notificationProvider.sendSms(entry.tenant.phone, message);
      await notificationProvider.sendWhatsApp(entry.tenant.phone, message);
      sentCount++;
    }

    await createAuditLog({
      userId: request.user.sub,
      action: "reminders.send_overdue",
      resource: "Property",
      resourceId: params.propertyId,
      payload: { sentCount },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok({ sentCount, message: `Reminders sent to ${sentCount} tenants.` });
  });
}
