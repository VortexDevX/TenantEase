import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "OWNER", "TENANT"])
});

export async function adminRoutes(app: FastifyInstance) {
  // List users — ADMIN only
  app.get("/admin/users", { preHandler: [app.authenticateAdmin] }, async (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit || "50", 10), 100);
    const offset = parseInt(query.offset || "0", 10);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          phone: true,
          role: true,
          isBlocked: true,
          blockedAt: true,
          createdAt: true,
          ownerProfile: {
            select: { id: true, displayName: true, companyName: true }
          }
        }
      }),
      prisma.user.count()
    ]);

    return ok({ items: users, total, limit, offset });
  });

  // Promote/change user role — ADMIN only
  app.put("/admin/users/:id/role", { preHandler: [app.authenticateAdmin] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateRoleSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { id },
      include: { ownerProfile: true }
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    if (user.role === "ADMIN" && request.user.sub !== id) {
      throw new AppError(403, "AUTH_FORBIDDEN", "Cannot change another admin's role via API");
    }

    // If promoting to OWNER, create OwnerProfile if missing
    if (body.role === "OWNER" && !user.ownerProfile) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id },
          data: { role: "OWNER" }
        }),
        prisma.ownerProfile.create({
          data: { userId: id }
        })
      ]);
    } else {
      await prisma.user.update({
        where: { id },
        data: { role: body.role }
      });
    }

    await createAuditLog({
      userId: request.user.sub,
      action: "admin.change_role",
      resource: "User",
      resourceId: id,
      payload: { previousRole: user.role, newRole: body.role },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok({ id, role: body.role });
  });

  app.post("/admin/users/:id/block", { preHandler: [app.authenticateAdmin] }, async (request) => {
    const { id } = request.params as { id: string };

    if (request.user.sub === id) {
      throw new AppError(403, "AUTH_FORBIDDEN", "You cannot block your own account");
    }

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        isBlocked: true,
        blockedAt: new Date()
      },
      select: {
        id: true,
        phone: true,
        role: true,
        isBlocked: true,
        blockedAt: true
      }
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "admin.block_user",
      resource: "User",
      resourceId: id,
      payload: { previousBlocked: user.isBlocked, nextBlocked: true },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(updated);
  });

  app.post("/admin/users/:id/unblock", { preHandler: [app.authenticateAdmin] }, async (request) => {
    const { id } = request.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        isBlocked: false,
        blockedAt: null
      },
      select: {
        id: true,
        phone: true,
        role: true,
        isBlocked: true,
        blockedAt: true
      }
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "admin.unblock_user",
      resource: "User",
      resourceId: id,
      payload: { previousBlocked: user.isBlocked, nextBlocked: false },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(updated);
  });

  app.delete("/admin/users/:id", { preHandler: [app.authenticateAdmin] }, async (request) => {
    const { id } = request.params as { id: string };

    if (request.user.sub === id) {
      throw new AppError(403, "AUTH_FORBIDDEN", "You cannot delete your own account");
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        role: true
      }
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    await prisma.user.delete({
      where: { id }
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "admin.delete_user",
      resource: "User",
      resourceId: id,
      payload: user,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok({ deleted: true, id });
  });
}
