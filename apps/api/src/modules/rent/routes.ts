import type { FastifyInstance } from "fastify";
import { assertPropertyAccess, assertTenantAccess } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { ok } from "../../lib/http.js";
import { toRentEntryDto } from "../common/serializers.js";
import { generateMonthlyRentEntries } from "./service.js";
import { z } from "zod";

const generateRentSchema = z.object({
  billingMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "billingMonth must be YYYY-MM").optional()
});

export async function rentRoutes(app: FastifyInstance) {
  app.get("/properties/:propertyId/rent", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { propertyId: string };
    await assertPropertyAccess(request, params.propertyId, "rent:read");
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

  app.post("/properties/:propertyId/rent/generate", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { propertyId: string };
    const body = generateRentSchema.parse(request.body ?? {});
    const { ownerProfileId } = await assertPropertyAccess(request, params.propertyId, "rent:write");
    return ok(await generateMonthlyRentEntries(params.propertyId, ownerProfileId, body.billingMonth));
  });

  app.get("/tenants/:tenantId/rent", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { tenantId: string };
    const { ownerProfileId } = await assertTenantAccess(request, params.tenantId, "rent:read");
    const entries = await prisma.rentEntry.findMany({
      where: {
        tenantId: params.tenantId,
        tenant: {
          property: { ownerProfileId }
        }
      },
      orderBy: { billingMonth: "desc" }
    });

    return ok(entries.map(toRentEntryDto));
  });
}
