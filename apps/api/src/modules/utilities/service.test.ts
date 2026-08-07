import { describe, expect, it } from "vitest";
import { allocateUtilityCharges } from "./service.js";

const rooms = [
  { roomId: "a", tenantIds: ["t2", "t1"], meterCharge: 101 },
  { roomId: "b", tenantIds: ["t3"], meterCharge: 50 }
];

describe("allocateUtilityCharges", () => {
  it("splits a room meter exactly without multiplying the charge", () => {
    expect(allocateUtilityCharges("INDIVIDUAL_METER", 10, rooms)).toEqual([
      { tenantId: "t1", amount: 51 },
      { tenantId: "t2", amount: 50 },
      { tenantId: "t3", amount: 50 }
    ]);
  });

  it("splits a shared meter across every tenant exactly once", () => {
    const allocations = allocateUtilityCharges("SHARED_METER", 10, rooms);
    expect(allocations.reduce((sum, item) => sum + item.amount, 0)).toBe(151);
    expect(allocations).toHaveLength(3);
  });

  it("supports flat per-room and per-tenant fees", () => {
    expect(allocateUtilityCharges("FLAT_RATE", 100, rooms).reduce((sum, item) => sum + item.amount, 0)).toBe(200);
    expect(allocateUtilityCharges("PER_TENANT", 100, rooms).reduce((sum, item) => sum + item.amount, 0)).toBe(300);
  });
});
