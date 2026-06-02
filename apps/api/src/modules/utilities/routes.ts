import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireOwnerProfileId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { assertPropertyOwnership } from "../common/owner.js";
import { computeRentStatus } from "../rent/service.js";

const UtilityTypeEnum = z.enum(["ELECTRICITY", "WATER", "GAS", "INTERNET"]);
const BillingModelEnum = z.enum(["FLAT_RATE", "PER_TENANT", "INDIVIDUAL_METER", "SHARED_METER"]);

type UtilityCharge = {
  type: z.infer<typeof UtilityTypeEnum>;
  amount: number;
  details?: string;
};

const utilityQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  type: UtilityTypeEnum.default("ELECTRICITY")
});

const submitReadingsSchema = z.object({
  utilityType: UtilityTypeEnum,
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  billingModel: BillingModelEnum,
  ratePerUnit: z.number().int().min(1),
  readings: z.array(z.object({
    roomId: z.string().uuid(),
    previousReading: z.number().int().min(0).optional(),
    currentReading: z.number().int().min(0),
  })).min(1),
});

export async function utilityRoutes(app: FastifyInstance) {

  // ─── GET /properties/:propertyId/utilities ───
  // Returns utility readings for a property, filtered by month/year/type
  app.get("/properties/:propertyId/utilities", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const query = utilityQuerySchema.parse(request.query);
    await assertPropertyOwnership(propertyId, requireOwnerProfileId(request.user.ownerProfileId));

    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();
    const utilityType = query.type;

    const readings = await prisma.utilityReading.findMany({
      where: {
        propertyId,
        month,
        year,
        utilityType,
      },
      include: {
        room: { select: { id: true, roomNumber: true, floor: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const mapped = readings.map((r) => ({
      id: r.id,
      propertyId: r.propertyId,
      roomId: r.roomId,
      roomNumber: r.room?.roomNumber ?? null,
      floor: r.room?.floor ?? null,
      utilityType: r.utilityType,
      month: r.month,
      year: r.year,
      previousReading: r.previousReading,
      currentReading: r.currentReading,
      unitsConsumed: r.unitsConsumed,
      ratePerUnit: r.ratePerUnit,
      totalCharge: r.totalCharge,
      billingModel: r.billingModel,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    }));

    return reply.send(ok(mapped));
  });

  // ─── POST /properties/:propertyId/utilities ───
  // Submit meter readings, compute charges, and apply to rent entries
  app.post("/properties/:propertyId/utilities", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const body = submitReadingsSchema.parse(request.body);
    await assertPropertyOwnership(propertyId, requireOwnerProfileId(request.user.ownerProfileId));

    const results: Array<{
      room: string;
      roomId: string;
      units: number;
      charge: number;
    }> = [];

    let totalUnits = 0;
    let totalCharge = 0;

    for (const reading of body.readings) {
      // Validate room belongs to property
      const room = await prisma.room.findFirst({
        where: { id: reading.roomId, propertyId },
      });
      if (!room) {
        throw new AppError(400, "VALIDATION_ERROR", `Room ${reading.roomId} not found in this property`);
      }

      // Auto-fill previous reading from last month if not provided
      let prevReading = reading.previousReading ?? 0;
      if (reading.previousReading === undefined) {
        const lastMonth = body.month === 1 ? 12 : body.month - 1;
        const lastYear = body.month === 1 ? body.year - 1 : body.year;
        const prev = await prisma.utilityReading.findUnique({
          where: {
            propertyId_roomId_utilityType_month_year: {
              propertyId,
              roomId: reading.roomId,
              utilityType: body.utilityType,
              month: lastMonth,
              year: lastYear,
            },
          },
        });
        if (prev?.currentReading !== undefined && prev.currentReading !== null) {
          prevReading = prev.currentReading;
        }
      }

      // Validate current >= previous
      if (reading.currentReading < prevReading) {
        throw new AppError(400, "VALIDATION_ERROR",
          `Current reading (${reading.currentReading}) must be >= previous reading (${prevReading}) for room ${room.roomNumber}`);
      }

      const units = reading.currentReading - prevReading;
      const charge = units * body.ratePerUnit;

      totalUnits += units;
      totalCharge += charge;

      // Upsert the utility reading
      await prisma.utilityReading.upsert({
        where: {
          propertyId_roomId_utilityType_month_year: {
            propertyId,
            roomId: reading.roomId,
            utilityType: body.utilityType,
            month: body.month,
            year: body.year,
          },
        },
        create: {
          propertyId,
          roomId: reading.roomId,
          utilityType: body.utilityType,
          month: body.month,
          year: body.year,
          previousReading: prevReading,
          currentReading: reading.currentReading,
          unitsConsumed: units,
          ratePerUnit: body.ratePerUnit,
          totalCharge: charge,
          billingModel: body.billingModel,
        },
        update: {
          previousReading: prevReading,
          currentReading: reading.currentReading,
          unitsConsumed: units,
          ratePerUnit: body.ratePerUnit,
          totalCharge: charge,
          billingModel: body.billingModel,
        },
      });

      // Apply charge to tenant rent entries for this room/month
      const billingMonth = `${body.year}-${String(body.month).padStart(2, "0")}`;
      const tenants = await prisma.tenant.findMany({
        where: { roomId: reading.roomId, status: "ACTIVE" },
      });

      for (const tenant of tenants) {
        const rentEntry = await prisma.rentEntry.findUnique({
          where: { tenantId_billingMonth: { tenantId: tenant.id, billingMonth } },
        });

        if (rentEntry) {
          // Merge utility charge into existing utilityCharges array
          const existing = parseUtilityCharges(rentEntry.utilityCharges);
          const filtered = existing.filter((charge) => charge.type !== body.utilityType);
          filtered.push({
            type: body.utilityType,
            amount: charge,
            details: `${units} units @ ₹${(body.ratePerUnit / 100).toFixed(2)}/unit`,
          });

          const utilityTotal = filtered.reduce((sum: number, c: any) => sum + c.amount, 0);
          const newTotal = rentEntry.amountDue - sumUtilityCharges(existing) + utilityTotal;

          await prisma.rentEntry.update({
            where: { id: rentEntry.id },
            data: {
              utilityCharges: filtered,
              amountDue: newTotal,
              status: computeRentStatus(newTotal, rentEntry.amountPaid, rentEntry.dueDate),
            },
          });
        }
      }

      results.push({
        room: room.roomNumber,
        roomId: room.id,
        units,
        charge,
      });
    }

    return reply.status(201).send(ok({
      totalRooms: results.length,
      totalUnits,
      totalCharge,
      readings: results,
      appliedToRentEntries: true,
      message: `${body.utilityType} charges applied to ${results.length} rooms for ${monthName(body.month)} ${body.year}`,
    }));
  });
}

function parseUtilityCharges(charges: unknown): UtilityCharge[] {
  if (!Array.isArray(charges)) {
    return [];
  }

  return charges.flatMap((charge) => {
    if (
      typeof charge === "object" &&
      charge !== null &&
      "type" in charge &&
      "amount" in charge &&
      UtilityTypeEnum.safeParse(charge.type).success &&
      typeof charge.amount === "number" &&
      Number.isFinite(charge.amount)
    ) {
      return [charge as UtilityCharge];
    }

    return [];
  });
}

function sumUtilityCharges(charges: UtilityCharge[]): number {
  return charges.reduce((sum, charge) => sum + charge.amount, 0);
}

function monthName(month: number): string {
  const names = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return names[month - 1] || "";
}
