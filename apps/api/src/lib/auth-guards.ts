import { AppError } from "./errors.js";

export function requireOwnerProfileId(ownerProfileId?: string) {
  if (!ownerProfileId) {
    throw new AppError(403, "AUTH_FORBIDDEN", "Owner access is required");
  }

  return ownerProfileId;
}

export function requireTenantId(tenantId?: string) {
  if (!tenantId) {
    throw new AppError(403, "AUTH_FORBIDDEN", "Tenant access is required");
  }

  return tenantId;
}
