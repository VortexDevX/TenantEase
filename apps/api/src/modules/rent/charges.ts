import { z } from "zod";

const chargeSchema = z.object({
  sourceKey: z.string().min(1),
  type: z.string().min(1),
  amount: z.number().int(),
  details: z.string().optional()
});

export type RentCharge = z.infer<typeof chargeSchema>;

export function parseRentCharges(charges: unknown): RentCharge[] {
  if (!Array.isArray(charges)) return [];

  return charges.flatMap((charge, index) => {
    const parsed = chargeSchema.safeParse(charge);
    if (parsed.success) return [parsed.data];

    if (
      typeof charge === "object" &&
      charge !== null &&
      "type" in charge &&
      "amount" in charge &&
      typeof charge.type === "string" &&
      typeof charge.amount === "number" &&
      Number.isFinite(charge.amount)
    ) {
      return [{
        sourceKey: `legacy:${charge.type}:${index}`,
        type: charge.type,
        amount: Math.trunc(charge.amount),
        details: "Migrated legacy charge"
      }];
    }

    return [];
  });
}

export function sumRentCharges(charges: RentCharge[]) {
  return charges.reduce((sum, charge) => sum + charge.amount, 0);
}

export function replaceRentCharge(charges: RentCharge[], next: RentCharge) {
  return [...charges.filter((charge) => charge.sourceKey !== next.sourceKey), next];
}
