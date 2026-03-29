import { describe, expect, it, vi } from "vitest";
import { computeRentStatus } from "./service.js";

describe("computeRentStatus", () => {
  it("should mark paid when amountPaid covers amountDue", () => {
    expect(computeRentStatus(1000, 1000, new Date())).toBe("PAID");
  });

  it("should mark partial when some amount is paid", () => {
    expect(computeRentStatus(1000, 250, new Date())).toBe("PARTIAL");
  });

  it("should mark overdue when due date is in the past and nothing is paid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T00:00:00Z"));
    expect(computeRentStatus(1000, 0, new Date("2026-03-01T00:00:00Z"))).toBe("OVERDUE");
    vi.useRealTimers();
  });
});

