import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";
import { assertPropertyOwnership } from "../common/owner.js";
import {
  maintenanceCommentSchema,
  maintenanceCreateSchema,
  maintenanceUpdateSchema,
  paginationSchema
} from "../common/schemas.js";
import {
  toMaintenanceCommentDto,
  toMaintenanceRequestDto
} from "../common/serializers.js";

function assertMaintenanceTransition(currentStatus: string, nextStatus: string) {
  const allowedTransitions = new Map<string, string[]>([
    ["NEW", ["IN_PROGRESS", "CLOSED"]],
    ["IN_PROGRESS", ["RESOLVED", "CLOSED"]],
    ["RESOLVED", ["IN_PROGRESS", "CLOSED"]],
    ["CLOSED", []]
  ]);

  if (currentStatus === nextStatus) {
    return;
  }

  if (!allowedTransitions.get(currentStatus)?.includes(nextStatus)) {
    throw new AppError(
      422,
      "INVALID_MAINTENANCE_TRANSITION",
      `Cannot move maintenance request from ${currentStatus} to ${nextStatus}`
    );
  }
}

async function assertMaintenanceOwnership(requestId: string, ownerProfileId: string) {
  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      property: { ownerProfileId }
    },
    include: {
      tenant: {
        include: {
          room: true
        }
      },
      comments: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!request) {
    throw new AppError(404, "REQUEST_NOT_FOUND", "Maintenance request not found");
  }

  return request;
}

export async function maintenanceRoutes(app: FastifyInstance) {
  app.get("/properties/:propertyId/maintenance", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { propertyId: string };
    const query = paginationSchema.extend({
      status: maintenanceUpdateSchema.shape.status.optional(),
      category: maintenanceCreateSchema.shape.category.optional(),
      urgency: maintenanceCreateSchema.shape.urgency.optional(),
      tenantId: maintenanceCreateSchema.shape.tenantId.optional()
    }).parse(request.query);

    await assertPropertyOwnership(params.propertyId, request.user.ownerProfileId);

    const where = {
      propertyId: params.propertyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.urgency ? { urgency: query.urgency } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {})
    };

    const [items, total, grouped] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where,
        include: {
          tenant: {
            include: {
              room: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit
      }),
      prisma.maintenanceRequest.count({ where }),
      prisma.maintenanceRequest.groupBy({
        by: ["status"],
        where,
        _count: true
      })
    ]);

    const summary = {
      new: grouped.find((item) => item.status === "NEW")?._count ?? 0,
      inProgress: grouped.find((item) => item.status === "IN_PROGRESS")?._count ?? 0,
      resolved: grouped.find((item) => item.status === "RESOLVED")?._count ?? 0,
      closed: grouped.find((item) => item.status === "CLOSED")?._count ?? 0,
      total
    };

    return ok(
      {
        items: items.map(toMaintenanceRequestDto),
        summary
      },
      {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
        hasNext: query.page * query.limit < total,
        hasPrev: query.page > 1
      }
    );
  });

  app.get("/maintenance/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    const item = await assertMaintenanceOwnership(params.id, request.user.ownerProfileId);
    return ok({
      request: toMaintenanceRequestDto(item),
      comments: item.comments.map(toMaintenanceCommentDto)
    });
  });

  app.post("/maintenance", { preHandler: [app.authenticate] }, async (request) => {
    const body = maintenanceCreateSchema.parse(request.body);
    await assertPropertyOwnership(body.propertyId, request.user.ownerProfileId);

    const tenant = await prisma.tenant.findFirst({
      where: {
        id: body.tenantId,
        propertyId: body.propertyId,
        property: { ownerProfileId: request.user.ownerProfileId }
      }
    });

    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");
    }

    const created = await prisma.maintenanceRequest.create({
      data: {
        requestNumber: `MR-${randomUUID().slice(0, 8).toUpperCase()}`,
        propertyId: body.propertyId,
        tenantId: body.tenantId,
        category: body.category,
        description: body.description,
        urgency: body.urgency,
        preferredTime: body.preferredTime
      },
      include: {
        tenant: {
          include: {
            room: true
          }
        }
      }
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "maintenance.create",
      resource: "MaintenanceRequest",
      resourceId: created.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(toMaintenanceRequestDto(created));
  });

  app.put("/maintenance/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    const body = maintenanceUpdateSchema.parse(request.body);
    const current = await assertMaintenanceOwnership(params.id, request.user.ownerProfileId);

    if (current.status === "CLOSED") {
      throw new AppError(422, "INVALID_MAINTENANCE_TRANSITION", "Closed requests cannot be modified");
    }

    if (body.status) {
      assertMaintenanceTransition(current.status, body.status);
    }

    if (body.status === "RESOLVED" && !body.resolutionNotes?.trim()) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "resolutionNotes are required when resolving a maintenance request"
      );
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id: params.id },
      data: {
        status: body.status,
        assignedWorkerName: body.assignedWorkerName,
        assignedWorkerPhone: body.assignedWorkerPhone,
        resolutionNotes: body.resolutionNotes
      },
      include: {
        tenant: {
          include: {
            room: true
          }
        }
      }
    });

    if (body.comment) {
      await prisma.maintenanceComment.create({
        data: {
          requestId: updated.id,
          authorUserId: request.user.sub,
          content: body.comment,
          isInternal: body.isInternalNote ?? false
        }
      });
    }

    await createAuditLog({
      userId: request.user.sub,
      action: "maintenance.update",
      resource: "MaintenanceRequest",
      resourceId: updated.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(toMaintenanceRequestDto(updated));
  });

  app.post("/maintenance/:id/comments", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    const body = maintenanceCommentSchema.parse(request.body);
    const current = await assertMaintenanceOwnership(params.id, request.user.ownerProfileId);

    if (current.status === "CLOSED") {
      throw new AppError(422, "INVALID_MAINTENANCE_TRANSITION", "Closed requests cannot receive comments");
    }

    const comment = await prisma.maintenanceComment.create({
      data: {
        requestId: params.id,
        authorUserId: request.user.sub,
        content: body.content,
        isInternal: body.isInternal
      }
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "maintenance.comment",
      resource: "MaintenanceRequest",
      resourceId: params.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(toMaintenanceCommentDto(comment));
  });

  app.post("/maintenance/:id/close", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    const current = await assertMaintenanceOwnership(params.id, request.user.ownerProfileId);

    if (current.status === "CLOSED") {
      return ok(toMaintenanceRequestDto(current));
    }

    if (current.status !== "RESOLVED" && current.status !== "IN_PROGRESS") {
      throw new AppError(
        422,
        "INVALID_MAINTENANCE_TRANSITION",
        "Request must be in progress or resolved before it can be closed"
      );
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id: current.id },
      data: {
        status: "CLOSED"
      },
      include: {
        tenant: {
          include: {
            room: true
          }
        }
      }
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "maintenance.close",
      resource: "MaintenanceRequest",
      resourceId: updated.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(toMaintenanceRequestDto(updated));
  });
}
