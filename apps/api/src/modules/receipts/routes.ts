import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { storageProvider } from "../../providers/mock-providers.js";
import { createAuditLog } from "../common/audit.js";
import { toReceiptDto } from "../common/serializers.js";
import { generateReceipt } from "./service.js";

export async function receiptRoutes(app: FastifyInstance) {
  app.post("/receipts", { preHandler: [app.authenticate] }, async (request) => {
    const body = request.body as { paymentId?: string };
    if (!body.paymentId) {
      throw new AppError(400, "VALIDATION_ERROR", "paymentId is required");
    }
    const receipt = await generateReceipt(body.paymentId, request.user.ownerProfileId);
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

  app.get("/receipts/:id/download", { preHandler: [app.authenticate] }, async (request, reply) => {
    const params = request.params as { id: string };
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: params.id,
        payment: {
          rentEntry: {
            tenant: {
              property: { ownerProfileId: request.user.ownerProfileId }
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

  app.get("/tenants/:tenantId/receipts", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { tenantId: string };
    const receipts = await prisma.receipt.findMany({
      where: {
        payment: {
          rentEntry: {
            tenantId: params.tenantId,
            tenant: {
              property: { ownerProfileId: request.user.ownerProfileId }
            }
          }
        }
      },
      orderBy: { generatedAt: "desc" }
    });

    return ok(receipts.map(toReceiptDto));
  });
}
