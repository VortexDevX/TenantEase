import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { roomStatusFromOccupancy } from "../rooms/service.js";

type DbClient = typeof prisma | Prisma.TransactionClient;

export async function lockRoom(tx: Prisma.TransactionClient, roomId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${roomId}))`;
}

export async function assertRoomAvailability(roomId: string, ownerProfileId: string, db: DbClient = prisma) {
  const room = await db.room.findFirst({
    where: {
      id: roomId,
      property: { ownerProfileId }
    }
  });

  if (!room) {
    throw new AppError(404, "ROOM_NOT_FOUND", "Room not found");
  }

  const occupiedBeds = await db.tenant.count({
    where: { roomId, status: { in: ["ACTIVE", "NOTICE"] } }
  });

  if (occupiedBeds >= room.bedCount) {
    throw new AppError(422, "ROOM_NO_VACANCY", "Room has no vacancy");
  }

  return room;
}

export async function recalculateRoom(roomId: string, db: DbClient = prisma) {
  const room = await db.room.findUnique({
    where: { id: roomId },
    include: {
      tenants: {
        where: { status: { in: ["ACTIVE", "NOTICE"] } }
      }
    }
  });

  if (!room) {
    return;
  }

  const occupiedBeds = room.tenants.length;
  await db.room.update({
    where: { id: room.id },
    data: {
      occupiedBeds,
      status: roomStatusFromOccupancy(room.bedCount, occupiedBeds)
    }
  });
}
