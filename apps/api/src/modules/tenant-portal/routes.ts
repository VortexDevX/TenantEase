import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireTenantId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { storageProvider } from "../../providers/mock-providers.js";
import { createAuditLog } from "../common/audit.js";
import { toMaintenanceRequestDto, toRentEntryDto } from "../common/serializers.js";

const tenantMaintenanceSchema = z.object({
  category: z.enum(["PLUMBING", "ELECTRICAL", "FURNITURE", "INTERNET", "CLEANING", "OTHER"]),
  description: z.string().min(10).max(2000),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]).default("MEDIUM"),
  preferredTime: z.string().max(30).optional().nullable()
});

export async function tenantPortalRoutes(app: FastifyInstance) {
  // 1. View Rent Entries
  app.get("/tenant-portal/rent", { preHandler: [app.authenticateTenant] }, async (request) => {
    const tenantId = requireTenantId(request.user.tenantId);
    const entries = await prisma.rentEntry.findMany({
      where: { tenantId },
      orderBy: { billingMonth: "desc" }
    });

    return ok(entries.map(toRentEntryDto));
  });

  // 2. View Maintenance Requests
  app.get("/tenant-portal/maintenance", { preHandler: [app.authenticateTenant] }, async (request) => {
    const tenantId = requireTenantId(request.user.tenantId);
    const requests = await prisma.maintenanceRequest.findMany({
      where: { tenantId },
      include: {
        tenant: {
          include: {
            room: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return ok(requests.map(toMaintenanceRequestDto));
  });

  // 3. Create Maintenance Request
  app.post("/tenant-portal/maintenance", { preHandler: [app.authenticateTenant] }, async (request) => {
    const body = tenantMaintenanceSchema.parse(request.body);
    const tenantId = requireTenantId(request.user.tenantId);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { propertyId: true }
    });

    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant associated with token not found");
    }

    const mreq = await prisma.maintenanceRequest.create({
      data: {
        ...body,
        requestNumber: `MR-${randomUUID().slice(0, 8).toUpperCase()}`,
        tenantId,
        propertyId: tenant.propertyId
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
      action: "tenant.maintenance_create",
      resource: "MaintenanceRequest",
      resourceId: mreq.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(toMaintenanceRequestDto(mreq));
  });

  // 4. Download Receipts
  app.get("/tenant-portal/receipts/:id/download", { preHandler: [app.authenticateTenant] }, async (request, reply) => {
    const params = request.params as { id: string };
    const tenantId = requireTenantId(request.user.tenantId);
    
    // Ensure the receipt actually belongs to the authenticated tenant
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: params.id,
        payment: {
          rentEntry: {
            tenantId
          }
        }
      }
    });

    if (!receipt) {
      throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found or access denied");
    }

    const buffer = await storageProvider.readBuffer(receipt.filePath);
    reply
      .header("content-type", "application/pdf")
      .header("content-disposition", `inline; filename="${receipt.receiptNumber}.pdf"`);

    return reply.send(buffer);
  });

  // 5. List Receipts
  app.get("/tenant-portal/receipts", { preHandler: [app.authenticateTenant] }, async (request) => {
    const tenantId = requireTenantId(request.user.tenantId);

    const receipts = await prisma.receipt.findMany({
      where: {
        payment: {
          rentEntry: {
            tenantId
          },
          isVoided: false
        }
      },
      include: {
        payment: {
          select: {
            amount: true,
            mode: true,
            paidAt: true,
            rentEntry: {
              select: {
                billingMonth: true
              }
            }
          }
        }
      },
      orderBy: { generatedAt: "desc" }
    });

    return ok(receipts.map((r) => ({
      id: r.id,
      paymentId: r.paymentId,
      receiptNumber: r.receiptNumber,
      fileUrl: `/tenant-portal/receipts/${r.id}/download`,
      generatedAt: r.generatedAt.toISOString(),
      amount: r.payment.amount,
      mode: r.payment.mode,
      paidAt: r.payment.paidAt.toISOString(),
      billingMonth: r.payment.rentEntry.billingMonth
    })));
  });

  // 6. List Announcements
  app.get("/tenant-portal/announcements", { preHandler: [app.authenticateTenant] }, async (request) => {
    const tenantId = requireTenantId(request.user.tenantId);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { room: true }
    });

    if (!tenant) throw new AppError(404, "NOT_FOUND", "Tenant not found");

    const announcements = await prisma.announcement.findMany({
      where: {
        propertyId: tenant.propertyId,
        OR: [
          { targetFloor: null, targetRoomId: null },
          { targetFloor: tenant.room.floor, targetRoomId: null },
          { targetRoomId: tenant.roomId }
        ]
      },
      include: {
        reads: {
          where: { tenantId }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return ok(announcements.map(a => ({
      id: a.id,
      title: a.title,
      content: a.content,
      category: a.category,
      isImportant: a.isImportant,
      createdAt: a.createdAt.toISOString(),
      isRead: a.reads.length > 0
    })));
  });

  // 7. Mark Announcement as Read
  app.post("/tenant-portal/announcements/:id/read", { preHandler: [app.authenticateTenant] }, async (request, reply) => {
    const params = request.params as { id: string };
    const tenantId = requireTenantId(request.user.tenantId);

    try {
      await prisma.announcementRead.create({
        data: {
          announcementId: params.id,
          tenantId
        }
      });
      return ok({ success: true });
    } catch (e: any) {
      // Ignore if already marked as read (unique constraint violation)
      if (e.code === 'P2002') return ok({ success: true });
      throw e;
    }
  });
}
