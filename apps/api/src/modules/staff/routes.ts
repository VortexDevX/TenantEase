import type { FastifyInstance } from "fastify";
import type { StaffAssignmentDto } from "@tenantease/types";
import { z } from "zod";
import { requireOwnerProfileId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { assertPropertyOwnership } from "../common/owner.js";
import { uuidSchema } from "../common/schemas.js";
import { createAuditLog } from "../common/audit.js";
import { assertCanInviteStaff } from "../subscriptions/service.js";

const staffRoleSchema = z.enum(["MANAGER", "ACCOUNTANT", "WARDEN"]);

const inviteStaffSchema = z.object({
  propertyId: uuidSchema,
  phone: z.string().regex(/^\d{10}$/),
  email: z.string().email().optional().nullable(),
  role: staffRoleSchema
});

const updateStaffSchema = z.object({
  role: staffRoleSchema
});

function toStaffDto(input: {
  id: string;
  userId: string;
  propertyId: string;
  role: "MANAGER" | "ACCOUNTANT" | "WARDEN";
  inviteStatus: "PENDING" | "ACCEPTED" | "REVOKED";
  invitePhone: string;
  inviteEmail: string | null;
  invitedAt: Date;
  acceptedAt: Date | null;
  isActive: boolean;
  deactivatedAt: Date | null;
  property: { name: string };
}): StaffAssignmentDto {
  return {
    id: input.id,
    userId: input.userId,
    propertyId: input.propertyId,
    propertyName: input.property.name,
    phone: input.invitePhone,
    email: input.inviteEmail,
    role: input.role,
    inviteStatus: input.inviteStatus,
    isActive: input.isActive,
    invitedAt: input.invitedAt.toISOString(),
    acceptedAt: input.acceptedAt?.toISOString() ?? null,
    deactivatedAt: input.deactivatedAt?.toISOString() ?? null
  };
}

async function assertStaffAssignmentOwnership(staffAssignmentId: string, ownerProfileId: string) {
  const assignment = await prisma.staffAssignment.findFirst({
    where: {
      id: staffAssignmentId,
      property: { ownerProfileId }
    },
    include: {
      property: { select: { name: true } }
    }
  });

  if (!assignment) {
    throw new AppError(404, "STAFF_ASSIGNMENT_NOT_FOUND", "Staff assignment not found");
  }

  return assignment;
}

export async function staffRoutes(app: FastifyInstance) {
  app.get("/staff", { preHandler: [app.authenticate] }, async (request) => {
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    const assignments = await prisma.staffAssignment.findMany({
      where: {
        property: { ownerProfileId }
      },
      include: {
        property: { select: { name: true } }
      },
      orderBy: [{ isActive: "desc" }, { invitedAt: "desc" }]
    });

    return ok(assignments.map(toStaffDto));
  });

  app.post("/staff/invite", { preHandler: [app.authenticate] }, async (request) => {
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    const body = inviteStaffSchema.parse(request.body);
    const property = await assertPropertyOwnership(body.propertyId, ownerProfileId);

    const result = await prisma.$transaction(async (tx) => {
      await assertCanInviteStaff(ownerProfileId, tx);

      const activeTenant = await tx.tenant.findFirst({
        where: {
          phone: body.phone,
          status: { in: ["ACTIVE", "NOTICE"] }
        },
        select: { id: true }
      });

      if (activeTenant) {
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "This phone is linked to an active tenant. Use a different staff phone for now."
        );
      }

      const existingUser = await tx.user.findUnique({
        where: { phone: body.phone }
      });

      if (existingUser?.role === "ADMIN" || existingUser?.role === "OWNER") {
        throw new AppError(422, "VALIDATION_ERROR", "Admin and owner accounts cannot be invited as staff");
      }

      const staffUser = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: { role: "STAFF" }
          })
        : await tx.user.create({
            data: {
              phone: body.phone,
              role: "STAFF"
            }
          });

      const existingAssignment = await tx.staffAssignment.findUnique({
        where: {
          userId_propertyId: {
            userId: staffUser.id,
            propertyId: body.propertyId
          }
        }
      });

      if (existingAssignment?.isActive && existingAssignment.inviteStatus !== "REVOKED") {
        throw new AppError(422, "VALIDATION_ERROR", "This staff member is already assigned to this property");
      }

      return existingAssignment
        ? tx.staffAssignment.update({
            where: { id: existingAssignment.id },
            data: {
              role: body.role,
              inviteStatus: "PENDING",
              invitePhone: body.phone,
              inviteEmail: body.email ?? null,
              invitedByUserId: request.user.sub,
              invitedAt: new Date(),
              acceptedAt: null,
              isActive: true,
              deactivatedAt: null
            },
            include: { property: { select: { name: true } } }
          })
        : tx.staffAssignment.create({
            data: {
              userId: staffUser.id,
              propertyId: body.propertyId,
              invitedByUserId: request.user.sub,
              role: body.role,
              invitePhone: body.phone,
              inviteEmail: body.email ?? null
            },
            include: { property: { select: { name: true } } }
          });
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "staff.invite",
      resource: "StaffAssignment",
      resourceId: result.id,
      payload: { propertyId: property.id, phone: body.phone, role: body.role },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(toStaffDto(result));
  });

  app.put("/staff/:staffAssignmentId", { preHandler: [app.authenticate] }, async (request) => {
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    const params = z.object({ staffAssignmentId: uuidSchema }).parse(request.params);
    const body = updateStaffSchema.parse(request.body);
    const current = await assertStaffAssignmentOwnership(params.staffAssignmentId, ownerProfileId);

    if (!current.isActive || current.inviteStatus === "REVOKED") {
      throw new AppError(422, "VALIDATION_ERROR", "Revoked staff assignments cannot be updated");
    }

    const updated = await prisma.staffAssignment.update({
      where: { id: current.id },
      data: { role: body.role },
      include: { property: { select: { name: true } } }
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "staff.update_role",
      resource: "StaffAssignment",
      resourceId: current.id,
      payload: { previousRole: current.role, nextRole: body.role },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(toStaffDto(updated));
  });

  app.delete("/staff/:staffAssignmentId", { preHandler: [app.authenticate] }, async (request) => {
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    const params = z.object({ staffAssignmentId: uuidSchema }).parse(request.params);
    const current = await assertStaffAssignmentOwnership(params.staffAssignmentId, ownerProfileId);

    if (!current.isActive && current.inviteStatus === "REVOKED") {
      return ok(toStaffDto(current));
    }

    const updated = await prisma.staffAssignment.update({
      where: { id: current.id },
      data: {
        inviteStatus: "REVOKED",
        isActive: false,
        deactivatedAt: new Date()
      },
      include: { property: { select: { name: true } } }
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "staff.remove",
      resource: "StaffAssignment",
      resourceId: current.id,
      payload: { phone: current.invitePhone, propertyId: current.propertyId },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(toStaffDto(updated));
  });
}
