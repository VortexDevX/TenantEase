import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { monthKey } from "../../lib/date.js";
import { generateMonthlyRentEntries } from "../rent/service.js";
import { sendDueReminders } from "../reminders/service.js";
import { requireCronAuth } from "../../lib/cron-auth.js";
import { z } from "zod";

const cronRentSchema = z.object({
  billingMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional()
});

export async function cronRoutes(app: FastifyInstance) {
  app.post("/cron/reminders", async (request, reply) => {
    const authHeader = request.headers.authorization;
    requireCronAuth(authHeader);

    try {
      const properties = await prisma.property.findMany({
        select: { id: true }
      });

      let eligibleCount = 0;
      let sentCount = 0;
      for (const property of properties) {
        const result = await sendDueReminders({ propertyId: property.id });
        eligibleCount += result.eligibleCount;
        sentCount += result.sentCount;
      }

      return reply.send(ok({ 
        processedProperties: properties.length,
        eligibleCount,
        sentCount
      }));
    } catch (e) {
      if (e instanceof AppError) {
        throw e;
      }
      app.log.error(e, "Cron job failed");
      throw new AppError(500, "INTERNAL_ERROR", "Failed to execute cron job");
    }
  });

  app.post("/cron/rent/generate", async (request, reply) => {
    const authHeader = request.headers.authorization;
    requireCronAuth(authHeader);

    const body = cronRentSchema.parse(request.body ?? {});
    const billingMonth = body.billingMonth ?? monthKey(new Date());
    const properties = await prisma.property.findMany({
      select: { id: true, ownerProfileId: true }
    });

    const results = [];
    for (const property of properties) {
      results.push(await generateMonthlyRentEntries(property.id, property.ownerProfileId, billingMonth));
    }

    return reply.send(ok({
      billingMonth,
      processedProperties: properties.length,
      generatedCount: results.reduce((sum, result) => sum + result.generatedCount, 0),
      results
    }));
  });
}
