import type { FastifyInstance } from "fastify";
import { assertPropertyAccess, assertRoomAccess, requireOwnerProfileId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";
import { roomInputSchema } from "../common/schemas.js";
import { toRoomDto } from "../common/serializers.js";
import { roomStatusFromOccupancy } from "./service.js";

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
    const room = await prisma.room.create({
      data: {
        ...body,
        propertyId: params.propertyId,
        status: roomStatusFromOccupancy(body.bedCount, 0)
      }
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
    const updated = await prisma.room.update({
      where: { id: room.id },
      data: {
        ...body,
        status: roomStatusFromOccupancy(body.bedCount, room.occupiedBeds)
      }
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

  app.delete("/rooms/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { id: string };
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    const room = await prisma.room.findFirst({
      where: {
        id: params.id,
        property: { ownerProfileId }
      }
    });
    if (!room) {
      throw new AppError(404, "ROOM_NOT_FOUND", "Room not found");
    }
    if (room.occupiedBeds > 0) {
      throw new AppError(422, "ROOM_HAS_TENANTS", "Cannot delete room with active tenants");
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
