import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "OWNER", "STAFF", "TENANT"])
});

export async function adminRoutes(app: FastifyInstance) {
  // List users — ADMIN only
  app.get("/admin/users", { preHandler: [app.authenticateAdmin] }, async (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit || "50", 10), 100);
    const offset = parseInt(query.offset || "0", 10);

    const [users, total, blocked, roleCounts] = await Promise.all([
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
            select: {
              id: true,
              displayName: true,
              companyName: true,
              _count: { select: { properties: true } }
            }
          },
          _count: {
            select: { staffAssignments: true }
          }
        }
      }),
      prisma.user.count(),
      prisma.user.count({ where: { isBlocked: true } }),
      prisma.user.groupBy({
        by: ["role"],
        _count: { _all: true }
      })
    ]);

    const tenantCounts =
      users.length > 0
        ? await prisma.tenant.groupBy({
            by: ["phone"],
            where: {
              phone: { in: users.map((user) => user.phone) }
            },
            _count: { _all: true }
          })
        : [];
    const tenantCountByPhone = new Map(tenantCounts.map((item) => [item.phone, item._count._all]));
    const roleSummary = Object.fromEntries(roleCounts.map((item) => [item.role, item._count._all]));

    return ok({
      items: users.map(({ _count, ...user }) => ({
        ...user,
        ownerProfile: user.ownerProfile
          ? {
              id: user.ownerProfile.id,
              displayName: user.ownerProfile.displayName,
              companyName: user.ownerProfile.companyName,
              propertyCount: user.ownerProfile._count.properties
            }
          : null,
        tenantRecordCount: tenantCountByPhone.get(user.phone) ?? 0,
        staffAssignmentCount: _count.staffAssignments
      })),
      total,
      limit,
      offset,
      summary: {
        total,
        blocked,
        admins: roleSummary.ADMIN ?? 0,
        owners: roleSummary.OWNER ?? 0,
        staff: roleSummary.STAFF ?? 0,
        tenants: roleSummary.TENANT ?? 0
      }
    });
  });

  app.get("/admin/audit-logs", { preHandler: [app.authenticateAdmin] }, async (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit || "20", 10), 100);
    const offset = parseInt(query.offset || "0", 10);

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          payloadJson: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              phone: true,
              role: true
            }
          }
        }
      }),
      prisma.auditLog.count()
    ]);

    return ok({ items, total, limit, offset });
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

    if (user.role === "ADMIN" && request.user.sub === id && body.role !== "ADMIN") {
      throw new AppError(403, "AUTH_FORBIDDEN", "You cannot demote your own admin account");
    }

    await prisma.$transaction(async (tx) => {
      if (body.role !== "STAFF") {
        await tx.staffAssignment.updateMany({
          where: {
            userId: id,
            isActive: true,
            inviteStatus: { not: "REVOKED" }
          },
          data: {
            inviteStatus: "REVOKED",
            isActive: false,
            deactivatedAt: new Date()
          }
        });
      }

      if (body.role === "OWNER" && !user.ownerProfile) {
        await tx.user.update({
          where: { id },
          data: { role: "OWNER" }
        });
        await tx.ownerProfile.create({
          data: { userId: id }
        });
        return;
      }

      await tx.user.update({
        where: { id },
        data: { role: body.role }
      });
    });

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

    if (user.role === "ADMIN") {
      throw new AppError(403, "AUTH_FORBIDDEN", "Cannot block an admin account via API");
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
        role: true,
        ownerProfile: {
          select: {
            id: true,
            _count: { select: { properties: true } }
          }
        },
        _count: {
          select: { staffAssignments: true }
        }
      }
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    if (user.role === "ADMIN") {
      throw new AppError(403, "AUTH_FORBIDDEN", "Admin accounts are protected from deletion");
    }

    const tenantRecordCount = await prisma.tenant.count({
      where: { phone: user.phone }
    });
    const propertyCount = user.ownerProfile?._count.properties ?? 0;
    const staffAssignmentCount = user._count.staffAssignments;

    if (propertyCount > 0 || tenantRecordCount > 0 || staffAssignmentCount > 0) {
      throw new AppError(
        422,
        "USER_HAS_BUSINESS_DATA",
        "Cannot delete a user with linked properties, tenant records, or staff assignments. Block the user instead.",
        { propertyCount, tenantRecordCount, staffAssignmentCount }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.otpChallenge.updateMany({
        where: { userId: id },
        data: { userId: null }
      });
      await tx.auditLog.updateMany({
        where: { userId: id },
        data: { userId: null }
      });
      await tx.maintenanceComment.updateMany({
        where: { authorUserId: id },
        data: { authorUserId: null }
      });
      await tx.maintenanceStatusChange.updateMany({
        where: { changedByUserId: id },
        data: { changedByUserId: null }
      });
      await tx.user.delete({
        where: { id }
      });
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
