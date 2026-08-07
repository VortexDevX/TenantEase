import { FastifyInstance } from "fastify";
import { assertPropertyAccess } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { parseRentCharges, replaceRentCharge, sumRentCharges } from "../rent/charges.js";
import { computeRentStatus } from "../rent/service.js";
import { generateReceipt } from "../receipts/service.js";
import { z } from "zod";

const currentYear = new Date().getFullYear();
const monthQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).default(new Date().getMonth() + 1),
  year: z.coerce.number().int().min(2000).max(currentYear + 5).default(currentYear)
});
const financialYearQuerySchema = z.object({
  fy: z.coerce.number().int().min(2000).max(currentYear + 5).default(new Date().getMonth() >= 3 ? currentYear : currentYear - 1)
});

function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function reportsRoutes(app: FastifyInstance) {

  // ─── GET /properties/:propertyId/reports/monthly ───
  // Monthly financial report with income, payments breakdown, occupancy, P&L
  app.get("/properties/:propertyId/reports/monthly", { preHandler: [app.authenticateOwnerOrStaff] }, async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const query = monthQuerySchema.parse(request.query);
    await assertPropertyAccess(request, propertyId, "report:read");

    const now = new Date();
    const { month, year } = query;
    const billingMonth = `${year}-${String(month).padStart(2, "0")}`;

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new AppError(404, "PROPERTY_NOT_FOUND", "Property not found");

    // Get all tenants for this property
    const tenants = await prisma.tenant.findMany({ where: { propertyId } });
    const tenantIds = tenants.map((t) => t.id);

    // Get rent entries for this billing month
    const rentEntries = await prisma.rentEntry.findMany({
      where: { tenantId: { in: tenantIds }, billingMonth },
      include: { tenant: { include: { room: true } }, payments: true },
    });

    // Income calculations
    const totalExpected = rentEntries.reduce((sum, r) => sum + r.amountDue, 0);
    const totalCollected = rentEntries.reduce((sum, r) => sum + r.amountPaid, 0);
    const totalOutstanding = totalExpected - totalCollected;
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 1000) / 10 : 0;

    // Payments by mode
    const allPayments = rentEntries.flatMap((r) => r.payments.filter((p) => !p.isVoided));
    const paymentsByMode = { cash: 0, upi: 0, bankTransfer: 0, online: 0, total: 0 };
    for (const p of allPayments) {
      const key = p.mode === "CASH" ? "cash" : p.mode === "UPI" ? "upi" 
        : p.mode === "BANK_TRANSFER" ? "bankTransfer" : "online";
      paymentsByMode[key] += p.amount;
      paymentsByMode.total += p.amount;
    }

    // Occupancy
    const rooms = await prisma.room.findMany({ where: { propertyId } });
    const totalBeds = rooms.reduce((s, r) => s + r.bedCount, 0);
    const occupiedBeds = rooms.reduce((s, r) => s + r.occupiedBeds, 0);
    const vacantBeds = totalBeds - occupiedBeds;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 0;

    // Defaulters
    const defaulters = rentEntries
      .filter((r) => r.status === "OVERDUE" || (r.status !== "PAID" && new Date(r.dueDate) < now))
      .map((r) => ({
        name: r.tenant.fullName,
        room: r.tenant.room.roomNumber,
        amountDue: r.amountDue - r.amountPaid,
        daysOverdue: Math.max(0, Math.floor((now.getTime() - new Date(r.dueDate).getTime()) / 86400000)),
      }));

    const MONTHS = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];

    return reply.send(ok({
      period: `${MONTHS[month - 1]} ${year}`,
      income: {
        netExpected: totalExpected,
        totalCollected,
        totalOutstanding,
        collectionRate,
        tenantsPaid: rentEntries.filter((r) => r.status === "PAID").length,
        tenantsUnpaid: rentEntries.filter((r) => r.status !== "PAID").length,
      },
      payments: paymentsByMode,
      occupancy: {
        totalRooms: rooms.length,
        totalBeds,
        occupiedBeds,
        vacantBeds,
        occupancyRate,
      },
      defaulters,
    }));
  });

  // ─── POST /properties/:propertyId/receipts/bulk ───
  // Generate receipts for all paid entries that don't have receipts yet
  app.post("/properties/:propertyId/receipts/bulk", { preHandler: [app.authenticateOwnerOrStaff] }, async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const query = monthQuerySchema.parse(request.query);
    const { ownerProfileId } = await assertPropertyAccess(request, propertyId, "receipt:write");

    const { month, year } = query;
    const billingMonth = `${year}-${String(month).padStart(2, "0")}`;

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new AppError(404, "PROPERTY_NOT_FOUND", "Property not found");

    const tenants = await prisma.tenant.findMany({ where: { propertyId } });
    const tenantIds = tenants.map((t) => t.id);

    const payments = await prisma.payment.findMany({
      where: {
        rentEntry: { tenantId: { in: tenantIds }, billingMonth },
        isVoided: false,
        receipts: {
          none: { isVoided: false }
        },
      },
      include: { rentEntry: { include: { tenant: true } } },
    });

    const generated: Array<{ tenantName: string; receiptNumber: string; receiptId: string; amount: number }> = [];

    for (const payment of payments) {
      const receipt = await generateReceipt(payment.id, ownerProfileId);

      generated.push({
        tenantName: payment.rentEntry.tenant.fullName,
        receiptNumber: receipt.receiptNumber,
        receiptId: receipt.id,
        amount: payment.amount,
      });
    }

    return reply.status(201).send(ok({
      totalGenerated: generated.length,
      receipts: generated,
    }));
  });

  // ─── GET /properties/:propertyId/receipts/annual ───
  // Annual receipt summary for FY (April-March)
  app.get("/properties/:propertyId/receipts/annual", { preHandler: [app.authenticateOwnerOrStaff] }, async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const query = financialYearQuerySchema.parse(request.query);
    await assertPropertyAccess(request, propertyId, "receipt:read");

    const { fy } = query;
    // FY = April <fy> to March <fy+1>
    const startMonth = `${fy}-04`;
    const endMonth = `${fy + 1}-03`;

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new AppError(404, "PROPERTY_NOT_FOUND", "Property not found");

    const tenants = await prisma.tenant.findMany({ where: { propertyId } });
    const tenantIds = tenants.map((t) => t.id);

    const rentEntries = await prisma.rentEntry.findMany({
      where: {
        tenantId: { in: tenantIds },
        billingMonth: { gte: startMonth, lte: endMonth },
      },
      include: { tenant: true, payments: { where: { isVoided: false } } },
    });

    // Group by tenant
    const byTenant: Record<string, { name: string; totalDue: number; totalPaid: number; months: number }> = {};
    for (const entry of rentEntries) {
      if (!byTenant[entry.tenantId]) {
        byTenant[entry.tenantId] = {
          name: entry.tenant.fullName,
          totalDue: 0,
          totalPaid: 0,
          months: 0,
        };
      }
      byTenant[entry.tenantId].totalDue += entry.amountDue;
      byTenant[entry.tenantId].totalPaid += entry.amountPaid;
      byTenant[entry.tenantId].months += 1;
    }

    const summary = Object.entries(byTenant).map(([tenantId, data]) => ({
      tenantId,
      ...data,
      balance: data.totalDue - data.totalPaid,
    }));

    const grandTotalDue = summary.reduce((s, t) => s + t.totalDue, 0);
    const grandTotalPaid = summary.reduce((s, t) => s + t.totalPaid, 0);

    return reply.send(ok({
      financialYear: `FY ${fy}-${fy + 1}`,
      tenants: summary,
      totals: {
        totalDue: grandTotalDue,
        totalPaid: grandTotalPaid,
        balance: grandTotalDue - grandTotalPaid,
      },
    }));
  });

  app.get("/properties/:propertyId/reports/annual", { preHandler: [app.authenticateOwnerOrStaff] }, async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const query = financialYearQuerySchema.parse(request.query);
    await assertPropertyAccess(request, propertyId, "report:read");

    const { fy } = query;
    const startMonth = `${fy}-04`;
    const endMonth = `${fy + 1}-03`;
    const tenants = await prisma.tenant.findMany({ where: { propertyId } });
    const tenantIds = tenants.map((t) => t.id);
    const entries = await prisma.rentEntry.findMany({
      where: { tenantId: { in: tenantIds }, billingMonth: { gte: startMonth, lte: endMonth } },
      include: { payments: { where: { isVoided: false } } },
      orderBy: { billingMonth: "asc" }
    });

    const months = new Map<string, { expected: number; collected: number; outstanding: number }>();
    for (const entry of entries) {
      const current = months.get(entry.billingMonth) ?? { expected: 0, collected: 0, outstanding: 0 };
      current.expected += entry.amountDue;
      current.collected += entry.amountPaid;
      current.outstanding += entry.amountDue - entry.amountPaid;
      months.set(entry.billingMonth, current);
    }

    const monthly = Array.from(months.entries()).map(([billingMonth, values]) => ({ billingMonth, ...values }));
    return reply.send(ok({
      financialYear: `FY ${fy}-${fy + 1}`,
      monthly,
      totals: monthly.reduce((acc, item) => ({
        expected: acc.expected + item.expected,
        collected: acc.collected + item.collected,
        outstanding: acc.outstanding + item.outstanding
      }), { expected: 0, collected: 0, outstanding: 0 })
    }));
  });

  app.get("/properties/:propertyId/reports/monthly/export", { preHandler: [app.authenticateOwnerOrStaff] }, async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const query = monthQuerySchema.parse(request.query);
    await assertPropertyAccess(request, propertyId, "report:read");

    const { month, year } = query;
    const billingMonth = `${year}-${String(month).padStart(2, "0")}`;
    const tenants = await prisma.tenant.findMany({ where: { propertyId } });
    const rentEntries = await prisma.rentEntry.findMany({
      where: { tenantId: { in: tenants.map((tenant) => tenant.id) }, billingMonth },
      include: { tenant: { include: { room: true } } },
      orderBy: { dueDate: "asc" }
    });

    const rows = [
      ["Tenant", "Room", "Billing Month", "Amount Due", "Amount Paid", "Balance", "Status"],
      ...rentEntries.map((entry) => [
        entry.tenant.fullName,
        entry.tenant.room.roomNumber,
        entry.billingMonth,
        String(entry.amountDue),
        String(entry.amountPaid),
        String(entry.amountDue - entry.amountPaid),
        entry.status
      ])
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");

    return reply
      .header("content-type", "text/csv")
      .header("content-disposition", `attachment; filename="tenantease-${billingMonth}-report.csv"`)
      .send(csv);
  });

  // ─── POST /properties/:propertyId/late-fees/apply ───
  // Auto-calculate and apply late fees to overdue rent entries
  app.post("/properties/:propertyId/late-fees/apply", { preHandler: [app.authenticateOwnerOrStaff] }, async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    await assertPropertyAccess(request, propertyId, "rent:write");

    const property = await prisma.property.findUnique({ where: { id: propertyId }, include: { settings: true } });
    if (!property) throw new AppError(404, "PROPERTY_NOT_FOUND", "Property not found");
    const lateFeePerDay = property.settings?.lateFeePerDay ?? 0;
    const graceDays = property.settings?.lateFeeGraceDays ?? 0;
    if (lateFeePerDay <= 0) {
      return reply.send(ok({ processed: 0, feesApplied: 0, details: [] }));
    }

    const now = new Date();
    const tenants = await prisma.tenant.findMany({ where: { propertyId, status: "ACTIVE" } });
    const tenantIds = tenants.map((t) => t.id);

    // Find overdue rent entries that haven't been fully paid
    const overdueEntries = await prisma.rentEntry.findMany({
      where: {
        tenantId: { in: tenantIds },
        status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
        dueDate: { lt: now },
      },
      include: { tenant: { include: { room: true } } },
    });

    const applied: Array<{ tenant: string; room: string; daysLate: number; lateFee: number; newTotal: number }> = [];

    for (const entry of overdueEntries) {
      const daysLate = Math.floor((now.getTime() - new Date(entry.dueDate).getTime()) / 86400000);
      if (daysLate <= graceDays) continue;

      const effectiveDays = daysLate - graceDays;
      const lateFee = effectiveDays * lateFeePerDay;
      const existingCharges = parseRentCharges(entry.utilityCharges);
      const nextCharges = replaceRentCharge(existingCharges, {
        sourceKey: `late_fee:${entry.billingMonth}`,
        type: "LATE_FEE",
        amount: lateFee,
        details: `${effectiveDays} days late @ ₹${(lateFeePerDay / 100).toFixed(2)}/day`
      });
      const baseRent = entry.amountDue - sumRentCharges(existingCharges);
      const newAmountDue = baseRent + sumRentCharges(nextCharges);

      await prisma.rentEntry.update({
        where: { id: entry.id },
        data: {
          utilityCharges: nextCharges,
          amountDue: newAmountDue,
          status: computeRentStatus(newAmountDue, entry.amountPaid, entry.dueDate),
        },
      });

      applied.push({
        tenant: entry.tenant.fullName,
        room: entry.tenant.room.roomNumber,
        daysLate: effectiveDays,
        lateFee,
        newTotal: newAmountDue,
      });
    }

    return reply.send(ok({
      processed: overdueEntries.length,
      feesApplied: applied.length,
      details: applied,
    }));
  });
}
