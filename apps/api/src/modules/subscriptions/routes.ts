import type { FastifyInstance } from "fastify";
import { requireOwnerProfileId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { ok } from "../../lib/http.js";
import {
  ensureSubscription,
  getSubscriptionOverview,
  listSubscriptionPlans,
  toInvoiceDto
} from "./service.js";

export async function subscriptionRoutes(app: FastifyInstance) {
  app.get("/subscription/plans", async () => {
    return ok(listSubscriptionPlans());
  });

  app.get("/subscription", { preHandler: [app.authenticate] }, async (request) => {
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    return ok(await getSubscriptionOverview(ownerProfileId));
  });

  app.get("/subscription/invoices", { preHandler: [app.authenticate] }, async (request) => {
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    const subscription = await ensureSubscription(ownerProfileId);
    const invoices = await prisma.invoice.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: "desc" },
      take: 24
    });

    return ok(invoices.map(toInvoiceDto));
  });
}
