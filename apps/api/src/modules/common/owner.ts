import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";

export async function assertPropertyOwnership(propertyId: string, ownerProfileId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerProfileId }
  });

  if (!property) {
    throw new AppError(404, "PROPERTY_NOT_FOUND", "Property not found");
  }

  return property;
}

