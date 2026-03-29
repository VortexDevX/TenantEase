import { RoomStatus } from "@prisma/client";

export function roomStatusFromOccupancy(bedCount: number, occupiedBeds: number): RoomStatus {
  if (occupiedBeds <= 0) {
    return RoomStatus.VACANT;
  }
  if (occupiedBeds >= bedCount) {
    return RoomStatus.OCCUPIED;
  }
  return RoomStatus.PARTIAL;
}

