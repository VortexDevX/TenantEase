import type { FastifyInstance } from "fastify";
import { assertPropertyAccess, assertTenantAccess } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";
import {
  paginationSchema,
  noticeInputSchema,
  tenantInputSchema,
  transferInputSchema,
  vacateInputSchema
} from "../common/schemas.js";
import { toRoomTransferRecordDto, toTenantDto, toVacateRecordDto } from "../common/serializers.js";
import { assertRoomAvailability, lockRoom, recalculateRoom } from "./service.js";
import { pdfProvider, storageProvider } from "../../providers/mock-providers.js";

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
    const tenant = await prisma.$transaction(async (tx) => {
      await lockRoom(tx, body.roomId);
      await assertRoomAvailability(body.roomId, ownerProfileId, tx);
      const existingActiveTenant = await tx.tenant.findFirst({
        where: { phone: body.phone, status: { in: ["ACTIVE", "NOTICE"] } },
        select: { id: true }
      });
      if (existingActiveTenant) {
        throw new AppError(409, "VALIDATION_ERROR", "An active tenant with this phone number already exists");
      }

      const created = await tx.tenant.create({
        data: { ...body, moveInDate: new Date(body.moveInDate) }
      });
      await recalculateRoom(body.roomId, tx);
      return created;
    });
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
        emergencyContactName: body.emergencyContactName,
        emergencyContactPhone: body.emergencyContactPhone,
        emergencyContactRelation: body.emergencyContactRelation,
        aadhaarLast4: body.aadhaarLast4,
        notes: body.notes,
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
      },
      include: { property: { select: { name: true } } }
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
          vacatedAt: new Date(body.vacatedAt),
          expectedVacateDate: null
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

      await recalculateRoom(tenant.roomId, tx);

      return { updatedTenant, vacateRecord };
    });

    let vacateRecord = result.vacateRecord;
    try {
      const settlementPdf = await pdfProvider.createSettlementPdf({
        tenantName: tenant.fullName,
        propertyName: tenant.property.name,
        vacatedAt: body.vacatedAt,
        depositPaid: tenant.depositPaid,
        damageDeduction: body.damageDeduction,
        pendingRent,
        refundAmount,
        refundStatus: body.refundStatus,
        finalNotes: body.finalNotes
      });
      const settlementPdfPath = await storageProvider.saveBuffer(
        `settlements/settlement-${result.vacateRecord.id}.pdf`,
        settlementPdf
      );
      vacateRecord = await prisma.vacateRecord.update({
        where: { id: result.vacateRecord.id },
        data: { settlementPdfPath }
      });
    } catch (error) {
      request.log.error({ err: error, vacateRecordId: result.vacateRecord.id }, "settlement PDF generation failed");
    }
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
      vacateRecord: toVacateRecordDto(vacateRecord)
    });
  });

  app.post("/tenants/:id/notice", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = noticeInputSchema.parse(request.body);
    await assertTenantAccess(request, id, "tenant:write");
    const expectedVacateDate = new Date(`${body.expectedVacateDate}T23:59:59.999Z`);
    if (expectedVacateDate <= new Date()) {
      throw new AppError(422, "VALIDATION_ERROR", "Expected vacate date must be in the future");
    }
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant || tenant.status === "VACATED") throw new AppError(422, "VALIDATION_ERROR", "Vacated tenant cannot enter notice");
    const updated = await prisma.tenant.update({
      where: { id },
      data: { status: "NOTICE", noticeDate: new Date(), expectedVacateDate }
    });
    await createAuditLog({
      userId: request.user.sub,
      action: "tenant.notice",
      resource: "Tenant",
      resourceId: id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });
    return ok(toTenantDto(updated));
  });

  app.get("/vacate-records/:id/download", { preHandler: [app.authenticateOwnerOrStaff] }, async (request, reply) => {
    const params = request.params as { id: string };
    const record = await prisma.vacateRecord.findUnique({
      where: { id: params.id },
      select: { id: true, propertyId: true, settlementPdfPath: true }
    });

    if (!record?.settlementPdfPath) {
      throw new AppError(404, "NOT_FOUND", "Settlement PDF not found");
    }

    await assertPropertyAccess(request, record.propertyId, "tenant:read");
    const buffer = await storageProvider.readBuffer(record.settlementPdfPath);
    return reply
      .header("content-type", "application/pdf")
      .header("content-disposition", `inline; filename="settlement-${record.id}.pdf"`)
      .send(buffer);
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

    const effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : new Date();
    const result = await prisma.$transaction(async (tx) => {
      for (const roomId of [tenant.roomId, body.roomId].sort()) await lockRoom(tx, roomId);
      await assertRoomAvailability(body.roomId, ownerProfileId, tx);
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

      await Promise.all([recalculateRoom(tenant.roomId, tx), recalculateRoom(body.roomId, tx)]);
      return { updatedTenant, transferRecord };
    });
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
