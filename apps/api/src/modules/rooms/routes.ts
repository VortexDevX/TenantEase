import type { FastifyInstance } from "fastify";
import { assertPropertyAccess, assertRoomAccess } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";
import { roomInputSchema } from "../common/schemas.js";
import { toRoomDto } from "../common/serializers.js";
import { roomStatusFromOccupancy } from "./service.js";

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function roomNumberConflict() {
  return new AppError(409, "VALIDATION_ERROR", "A room with this number already exists in this property");
}

export async function roomRoutes(app: FastifyInstance) {
  app.get("/properties/:propertyId/rooms", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { propertyId: string };
    await assertPropertyAccess(request, params.propertyId, "room:read");
    const rooms = await prisma.room.findMany({
      where: { propertyId: params.propertyId },
      orderBy: { roomNumber: "asc" }
    });
    return ok(rooms.map(toRoomDto));
  });

  app.post("/properties/:propertyId/rooms", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { propertyId: string };
    const body = roomInputSchema.parse(request.body);
    await assertPropertyAccess(request, params.propertyId, "room:write");
    const room = await prisma.room
      .create({
        data: {
          ...body,
          propertyId: params.propertyId,
          status: roomStatusFromOccupancy(body.bedCount, 0)
        }
      })
      .catch((error: unknown) => {
        if (isUniqueConstraintError(error)) {
          throw roomNumberConflict();
        }

        throw error;
      });
    await createAuditLog({
      userId: request.user.sub,
      action: "room.create",
      resource: "Room",
      resourceId: room.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });
    return ok(toRoomDto(room));
  });

  app.get("/rooms/:id", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    await assertRoomAccess(request, params.id, "room:read");
    const room = await prisma.room.findFirst({
      where: {
        id: params.id
      }
    });
    if (!room) {
      throw new AppError(404, "ROOM_NOT_FOUND", "Room not found");
    }
    return ok(toRoomDto(room));
  });

  app.put("/rooms/:id", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    const body = roomInputSchema.parse(request.body);
    await assertRoomAccess(request, params.id, "room:write");
    const room = await prisma.room.findFirst({
      where: {
        id: params.id
      }
    });
    if (!room) {
      throw new AppError(404, "ROOM_NOT_FOUND", "Room not found");
    }
    if (room.occupiedBeds > body.bedCount) {
      throw new AppError(422, "ROOM_NO_VACANCY", "Occupied beds exceed new capacity");
    }
    const updated = await prisma.room
      .update({
        where: { id: room.id },
        data: {
          ...body,
          status: roomStatusFromOccupancy(body.bedCount, room.occupiedBeds)
        }
      })
      .catch((error: unknown) => {
        if (isUniqueConstraintError(error)) {
          throw roomNumberConflict();
        }

        throw error;
      });
    await createAuditLog({
      userId: request.user.sub,
      action: "room.update",
      resource: "Room",
      resourceId: updated.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });
    return ok(toRoomDto(updated));
  });

  app.delete("/rooms/:id", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    await assertRoomAccess(request, params.id, "room:write");
    const room = await prisma.room.findFirst({
      where: {
        id: params.id
      }
    });
    if (!room) {
      throw new AppError(404, "ROOM_NOT_FOUND", "Room not found");
    }
    if (room.occupiedBeds > 0) {
      throw new AppError(422, "ROOM_HAS_TENANTS", "Cannot delete room with active tenants");
    }
    const historicalReferences = await prisma.room.findUnique({
      where: { id: room.id },
      select: {
        _count: { select: { tenants: true, transfersFrom: true, transfersTo: true, vacateRecords: true, utilityReadings: true } }
      }
    });
    const referenceCount = historicalReferences
      ? Object.values(historicalReferences._count).reduce((sum, count) => sum + count, 0)
      : 0;
    if (referenceCount > 0) {
      throw new AppError(422, "VALIDATION_ERROR", "Cannot delete a room with historical records");
    }
    await prisma.room.delete({ where: { id: room.id } });
    await createAuditLog({
      userId: request.user.sub,
      action: "room.delete",
      resource: "Room",
      resourceId: room.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });
    return ok({ deleted: true });
  });
}
