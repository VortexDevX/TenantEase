export type UtilityBillingModel = "FLAT_RATE" | "PER_TENANT" | "INDIVIDUAL_METER" | "SHARED_METER";

export type UtilityRoomCharge = {
  roomId: string;
  tenantIds: string[];
  meterCharge: number;
};

export type TenantUtilityAllocation = {
  tenantId: string;
  amount: number;
};

function splitExactly(total: number, ids: string[]): TenantUtilityAllocation[] {
  const sorted = [...new Set(ids)].sort();
  if (sorted.length === 0 || total <= 0) return [];
  const base = Math.floor(total / sorted.length);
  const remainder = total % sorted.length;
  return sorted.map((tenantId, index) => ({
    tenantId,
    amount: base + (index < remainder ? 1 : 0)
  }));
}

function mergeAllocations(items: TenantUtilityAllocation[]) {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.tenantId, (totals.get(item.tenantId) ?? 0) + item.amount);
  }
  return Array.from(totals, ([tenantId, amount]) => ({ tenantId, amount }));
}

export function allocateUtilityCharges(
  billingModel: UtilityBillingModel,
  ratePerUnit: number,
  rooms: UtilityRoomCharge[]
): TenantUtilityAllocation[] {
  if (billingModel === "SHARED_METER") {
    const total = rooms.reduce((sum, room) => sum + room.meterCharge, 0);
    return splitExactly(total, rooms.flatMap((room) => room.tenantIds));
  }

  if (billingModel === "PER_TENANT") {
    return mergeAllocations(
      rooms.flatMap((room) => room.tenantIds.map((tenantId) => ({ tenantId, amount: ratePerUnit })))
    );
  }

  return mergeAllocations(rooms.flatMap((room) => {
    const total = billingModel === "FLAT_RATE" ? ratePerUnit : room.meterCharge;
    return splitExactly(total, room.tenantIds);
  }));
}
