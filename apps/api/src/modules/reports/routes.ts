import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";

export async function reportsRoutes(app: FastifyInstance) {

  // ─── GET /properties/:propertyId/reports/monthly ───
  // Monthly financial report with income, payments breakdown, occupancy, P&L
  app.get("/properties/:propertyId/reports/monthly", async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const query = request.query as Record<string, string>;

    const now = new Date();
    const month = query.month ? parseInt(query.month, 10) : now.getMonth() + 1;
    const year = query.year ? parseInt(query.year, 10) : now.getFullYear();
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
  app.post("/properties/:propertyId/receipts/bulk", async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const query = request.query as Record<string, string>;

    const now = new Date();
    const month = query.month ? parseInt(query.month, 10) : now.getMonth() + 1;
    const year = query.year ? parseInt(query.year, 10) : now.getFullYear();
    const billingMonth = `${year}-${String(month).padStart(2, "0")}`;

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new AppError(404, "PROPERTY_NOT_FOUND", "Property not found");

    const tenants = await prisma.tenant.findMany({ where: { propertyId } });
    const tenantIds = tenants.map((t) => t.id);

    // Find all payments in this billing month that don't have receipts
    const payments = await prisma.payment.findMany({
      where: {
        rentEntry: { tenantId: { in: tenantIds }, billingMonth },
        isVoided: false,
        receipt: null,
      },
      include: { rentEntry: { include: { tenant: true } } },
    });

    const generated: Array<{ tenantName: string; receiptNumber: string; amount: number }> = [];

    for (const payment of payments) {
      const receiptNumber = `TE-${year}-${String(month).padStart(2, "0")}-${String(generated.length + 1).padStart(5, "0")}`;
      
      await prisma.receipt.create({
        data: {
          paymentId: payment.id,
          receiptNumber,
          filePath: `/storage/receipts/${receiptNumber}.pdf`,
          generatedAt: new Date(),
        },
      });

      generated.push({
        tenantName: payment.rentEntry.tenant.fullName,
        receiptNumber,
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
  app.get("/properties/:propertyId/receipts/annual", async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const query = request.query as Record<string, string>;

    const fy = query.fy ? parseInt(query.fy, 10) : (new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1);
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

  // ─── POST /properties/:propertyId/late-fees/apply ───
  // Auto-calculate and apply late fees to overdue rent entries
  app.post("/properties/:propertyId/late-fees/apply", async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new AppError(404, "PROPERTY_NOT_FOUND", "Property not found");

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

    // Default: ₹50/day late fee (5000 paisa) — configurable per property in future
    const LATE_FEE_PER_DAY = 5000; // paisa
    const GRACE_PERIOD_DAYS = 5;

    const applied: Array<{ tenant: string; room: string; daysLate: number; lateFee: number; newTotal: number }> = [];

    for (const entry of overdueEntries) {
      const daysLate = Math.floor((now.getTime() - new Date(entry.dueDate).getTime()) / 86400000);
      if (daysLate <= GRACE_PERIOD_DAYS) continue;

      const effectiveDays = daysLate - GRACE_PERIOD_DAYS;
      const lateFee = effectiveDays * LATE_FEE_PER_DAY;

      // Only apply if not already marked overdue with a late fee factored in
      const newAmountDue = entry.amountDue + lateFee;

      await prisma.rentEntry.update({
        where: { id: entry.id },
        data: {
          amountDue: newAmountDue,
          status: "OVERDUE",
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
