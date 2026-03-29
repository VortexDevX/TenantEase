import { describe, expect, it } from "vitest";
import { roomStatusFromOccupancy } from "./service.js";

describe("roomStatusFromOccupancy", () => {
  it("should return vacant when occupied beds are zero", () => {
    expect(roomStatusFromOccupancy(2, 0)).toBe("VACANT");
  });

  it("should return partial when occupancy is between zero and capacity", () => {
    expect(roomStatusFromOccupancy(3, 1)).toBe("PARTIAL");
  });

  it("should return occupied when occupancy meets capacity", () => {
    expect(roomStatusFromOccupancy(2, 2)).toBe("OCCUPIED");
  });
});

