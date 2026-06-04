import type { FastifyInstance } from "fastify";
import { assertPropertyAccess, assertTenantAccess } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";
import {
  paginationSchema,
  tenantInputSchema,
  transferInputSchema,
  vacateInputSchema
} from "../common/schemas.js";
import { toRoomTransferRecordDto, toTenantDto, toVacateRecordDto } from "../common/serializers.js";
import { assertRoomAvailability, recalculateRoom } from "./service.js";

export async function tenantRoutes(app: FastifyInstance) {
  app.get("/properties/:propertyId/tenants", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { propertyId: string };
    const query = paginationSchema.parse(request.query);
    await assertPropertyAccess(request, params.propertyId, "tenant:read");

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

  app.post("/properties/:propertyId/tenants", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { propertyId: string };
    const body = tenantInputSchema.parse({ ...(request.body as object), propertyId: params.propertyId });
    const { ownerProfileId } = await assertPropertyAccess(request, params.propertyId, "tenant:write");
    await assertRoomAvailability(body.roomId, ownerProfileId);

    const tenant = await prisma.tenant.create({
      data: {
        ...body,
        moveInDate: new Date(body.moveInDate)
      }
    });

    await recalculateRoom(body.roomId);
    await createAuditLog({
      userId: request.user.sub,
      action: "tenant.create",
      resource: "Tenant",
      resourceId: tenant.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });
    return ok(toTenantDto(tenant));
  });

  app.get("/tenants/:id", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    const { ownerProfileId } = await assertTenantAccess(request, params.id, "tenant:read");
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: params.id,
        property: { ownerProfileId }
      }
    });

    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");
    }

    return ok(toTenantDto(tenant));
  });

  app.put("/tenants/:id", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    const body = tenantInputSchema.partial().parse(request.body);
    const { ownerProfileId } = await assertTenantAccess(request, params.id, "tenant:write");
    const existing = await prisma.tenant.findFirst({
      where: {
        id: params.id,
        property: { ownerProfileId }
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
    await createAuditLog({
      userId: request.user.sub,
      action: "tenant.update",
      resource: "Tenant",
      resourceId: tenant.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(toTenantDto(tenant));
  });

  app.post("/tenants/:id/vacate", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    const body = vacateInputSchema.parse(request.body);
    const { ownerProfileId } = await assertTenantAccess(request, params.id, "tenant:write");
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: params.id,
        property: { ownerProfileId }
      }
    });

    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");
    }

    if (tenant.status === "VACATED") {
      throw new AppError(422, "TENANT_ALREADY_VACATED", "Tenant already vacated");
    }

    const pending = await prisma.rentEntry.aggregate({
      where: {
        tenantId: tenant.id,
        status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] }
      },
      _sum: {
        amountDue: true,
        amountPaid: true
      }
    });
    const pendingRent = Math.max(0, (pending._sum.amountDue ?? 0) - (pending._sum.amountPaid ?? 0));
    const refundAmount = Math.max(0, tenant.depositPaid - body.damageDeduction - pendingRent);

    const result = await prisma.$transaction(async (tx) => {
      const updatedTenant = await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          status: "VACATED",
          vacatedAt: new Date(body.vacatedAt)
        }
      });

      const vacateRecord = await tx.vacateRecord.create({
        data: {
          tenantId: tenant.id,
          propertyId: tenant.propertyId,
          roomId: tenant.roomId,
          vacatedAt: new Date(body.vacatedAt),
          depositPaid: tenant.depositPaid,
          damageDeduction: body.damageDeduction,
          pendingRent,
          refundAmount,
          refundStatus: body.refundStatus,
          finalNotes: body.finalNotes ?? null
        }
      });

      return { updatedTenant, vacateRecord };
    });

    await recalculateRoom(tenant.roomId);
    await createAuditLog({
      userId: request.user.sub,
      action: "tenant.vacate",
      resource: "Tenant",
      resourceId: result.updatedTenant.id,
      payload: { ...body, pendingRent, refundAmount },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });
    return ok({
      tenant: toTenantDto(result.updatedTenant),
      vacateRecord: toVacateRecordDto(result.vacateRecord)
    });
  });

  app.post("/tenants/:id/transfer", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    const body = transferInputSchema.parse(request.body);
    const { ownerProfileId } = await assertTenantAccess(request, params.id, "tenant:write");
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: params.id,
        property: { ownerProfileId }
      }
    });

    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");
    }

    if (tenant.roomId === body.roomId) {
      throw new AppError(422, "INVALID_TRANSFER", "Tenant is already assigned to that room");
    }

    await assertRoomAvailability(body.roomId, ownerProfileId);

    const effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : new Date();
    const result = await prisma.$transaction(async (tx) => {
      const updatedTenant = await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          roomId: body.roomId,
          monthlyRent: body.monthlyRent ?? tenant.monthlyRent
        }
      });

      const transferRecord = await tx.roomTransferRecord.create({
        data: {
          tenantId: tenant.id,
          propertyId: tenant.propertyId,
          fromRoomId: tenant.roomId,
          toRoomId: body.roomId,
          effectiveDate,
          monthlyRentBefore: tenant.monthlyRent,
          monthlyRentAfter: body.monthlyRent ?? null,
          note: body.note ?? null
        }
      });

      return { updatedTenant, transferRecord };
    });

    await Promise.all([recalculateRoom(tenant.roomId), recalculateRoom(body.roomId)]);
    await createAuditLog({
      userId: request.user.sub,
      action: "tenant.transfer",
      resource: "Tenant",
      resourceId: result.updatedTenant.id,
      payload: { fromRoomId: tenant.roomId, toRoomId: body.roomId, effectiveDate, monthlyRent: body.monthlyRent },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });
    return ok({
      tenant: toTenantDto(result.updatedTenant),
      transferRecord: toRoomTransferRecordDto(result.transferRecord)
    });
  });
}
