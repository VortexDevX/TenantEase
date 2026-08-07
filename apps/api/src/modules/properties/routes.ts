import type { FastifyInstance } from "fastify";
import { assertPropertyAccess, requireOwnerProfileId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";
import { assertPropertyOwnership } from "../common/owner.js";
import { propertyInputSchema, propertySettingsSchema } from "../common/schemas.js";
import { toPropertyDto, toPropertySettingsDto } from "../common/serializers.js";
import { assertCanCreateProperty } from "../subscriptions/service.js";

export async function propertyRoutes(app: FastifyInstance) {
  app.get("/properties", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const accessFilter = request.user.role === "OWNER"
      ? { ownerProfileId: requireOwnerProfileId(request.user.ownerProfileId) }
      : {
          staffAssignments: {
            some: {
              userId: request.user.sub,
              isActive: true,
              inviteStatus: "ACCEPTED" as const
            }
          }
        };
    const properties = await prisma.property.findMany({
      where: accessFilter,
      include: {
        rooms: {
          select: { bedCount: true, occupiedBeds: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return ok(properties.map(toPropertyDto));
  });

  app.post("/properties", { preHandler: [app.authenticate] }, async (request) => {
    const body = propertyInputSchema.parse(request.body);
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    const property = await prisma.$transaction(async (tx) => {
      await assertCanCreateProperty(ownerProfileId, tx);
      return tx.property.create({
        data: {
          ...body,
          ownerProfileId,
          settings: {
            create: {
              contactPhone: null
            }
          },
          reminderConfig: {
            create: {}
          }
        },
        include: {
          rooms: {
            select: { bedCount: true, occupiedBeds: true }
          }
        }
      });
    });
    await createAuditLog({
      userId: request.user.sub,
      action: "property.create",
      resource: "Property",
      resourceId: property.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(toPropertyDto(property));
  });

  app.get("/properties/:id/settings", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    await assertPropertyAccess(request, params.id, "property:read");

    const settings = await prisma.propertySettings.upsert({
      where: { propertyId: params.id },
      update: {},
      create: { propertyId: params.id }
    });

    return ok(toPropertySettingsDto(settings));
  });

  app.put("/properties/:id/settings", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    const body = propertySettingsSchema.parse(request.body);
    await assertPropertyAccess(request, params.id, "property:write");

    const settings = await prisma.propertySettings.upsert({
      where: { propertyId: params.id },
      update: body,
      create: {
        propertyId: params.id,
        ...body
      }
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "property.settings.update",
      resource: "Property",
      resourceId: params.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(toPropertySettingsDto(settings));
  });

  app.get("/properties/:id", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    await assertPropertyAccess(request, params.id, "property:read");
    const property = await prisma.property.findUnique({
      where: { id: params.id },
      include: {
        rooms: {
          select: { bedCount: true, occupiedBeds: true }
        }
      }
    });

    if (!property) {
      throw new AppError(404, "PROPERTY_NOT_FOUND", "Property not found");
    }

    return ok(toPropertyDto(property));
  });

  app.put("/properties/:id", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    const body = propertyInputSchema.parse(request.body);
    await assertPropertyAccess(request, params.id, "property:write");
    const property = await prisma.property.update({
      where: { id: params.id },
      data: body,
      include: {
        rooms: {
          select: { bedCount: true, occupiedBeds: true }
        }
      }
    });
    await createAuditLog({
      userId: request.user.sub,
      action: "property.update",
      resource: "Property",
      resourceId: property.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(toPropertyDto(property));
  });

  app.delete("/properties/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    await assertPropertyOwnership(params.id, ownerProfileId);

    // Prevent deletion if property has active tenants
    const activeTenants = await prisma.tenant.count({
      where: {
        propertyId: params.id,
        status: { in: ["ACTIVE", "NOTICE"] }
      }
    });

    if (activeTenants > 0) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        `Cannot delete property with ${activeTenants} active tenant(s). Vacate all tenants first.`
      );
    }

    await prisma.property.delete({
      where: { id: params.id }
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "property.delete",
      resource: "Property",
      resourceId: params.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok({ deleted: true, id: params.id });
  });
}
