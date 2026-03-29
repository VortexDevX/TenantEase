import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { assertPropertyOwnership } from "../common/owner.js";
import {
  paginationSchema,
  tenantInputSchema,
  transferInputSchema,
  vacateInputSchema
} from "../common/schemas.js";
import { toTenantDto } from "../common/serializers.js";
import { assertRoomAvailability, recalculateRoom } from "./service.js";

export async function tenantRoutes(app: FastifyInstance) {
  app.get("/properties/:propertyId/tenants", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { propertyId: string };
    const query = paginationSchema.parse(request.query);
    await assertPropertyOwnership(params.propertyId, request.user.ownerProfileId);

    const where = {
      propertyId: params.propertyId,
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: "insensitive" as const } },
              { phone: { contains: query.search } }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: "desc" }
      }),
      prisma.tenant.count({ where })
    ]);

    return ok(
      items.map(toTenantDto),
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

  app.post("/properties/:propertyId/tenants", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { propertyId: string };
    const body = tenantInputSchema.parse({ ...(request.body as object), propertyId: params.propertyId });
    await assertPropertyOwnership(params.propertyId, request.user.ownerProfileId);
    await assertRoomAvailability(body.roomId, request.user.ownerProfileId);

    const tenant = await prisma.tenant.create({
      data: {
        ...body,
        moveInDate: new Date(body.moveInDate)
      }
    });

    await recalculateRoom(body.roomId);
    return ok(toTenantDto(tenant));
  });

  app.get("/tenants/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: params.id,
        property: { ownerProfileId: request.user.ownerProfileId }
      }
    });

    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");
    }

    return ok(toTenantDto(tenant));
  });

  app.put("/tenants/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    const body = tenantInputSchema.partial().parse(request.body);
    const existing = await prisma.tenant.findFirst({
      where: {
        id: params.id,
        property: { ownerProfileId: request.user.ownerProfileId }
      }
    });

    if (!existing) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");
    }

    const tenant = await prisma.tenant.update({
      where: { id: existing.id },
      data: {
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        monthlyRent: body.monthlyRent,
        depositPaid: body.depositPaid
      }
    });

    return ok(toTenantDto(tenant));
  });

  app.post("/tenants/:id/vacate", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    const body = vacateInputSchema.parse(request.body);
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: params.id,
        property: { ownerProfileId: request.user.ownerProfileId }
      }
    });

    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");
    }

    if (tenant.status === "VACATED") {
      throw new AppError(422, "TENANT_ALREADY_VACATED", "Tenant already vacated");
    }

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        status: "VACATED",
        vacatedAt: new Date(body.vacatedAt)
      }
    });

    await recalculateRoom(tenant.roomId);
    return ok(toTenantDto(updated));
  });

  app.post("/tenants/:id/transfer", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    const body = transferInputSchema.parse(request.body);
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: params.id,
        property: { ownerProfileId: request.user.ownerProfileId }
      }
    });

    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");
    }

    if (tenant.roomId === body.roomId) {
      throw new AppError(422, "INVALID_TRANSFER", "Tenant is already assigned to that room");
    }

    await assertRoomAvailability(body.roomId, request.user.ownerProfileId);

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { roomId: body.roomId }
    });

    await Promise.all([recalculateRoom(tenant.roomId), recalculateRoom(body.roomId)]);
    return ok(toTenantDto(updated));
  });
}

