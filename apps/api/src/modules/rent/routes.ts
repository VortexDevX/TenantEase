import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { ok } from "../../lib/http.js";
import { assertPropertyOwnership } from "../common/owner.js";
import { toRentEntryDto } from "../common/serializers.js";
import { generateMonthlyRentEntries } from "./service.js";

export async function rentRoutes(app: FastifyInstance) {
  app.get("/properties/:propertyId/rent", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { propertyId: string };
    await assertPropertyOwnership(params.propertyId, request.user.ownerProfileId);
    const entries = await prisma.rentEntry.findMany({
      where: {
        tenant: {
          propertyId: params.propertyId
        }
      },
      include: {
        tenant: {
          select: { fullName: true }
        }
      },
      orderBy: [{ billingMonth: "desc" }, { createdAt: "desc" }]
    });

    return ok(
      entries.map((entry) => ({
        ...toRentEntryDto(entry),
        tenantName: entry.tenant.fullName
      }))
    );
  });

  app.post("/properties/:propertyId/rent/generate", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { propertyId: string };
    const body = (request.body as { billingMonth?: string } | undefined) ?? {};
    return ok(await generateMonthlyRentEntries(params.propertyId, request.user.ownerProfileId, body.billingMonth));
  });

  app.get("/tenants/:tenantId/rent", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { tenantId: string };
    const entries = await prisma.rentEntry.findMany({
      where: {
        tenantId: params.tenantId,
        tenant: {
          property: { ownerProfileId: request.user.ownerProfileId }
        }
      },
      orderBy: { billingMonth: "desc" }
    });

    return ok(entries.map(toRentEntryDto));
  });
}

