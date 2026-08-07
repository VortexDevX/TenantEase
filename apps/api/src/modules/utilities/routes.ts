import { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertPropertyAccess } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { parseRentCharges, replaceRentCharge, sumRentCharges } from "../rent/charges.js";
import { computeRentStatus } from "../rent/service.js";
import { allocateUtilityCharges } from "./service.js";

const UtilityTypeEnum = z.enum(["ELECTRICITY", "WATER", "GAS", "INTERNET"]);
const BillingModelEnum = z.enum(["FLAT_RATE", "PER_TENANT", "INDIVIDUAL_METER", "SHARED_METER"]);

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
  app.get("/properties/:propertyId/utilities", { preHandler: [app.authenticateOwnerOrStaff] }, async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const query = utilityQuerySchema.parse(request.query);
    await assertPropertyAccess(request, propertyId, "utility:read");

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
  app.post("/properties/:propertyId/utilities", { preHandler: [app.authenticateOwnerOrStaff] }, async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const body = submitReadingsSchema.parse(request.body);
    await assertPropertyAccess(request, propertyId, "utility:write");

    const roomIds = body.readings.map((reading) => reading.roomId);
    if (new Set(roomIds).size !== roomIds.length) {
      throw new AppError(400, "VALIDATION_ERROR", "Each room may appear only once per utility submission");
    }

    const billingMonth = `${body.year}-${String(body.month).padStart(2, "0")}`;
    const result = await prisma.$transaction(async (tx) => {
      const rooms = await tx.room.findMany({
        where: { id: { in: roomIds }, propertyId },
        include: {
          tenants: {
            where: { status: { in: ["ACTIVE", "NOTICE"] } },
            select: { id: true }
          }
        }
      });
      if (rooms.length !== roomIds.length) {
        throw new AppError(400, "VALIDATION_ERROR", "One or more rooms do not belong to this property");
      }

      const roomsById = new Map(rooms.map((room) => [room.id, room]));
      const calculated = [];
      for (const reading of body.readings) {
        const room = roomsById.get(reading.roomId)!;
        let previousReading = reading.previousReading ?? 0;
        if (reading.previousReading === undefined) {
          const lastMonth = body.month === 1 ? 12 : body.month - 1;
          const lastYear = body.month === 1 ? body.year - 1 : body.year;
          const previous = await tx.utilityReading.findUnique({
            where: {
              propertyId_roomId_utilityType_month_year: {
                propertyId,
                roomId: reading.roomId,
                utilityType: body.utilityType,
                month: lastMonth,
                year: lastYear
              }
            }
          });
          previousReading = previous?.currentReading ?? 0;
        }
        if (reading.currentReading < previousReading) {
          throw new AppError(400, "VALIDATION_ERROR",
            `Current reading must be at least ${previousReading} for room ${room.roomNumber}`);
        }
        const units = reading.currentReading - previousReading;
        const meterCharge = units * body.ratePerUnit;
        calculated.push({ reading, room, previousReading, units, meterCharge });
      }

      const allocations = allocateUtilityCharges(
        body.billingModel,
        body.ratePerUnit,
        calculated.map((item) => ({
          roomId: item.room.id,
          tenantIds: item.room.tenants.map((tenant) => tenant.id),
          meterCharge: item.meterCharge
        }))
      );

      for (const item of calculated) {
        const roomCharge = body.billingModel === "PER_TENANT"
          ? item.room.tenants.length * body.ratePerUnit
          : body.billingModel === "FLAT_RATE"
            ? body.ratePerUnit
            : item.meterCharge;
        await tx.utilityReading.upsert({
          where: {
            propertyId_roomId_utilityType_month_year: {
              propertyId,
              roomId: item.room.id,
              utilityType: body.utilityType,
              month: body.month,
              year: body.year
            }
          },
          create: {
            propertyId,
            roomId: item.room.id,
            utilityType: body.utilityType,
            month: body.month,
            year: body.year,
            previousReading: item.previousReading,
            currentReading: item.reading.currentReading,
            unitsConsumed: item.units,
            ratePerUnit: body.ratePerUnit,
            totalCharge: roomCharge,
            billingModel: body.billingModel
          },
          update: {
            previousReading: item.previousReading,
            currentReading: item.reading.currentReading,
            unitsConsumed: item.units,
            ratePerUnit: body.ratePerUnit,
            totalCharge: roomCharge,
            billingModel: body.billingModel
          }
        });
      }

      let appliedToRentEntries = 0;
      for (const allocation of allocations) {
        const rentEntry = await tx.rentEntry.findUnique({
          where: { tenantId_billingMonth: { tenantId: allocation.tenantId, billingMonth } }
        });
        if (!rentEntry) continue;
        const existing = parseRentCharges(rentEntry.utilityCharges);
        const nextCharges = replaceRentCharge(existing, {
          sourceKey: `utility:${body.utilityType}:${billingMonth}`,
          type: body.utilityType,
          amount: allocation.amount,
          details: `${body.billingModel} allocation`
        });
        const baseRent = rentEntry.amountDue - sumRentCharges(existing);
        const newTotal = baseRent + sumRentCharges(nextCharges);
        await tx.rentEntry.update({
          where: { id: rentEntry.id },
          data: {
            utilityCharges: nextCharges,
            amountDue: newTotal,
            status: computeRentStatus(newTotal, rentEntry.amountPaid, rentEntry.dueDate)
          }
        });
        appliedToRentEntries++;
      }

      return {
        readings: calculated.map((item) => ({
          room: item.room.roomNumber,
          roomId: item.room.id,
          units: item.units,
          charge: item.meterCharge
        })),
        totalUnits: calculated.reduce((sum, item) => sum + item.units, 0),
        totalCharge: allocations.reduce((sum, item) => sum + item.amount, 0),
        appliedToRentEntries
      };
    }, { isolationLevel: "Serializable" });

    return reply.status(201).send(ok({
      totalRooms: result.readings.length,
      totalUnits: result.totalUnits,
      totalCharge: result.totalCharge,
      readings: result.readings,
      appliedToRentEntries: result.appliedToRentEntries,
      message: `${body.utilityType} charges allocated to ${result.appliedToRentEntries} rent entries for ${monthName(body.month)} ${body.year}`,
    }));
  });
}

function monthName(month: number): string {
  const names = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return names[month - 1] || "";
}
