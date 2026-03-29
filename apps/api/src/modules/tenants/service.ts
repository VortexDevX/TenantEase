import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { roomStatusFromOccupancy } from "../rooms/service.js";

export async function assertRoomAvailability(roomId: string, ownerProfileId: string) {
  const room = await prisma.room.findFirst({
    where: {
      id: roomId,
      property: { ownerProfileId }
    }
  });

  if (!room) {
    throw new AppError(404, "ROOM_NOT_FOUND", "Room not found");
  }

  if (room.occupiedBeds >= room.bedCount) {
    throw new AppError(422, "ROOM_NO_VACANCY", "Room has no vacancy");
  }

  return room;
}

export async function recalculateRoom(roomId: string) {
  const room = await prisma.room.findUnique({
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
  await prisma.room.update({
    where: { id: room.id },
    data: {
      occupiedBeds,
      status: roomStatusFromOccupancy(room.bedCount, occupiedBeds)
    }
  });
}

