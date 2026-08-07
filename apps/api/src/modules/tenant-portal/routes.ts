import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireTenantId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { storageProvider } from "../../providers/mock-providers.js";
import { createAuditLog } from "../common/audit.js";
import { toMaintenanceRequestDto, toNotificationDto, toRentEntryDto, toTenantDto } from "../common/serializers.js";

const tenantMaintenanceSchema = z.object({
  category: z.enum(["PLUMBING", "ELECTRICAL", "FURNITURE", "INTERNET", "CLEANING", "OTHER"]),
  description: z.string().min(10).max(2000),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]).default("MEDIUM"),
  preferredTime: z.string().max(30).optional().nullable()
});

const offlinePaymentSchema = z.object({
  idempotencyKey: z.string().uuid(),
  rentEntryId: z.string().uuid(),
  amount: z.number().int().min(1),
  mode: z.enum(["CASH", "UPI", "BANK_TRANSFER"]),
  referenceNumber: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable()
});

export async function tenantPortalRoutes(app: FastifyInstance) {
  app.get("/tenant-portal/home", { preHandler: [app.authenticateTenant] }, async (request) => {
    const tenantId = requireTenantId(request.user.tenantId);
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        room: true,
        property: true
      }
    });

    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant associated with token not found");
    }

    const [currentRent, openMaintenanceCount, unreadNotifications, recentNotifications] = await Promise.all([
      prisma.rentEntry.findFirst({
        where: { tenantId },
        orderBy: { billingMonth: "desc" }
      }),
      prisma.maintenanceRequest.count({
        where: {
          tenantId,
          status: { in: ["NEW", "IN_PROGRESS"] }
        }
      }),
      prisma.notification.count({
        where: {
          tenantId,
          readAt: null
        }
      }),
      prisma.notification.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 5
      })
    ]);

    return ok({
      profile: {
        ...toTenantDto(tenant),
        propertyName: tenant.property.name,
        roomNumber: tenant.room.roomNumber
      },
      currentRent: currentRent ? toRentEntryDto(currentRent) : null,
      unreadNotifications,
      openMaintenanceCount,
      recentNotifications: recentNotifications.map(toNotificationDto)
    });
  });

  app.get("/tenant-portal/profile", { preHandler: [app.authenticateTenant] }, async (request) => {
    const tenantId = requireTenantId(request.user.tenantId);
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        room: true,
        property: true
      }
    });

    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant associated with token not found");
    }

    return ok({
      ...toTenantDto(tenant),
      propertyName: tenant.property.name,
      roomNumber: tenant.room.roomNumber
    });
  });

  // 1. View Rent Entries
  app.get("/tenant-portal/rent", { preHandler: [app.authenticateTenant] }, async (request) => {
    const tenantId = requireTenantId(request.user.tenantId);
    const entries = await prisma.rentEntry.findMany({
      where: { tenantId },
      orderBy: { billingMonth: "desc" }
    });

    return ok(entries.map(toRentEntryDto));
  });

  app.post("/tenant-portal/payments/offline", { preHandler: [app.authenticateTenant] }, async (request, reply) => {
    const body = offlinePaymentSchema.parse(request.body);
    const tenantId = requireTenantId(request.user.tenantId);
    const rentEntry = await prisma.rentEntry.findFirst({
      where: { id: body.rentEntryId, tenantId },
      include: {
        tenant: {
          include: {
            room: true,
            property: {
              include: {
                ownerProfile: { select: { userId: true } }
              }
            }
          }
        }
      }
    });

    if (!rentEntry) {
      throw new AppError(404, "RENT_ENTRY_NOT_FOUND", "Rent entry not found");
    }

    const pending = Math.max(0, rentEntry.amountDue - rentEntry.amountPaid);
    if (pending <= 0) {
      throw new AppError(422, "VALIDATION_ERROR", "Rent entry is already paid");
    }

    if (body.amount > pending) {
      throw new AppError(422, "VALIDATION_ERROR", "Payment amount cannot exceed pending balance");
    }

    const modeLabel = body.mode === "BANK_TRANSFER" ? "bank transfer" : body.mode.toLowerCase();
    const noteParts = [
      `${rentEntry.tenant.fullName} reported ${modeLabel} payment for ${rentEntry.billingMonth}.`,
      `Amount: INR ${(body.amount / 100).toFixed(2)}.`,
      body.referenceNumber ? `Reference: ${body.referenceNumber}.` : null,
      body.note ? `Note: ${body.note}` : null
    ].filter(Boolean);

    const claim = await prisma.$transaction(async (tx) => {
      const existing = await tx.offlinePaymentClaim.findUnique({ where: { idempotencyKey: body.idempotencyKey } });
      if (existing) {
        if (existing.tenantId !== tenantId || existing.rentEntryId !== rentEntry.id || existing.amount !== body.amount || existing.mode !== body.mode) {
          throw new AppError(409, "VALIDATION_ERROR", "Idempotency key was already used for another payment report");
        }
        return existing;
      }

      const created = await tx.offlinePaymentClaim.create({
        data: {
          idempotencyKey: body.idempotencyKey,
          propertyId: rentEntry.tenant.propertyId,
          tenantId,
          rentEntryId: rentEntry.id,
          amount: body.amount,
          mode: body.mode,
          referenceNumber: body.referenceNumber,
          note: body.note
        }
      });
      await tx.notification.create({
        data: {
          propertyId: rentEntry.tenant.propertyId,
          userId: rentEntry.tenant.property.ownerProfile.userId,
          title: "Tenant payment update",
          content: noteParts.join(" "),
          category: "PAYMENT"
        }
      });
      return created;
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "tenant.payment_notify",
      resource: "RentEntry",
      resourceId: rentEntry.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return reply.status(201).send(ok({
      rentEntryId: rentEntry.id,
      claimId: claim.id,
      amount: body.amount,
      mode: body.mode,
      message: "Payment update sent to owner for confirmation."
    }));
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
        isVoided: false,
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
        isVoided: false,
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

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { room: true }
    });
    if (!tenant) throw new AppError(404, "NOT_FOUND", "Tenant not found");

    const announcement = await prisma.announcement.findFirst({
      where: {
        id: params.id,
        propertyId: tenant.propertyId,
        OR: [
          { targetFloor: null, targetRoomId: null },
          { targetFloor: tenant.room.floor, targetRoomId: null },
          { targetRoomId: tenant.roomId }
        ]
      }
    });
    if (!announcement) throw new AppError(404, "NOT_FOUND", "Announcement not found");

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
