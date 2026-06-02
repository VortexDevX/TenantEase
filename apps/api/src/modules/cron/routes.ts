import { FastifyInstance } from "fastify";
import { env } from "../../lib/env.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";

// Basic authentication for external cron services if needed
function cronSecret() {
  if (env.CRON_SECRET) {
    return env.CRON_SECRET;
  }

  if (env.NODE_ENV === "production") {
    throw new AppError(500, "CONFIG_ERROR", "CRON_SECRET is required in production");
  }

  return "local_dev_cron_secret";
}

export async function cronRoutes(app: FastifyInstance) {
  app.post("/cron/reminders", async (request, reply) => {
    
    // 1. Basic Authorization
    const authHeader = request.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret()}`) {
      app.log.warn("Unauthorized CRON execution attempt");
      throw new AppError(401, "AUTH_FORBIDDEN", "Unauthorized cron access");
    }

    try {
      // 2. Find overdue rent entries
      const today = new Date();
      const overdueRents = await prisma.rentEntry.findMany({
        where: {
          status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
          dueDate: { lt: today }
        },
        include: {
          tenant: true,
        }
      });

      // 3. Mock processing reminders
      const messagesSent: Array<{ tenantId: string; rentEntryId: string; amountPending: number }> = [];
      
      for (const rent of overdueRents) {
        if (!rent.tenant || rent.tenant.status === "VACATED") continue;
        
        // Mock sending SMS / Email 
        app.log.info({
            event: "MOCK_SEND_REMINDER",
            tenantId: rent.tenant.id,
            amountDue: rent.amountDue - rent.amountPaid,
            rentEntryId: rent.id
        }, "Sent mock rent reminder");

        messagesSent.push({
            tenantId: rent.tenant.id,
            rentEntryId: rent.id,
            amountPending: rent.amountDue - rent.amountPaid
        });
        
        // If status wasn't exactly OVERDUE, upgrade it to OVERDUE officially since it's past due date
        if (rent.status !== "OVERDUE") {
             await prisma.rentEntry.update({
                 where: { id: rent.id },
                 data: { status: "OVERDUE" }
             });
        }
      }

      return reply.send(ok({ 
        processed: overdueRents.length, 
        remindersSent: messagesSent.length,
        messages: messagesSent 
      }));
    } catch (e) {
      app.log.error(e, "Cron job failed");
      throw new AppError(500, "INTERNAL_ERROR", "Failed to execute cron job");
    }
  });
}
