import type { FastifyInstance } from "fastify";
import { assertPaymentAccess, assertReceiptAccess, assertTenantAccess } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { storageProvider } from "../../providers/mock-providers.js";
import { notificationProvider } from "../../providers/notification-provider.js";
import { createAuditLog } from "../common/audit.js";
import { toReceiptDto } from "../common/serializers.js";
import { generateReceipt } from "./service.js";

export async function receiptRoutes(app: FastifyInstance) {
  app.post("/receipts", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const body = request.body as { paymentId?: string };
    if (!body.paymentId) {
      throw new AppError(400, "VALIDATION_ERROR", "paymentId is required");
    }
    const { ownerProfileId } = await assertPaymentAccess(request, body.paymentId, "receipt:write");
    const receipt = await generateReceipt(body.paymentId, ownerProfileId);
    await createAuditLog({
      userId: request.user.sub,
      action: "receipt.generate",
      resource: "Receipt",
      resourceId: receipt.id,
      payload: { paymentId: body.paymentId },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });
    return ok(toReceiptDto(receipt));
  });

  app.get("/receipts/:id/download", { preHandler: [app.authenticateOwnerOrStaff] }, async (request, reply) => {
    const params = request.params as { id: string };
    const { ownerProfileId } = await assertReceiptAccess(request, params.id, "receipt:read");
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: params.id,
        isVoided: false,
        payment: {
          rentEntry: {
            tenant: {
              property: { ownerProfileId }
            }
          }
        }
      }
    });

    if (!receipt) {
      throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found");
    }

    const buffer = await storageProvider.readBuffer(receipt.filePath);
    reply
      .header("content-type", "application/pdf")
      .header("content-disposition", `inline; filename="${receipt.receiptNumber}.pdf"`);

    return reply.send(buffer);
  });

  app.get("/tenants/:tenantId/receipts", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { tenantId: string };
    const { ownerProfileId } = await assertTenantAccess(request, params.tenantId, "receipt:read");
    const receipts = await prisma.receipt.findMany({
      where: {
        isVoided: false,
        payment: {
          rentEntry: {
            tenantId: params.tenantId,
            tenant: {
              property: { ownerProfileId }
            }
          }
        }
      },
      orderBy: { generatedAt: "desc" }
    });

    return ok(receipts.map(toReceiptDto));
  });

  app.post("/receipts/:id/send", { preHandler: [app.authenticateOwnerOrStaff] }, async (request, reply) => {
    const params = request.params as { id: string };
    const { ownerProfileId } = await assertReceiptAccess(request, params.id, "receipt:write");
    
    // Ensure the receipt exists and belongs to the owner's property
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: params.id,
        isVoided: false,
        payment: {
          rentEntry: {
            tenant: {
              property: { ownerProfileId }
            }
          }
        }
      },
      include: {
        payment: {
          include: {
            rentEntry: {
              include: {
                tenant: true
              }
            }
          }
        }
      }
    });

    if (!receipt) {
      throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found");
    }

    const tenant = receipt.payment.rentEntry.tenant;
    const message = `Your TenantEase receipt ${receipt.receiptNumber} is ready.`;
    await notificationProvider.send("SMS", { phone: tenant.phone, email: tenant.email }, message);
    if (tenant.email) {
      await notificationProvider.send("EMAIL", { phone: tenant.phone, email: tenant.email }, message);
    }

    await createAuditLog({
      userId: request.user.sub,
      action: "receipt.send",
      resource: "Receipt",
      resourceId: receipt.id,
      payload: { phone: tenant.phone, email: tenant.email, method: "notification_provider" },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok({ message: "Receipt sent successfully" });
  });
}
