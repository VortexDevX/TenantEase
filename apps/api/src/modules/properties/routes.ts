import type { FastifyInstance } from "fastify";
import { requireOwnerProfileId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";
import { assertPropertyOwnership } from "../common/owner.js";
import { propertyInputSchema } from "../common/schemas.js";
import { toPropertyDto } from "../common/serializers.js";

export async function propertyRoutes(app: FastifyInstance) {
  app.get("/properties", { preHandler: [app.authenticate] }, async (request) => {
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    const properties = await prisma.property.findMany({
      where: { ownerProfileId },
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
    const property = await prisma.property.create({
      data: {
        ...body,
        ownerProfileId
      },
      include: {
        rooms: {
          select: { bedCount: true, occupiedBeds: true }
        }
      }
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

  app.get("/properties/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    const property = await prisma.property.findFirst({
      where: { id: params.id, ownerProfileId },
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

  app.put("/properties/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    const body = propertyInputSchema.parse(request.body);
    await assertPropertyOwnership(params.id, requireOwnerProfileId(request.user.ownerProfileId));
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
