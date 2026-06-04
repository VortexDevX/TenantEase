import { AppError } from "./errors.js";
import { prisma } from "./db.js";
import type { FastifyRequest } from "fastify";

type StaffRole = "MANAGER" | "ACCOUNTANT" | "WARDEN";

export type StaffPermission =
  | "property:read"
  | "room:read"
  | "room:write"
  | "tenant:read"
  | "tenant:write"
  | "rent:read"
  | "rent:write"
  | "payment:read"
  | "payment:write"
  | "receipt:read"
  | "receipt:write"
  | "maintenance:read"
  | "maintenance:write"
  | "report:read";

const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<StaffPermission>> = {
  MANAGER: new Set([
    "property:read",
    "room:read",
    "room:write",
    "tenant:read",
    "tenant:write",
    "rent:read",
    "rent:write",
    "payment:read",
    "payment:write",
    "maintenance:read",
    "maintenance:write"
  ]),
  ACCOUNTANT: new Set([
    "property:read",
    "room:read",
    "tenant:read",
    "rent:read",
    "payment:read",
    "payment:write",
    "receipt:read",
    "receipt:write",
    "report:read"
  ]),
  WARDEN: new Set([
    "property:read",
    "room:read",
    "room:write",
    "tenant:read",
    "tenant:write",
    "maintenance:read",
    "maintenance:write"
  ])
};

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

export async function assertPropertyAccess(
  request: FastifyRequest,
  propertyId: string,
  permission: StaffPermission
) {
  if (request.user.role === "OWNER") {
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ownerProfileId },
      select: { id: true, ownerProfileId: true }
    });

    if (!property) {
      throw new AppError(404, "PROPERTY_NOT_FOUND", "Property not found");
    }

    return { ownerProfileId, propertyId: property.id, staffRole: null };
  }

  if (request.user.role !== "STAFF") {
    throw new AppError(403, "AUTH_FORBIDDEN", "Owner or staff access is required");
  }

  const assignment = await prisma.staffAssignment.findFirst({
    where: {
      userId: request.user.sub,
      propertyId,
      isActive: true,
      inviteStatus: "ACCEPTED"
    },
    include: {
      property: {
        select: {
          id: true,
          ownerProfileId: true
        }
      }
    }
  });

  if (!assignment) {
    throw new AppError(403, "AUTH_STAFF_NO_PERMISSION", "Staff member is not assigned to this property");
  }

  if (!ROLE_PERMISSIONS[assignment.role].has(permission)) {
    throw new AppError(403, "AUTH_STAFF_NO_PERMISSION", "Staff role does not allow this action");
  }

  return {
    ownerProfileId: assignment.property.ownerProfileId,
    propertyId: assignment.property.id,
    staffRole: assignment.role
  };
}

export async function assertRoomAccess(request: FastifyRequest, roomId: string, permission: StaffPermission) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, propertyId: true }
  });

  if (!room) {
    throw new AppError(404, "ROOM_NOT_FOUND", "Room not found");
  }

  const access = await assertPropertyAccess(request, room.propertyId, permission);
  return { room, ...access };
}

export async function assertTenantAccess(request: FastifyRequest, tenantId: string, permission: StaffPermission) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, propertyId: true, roomId: true }
  });

  if (!tenant) {
    throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");
  }

  const access = await assertPropertyAccess(request, tenant.propertyId, permission);
  return { tenant, ...access };
}

export async function assertRentEntryAccess(request: FastifyRequest, rentEntryId: string, permission: StaffPermission) {
  const rentEntry = await prisma.rentEntry.findUnique({
    where: { id: rentEntryId },
    select: {
      id: true,
      tenant: {
        select: {
          propertyId: true
        }
      }
    }
  });

  if (!rentEntry) {
    throw new AppError(404, "RENT_ENTRY_NOT_FOUND", "Rent entry not found");
  }

  const access = await assertPropertyAccess(request, rentEntry.tenant.propertyId, permission);
  return { rentEntry, ...access };
}

export async function assertPaymentAccess(request: FastifyRequest, paymentId: string, permission: StaffPermission) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      rentEntry: {
        select: {
          tenant: {
            select: {
              propertyId: true
            }
          }
        }
      }
    }
  });

  if (!payment) {
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  }

  const access = await assertPropertyAccess(request, payment.rentEntry.tenant.propertyId, permission);
  return { payment, ...access };
}

export async function assertReceiptAccess(request: FastifyRequest, receiptId: string, permission: StaffPermission) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    select: {
      id: true,
      payment: {
        select: {
          rentEntry: {
            select: {
              tenant: {
                select: {
                  propertyId: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!receipt) {
    throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found");
  }

  const access = await assertPropertyAccess(request, receipt.payment.rentEntry.tenant.propertyId, permission);
  return { receipt, ...access };
}

export async function assertMaintenanceAccess(
  request: FastifyRequest,
  maintenanceRequestId: string,
  permission: StaffPermission
) {
  const maintenanceRequest = await prisma.maintenanceRequest.findUnique({
    where: { id: maintenanceRequestId },
    select: { id: true, propertyId: true }
  });

  if (!maintenanceRequest) {
    throw new AppError(404, "REQUEST_NOT_FOUND", "Maintenance request not found");
  }

  const access = await assertPropertyAccess(request, maintenanceRequest.propertyId, permission);
  return { maintenanceRequest, ...access };
}
