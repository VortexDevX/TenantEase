import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { toNotificationDto } from "../common/serializers.js";
import { assertPropertyAccess } from "../../lib/auth-guards.js";
import { z } from "zod";
import { recalculateRentEntry } from "../rent/service.js";
import { generateReceipt } from "../receipts/service.js";

const resolveClaimSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE") }),
  z.object({ decision: z.literal("REJECT"), reason: z.string().trim().min(3).max(255) })
]);

export async function notificationRoutes(app: FastifyInstance) {
  app.get("/notifications", { preHandler: [app.authenticateAny] }, async (request) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: request.user.sub },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return ok(notifications.map(toNotificationDto));
  });

  app.post("/notifications/:id/read", { preHandler: [app.authenticateAny] }, async (request) => {
    const { id } = request.params as { id: string };
    const notification = await prisma.notification.findFirst({
      where: { id, userId: request.user.sub },
      select: { id: true }
    });
    if (!notification) throw new AppError(404, "NOT_FOUND", "Notification not found");

    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() }
    });
    return ok({ id, read: true });
  });

  app.get("/properties/:propertyId/payment-claims", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const { propertyId } = request.params as { propertyId: string };
    await assertPropertyAccess(request, propertyId, "payment:read");
    const claims = await prisma.offlinePaymentClaim.findMany({
      where: { propertyId },
      include: { tenant: { select: { fullName: true } }, rentEntry: { select: { billingMonth: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return ok(claims.map((claim) => ({
      id: claim.id,
      tenantName: claim.tenant.fullName,
      billingMonth: claim.rentEntry.billingMonth,
      amount: claim.amount,
      mode: claim.mode,
      referenceNumber: claim.referenceNumber,
      note: claim.note,
      status: claim.status,
      rejectionReason: claim.rejectionReason,
      createdAt: claim.createdAt.toISOString(),
      reviewedAt: claim.reviewedAt?.toISOString() ?? null
    })));
  });

  app.post("/payment-claims/:id/resolve", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = resolveClaimSchema.parse(request.body);
    const target = await prisma.offlinePaymentClaim.findUnique({ where: { id } });
    if (!target) throw new AppError(404, "NOT_FOUND", "Payment claim not found");
    const { ownerProfileId } = await assertPropertyAccess(request, target.propertyId, "payment:write");
    if (target.status !== "PENDING") throw new AppError(409, "VALIDATION_ERROR", "Payment claim is already resolved");

    if (body.decision === "REJECT") {
      const rejected = await prisma.offlinePaymentClaim.update({
        where: { id },
        data: { status: "REJECTED", rejectionReason: body.reason, reviewedAt: new Date(), reviewedByUserId: request.user.sub }
      });
      return ok({ id: rejected.id, status: rejected.status });
    }

    const payment = await prisma.$transaction(async (tx) => {
      const claim = await tx.offlinePaymentClaim.findUnique({ where: { id } });
      if (!claim || claim.status !== "PENDING") throw new AppError(409, "VALIDATION_ERROR", "Payment claim is already resolved");
      const rentEntry = await tx.rentEntry.findUnique({ where: { id: claim.rentEntryId } });
      if (!rentEntry) throw new AppError(404, "RENT_ENTRY_NOT_FOUND", "Rent entry not found");
      const paid = await tx.payment.aggregate({ where: { rentEntryId: rentEntry.id, isVoided: false }, _sum: { amount: true } });
      const remaining = Math.max(0, rentEntry.amountDue - (paid._sum.amount ?? 0));
      if (claim.amount > remaining) throw new AppError(422, "VALIDATION_ERROR", "Claim exceeds the current pending balance");

      const created = await tx.payment.create({
        data: {
          rentEntryId: rentEntry.id,
          amount: claim.amount,
          mode: claim.mode,
          paidAt: claim.createdAt,
          referenceNumber: claim.referenceNumber,
          note: claim.note,
          idempotencyKey: claim.id
        }
      });
      await recalculateRentEntry(rentEntry.id, tx);
      await tx.offlinePaymentClaim.update({
        where: { id },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedByUserId: request.user.sub }
      });
      return created;
    });

    try {
      await generateReceipt(payment.id, ownerProfileId);
    } catch (error) {
      request.log.error({ err: error, paymentId: payment.id }, "receipt generation failed after claim approval");
    }
    return ok({ id, status: "APPROVED", paymentId: payment.id });
  });
}
