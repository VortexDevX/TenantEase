import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { storageProvider } from "../../providers/mock-providers.js";
import { createAuditLog } from "../common/audit.js";
import { toMaintenanceRequestDto, toReceiptDto, toRentEntryDto } from "../common/serializers.js";

const tenantMaintenanceSchema = z.object({
  category: z.enum(["PLUMBING", "ELECTRICAL", "FURNITURE", "INTERNET", "CLEANING", "OTHER"]),
  description: z.string().min(10).max(2000),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]).default("MEDIUM"),
  preferredTime: z.string().max(30).optional().nullable()
});

export async function tenantPortalRoutes(app: FastifyInstance) {
  // 1. View Rent Entries
  app.get("/tenant-portal/rent", { preHandler: [app.authenticateTenant] }, async (request) => {
    const entries = await prisma.rentEntry.findMany({
      where: { tenantId: request.user.tenantId },
      orderBy: { billingMonth: "desc" }
    });

    return ok(entries.map(toRentEntryDto));
  });

  // 2. View Maintenance Requests
  app.get("/tenant-portal/maintenance", { preHandler: [app.authenticateTenant] }, async (request) => {
    const requests = await prisma.maintenanceRequest.findMany({
      where: { tenantId: request.user.tenantId },
      orderBy: { createdAt: "desc" }
    });

    return ok(requests.map(toMaintenanceRequestDto));
  });

  // 3. Create Maintenance Request
  app.post("/tenant-portal/maintenance", { preHandler: [app.authenticateTenant] }, async (request) => {
    const body = tenantMaintenanceSchema.parse(request.body);

    const tenant = await prisma.tenant.findUnique({
      where: { id: request.user.tenantId },
      select: { propertyId: true }
    });

    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant associated with token not found");
    }

    const mreq = await prisma.maintenanceRequest.create({
      data: {
        ...body,
        tenantId: request.user.tenantId,
        propertyId: tenant.propertyId
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
    
    // Ensure the receipt actually belongs to the authenticated tenant
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: params.id,
        payment: {
          rentEntry: {
            tenantId: request.user.tenantId
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
}
