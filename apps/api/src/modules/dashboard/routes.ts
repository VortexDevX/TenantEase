import type { FastifyInstance } from "fastify";
import { requireOwnerProfileId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { ok } from "../../lib/http.js";
import { assertPropertyOwnership } from "../common/owner.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/properties/:propertyId/dashboard", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { propertyId: string };
    await assertPropertyOwnership(params.propertyId, requireOwnerProfileId(request.user.ownerProfileId));

    // 1. Occupancy Stats
    const property = await prisma.property.findUnique({
      where: { id: params.propertyId },
      include: {
        rooms: {
          select: { bedCount: true, occupiedBeds: true }
        }
      }
    });

    let totalBeds = 0;
    let occupiedBeds = 0;
    for (const room of property?.rooms ?? []) {
      totalBeds += room.bedCount;
      occupiedBeds += room.occupiedBeds;
    }

    // 2. Financials (Current Month)
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const currentRentEntries = await prisma.rentEntry.findMany({
      where: {
        tenant: { propertyId: params.propertyId },
        billingMonth: currentMonthStr
      }
    });

    let expectedRent = 0;
    let collectedRent = 0;
    let pendingRent = 0;
    let overdueTenantsCount = 0;

    for (const entry of currentRentEntries) {
      expectedRent += entry.amountDue;
      collectedRent += entry.amountPaid;
      const unpaid = entry.amountDue - entry.amountPaid;

      if (unpaid > 0) {
        pendingRent += unpaid;
        if (entry.status === "OVERDUE") {
          overdueTenantsCount++;
        }
      }
    }

    // 3. Maintenance Stats
    const openRequests = await prisma.maintenanceRequest.count({
      where: {
        propertyId: params.propertyId,
        status: { in: ["NEW", "IN_PROGRESS"] }
      }
    });

    return ok({
      occupancy: {
        totalBeds,
        occupiedBeds,
        occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0
      },
      financials: {
        billingMonth: currentMonthStr,
        expectedRent,
        collectedRent,
        pendingRent,
      },
      alerts: {
        overdueTenantsCount,
        openMaintenanceRequests: openRequests
      }
    });
  });
}
