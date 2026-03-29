import { prisma } from "../../lib/db.js";

type AuditInput = {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  payload?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function createAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      payloadJson: input.payload as object | undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null
    }
  });
}

