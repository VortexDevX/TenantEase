import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";

// Basic authentication for external cron services if needed
const CRON_SECRET = process.env.CRON_SECRET || "local_dev_cron_secret";

export async function cronRoutes(app: FastifyInstance) {
  app.post("/cron/reminders", async (request, reply) => {
    
    // 1. Basic Authorization
    const authHeader = request.headers.authorization;
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
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
      const messagesSent: any[] = [];
      
      for (const rent of overdueRents) {
        if (!rent.tenant || rent.tenant.status === "VACATED") continue;
        
        // Mock sending SMS / Email 
        app.log.info({
            event: "MOCK_SEND_REMINDER",
            tenantId: rent.tenant.id,
            phone: rent.tenant.phone,
            amountDue: rent.amountDue - rent.amountPaid,
            rentEntryId: rent.id
        }, `Sent reminder to ${rent.tenant.fullName} for ₹${(rent.amountDue - rent.amountPaid) / 100}`);

        messagesSent.push({
            tenantId: rent.tenant.id,
            phone: rent.tenant.phone,
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
    } catch (e: any) {
      app.log.error(e, "Cron job failed");
      throw new AppError(500, "INTERNAL_ERROR", e.message || "Failed to execute cron job");
    }
  });
}
