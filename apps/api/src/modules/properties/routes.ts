import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";
import { assertPropertyOwnership } from "../common/owner.js";
import { propertyInputSchema } from "../common/schemas.js";
import { toPropertyDto } from "../common/serializers.js";

export async function propertyRoutes(app: FastifyInstance) {
  app.get("/properties", { preHandler: [app.authenticate] }, async (request) => {
    const properties = await prisma.property.findMany({
      where: { ownerProfileId: request.user.ownerProfileId },
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
    const property = await prisma.property.create({
      data: {
        ...body,
        ownerProfileId: request.user.ownerProfileId
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
    const property = await prisma.property.findFirst({
      where: { id: params.id, ownerProfileId: request.user.ownerProfileId },
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
    await assertPropertyOwnership(params.id, request.user.ownerProfileId);
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
}
