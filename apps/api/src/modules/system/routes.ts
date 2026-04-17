import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { ok } from "../../lib/http.js";
import { recalculateRoom } from "../tenants/service.js";
import { createAuditLog } from "../common/audit.js";

export async function systemRoutes(app: FastifyInstance) {
  // Can be called automatically by a cron job or webhook
  app.post("/system/sync-occupancy", async (request) => {
    const now = new Date();
    
    // Find all tenants who have passed their vacatedAt date but are still marked active/notice
    const toVacate = await prisma.tenant.findMany({
      where: {
        status: { in: ["ACTIVE", "NOTICE"] },
        vacatedAt: { lte: now }
      }
    });

    if (toVacate.length === 0) {
      return ok({ synced: 0, message: "No occupancy changes required" });
    }

    const roomIds = new Set<string>();

    // Mark as vacated
    for (const tenant of toVacate) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: "VACATED" }
      });
      roomIds.add(tenant.roomId);
    }

    // Recalculate properties for affected rooms
    for (const roomId of roomIds) {
      await recalculateRoom(roomId);
    }

    await createAuditLog({
      action: "system.sync_occupancy",
      resource: "Tenant",
      payload: { vacatedCount: toVacate.length, roomsUpdated: roomIds.size },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok({ synced: toVacate.length, roomsUpdated: roomIds.size });
  });
}
