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

export async function assertTenantOwnership(tenantId: string, ownerProfileId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: {
      id: tenantId,
      room: {
        property: {
          ownerProfileId
        }
      }
    }
  });

  if (!tenant) {
    throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");
  }

  return tenant;
}

