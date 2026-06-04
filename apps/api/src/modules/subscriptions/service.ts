import type { Prisma, Subscription } from "@prisma/client";
import type { InvoiceDto, SubscriptionDto, SubscriptionPlan, SubscriptionPlanDto } from "@tenantease/types";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

const PLAN_DEFINITIONS: Record<SubscriptionPlan, Omit<SubscriptionPlanDto, "plan">> = {
  FREE: {
    label: "Free",
    priceMonthly: 0,
    maxProperties: 1,
    maxStaffAccounts: 0,
    smsEnabled: false,
    whatsappEnabled: false,
    emailEnabled: true,
    onlinePaymentsEnabled: false,
    recommended: false
  },
  STARTER: {
    label: "Starter",
    priceMonthly: 49900,
    maxProperties: 1,
    maxStaffAccounts: 1,
    smsEnabled: true,
    whatsappEnabled: false,
    emailEnabled: true,
    onlinePaymentsEnabled: false,
    recommended: false
  },
  PRO: {
    label: "Pro",
    priceMonthly: 99900,
    maxProperties: 3,
    maxStaffAccounts: 3,
    smsEnabled: true,
    whatsappEnabled: false,
    emailEnabled: true,
    onlinePaymentsEnabled: true,
    recommended: true
  },
  BUSINESS: {
    label: "Business",
    priceMonthly: 199900,
    maxProperties: 999,
    maxStaffAccounts: 10,
    smsEnabled: true,
    whatsappEnabled: true,
    emailEnabled: true,
    onlinePaymentsEnabled: true,
    recommended: false
  }
};

function planData(plan: SubscriptionPlan) {
  const definition = PLAN_DEFINITIONS[plan];
  return {
    plan,
    maxProperties: definition.maxProperties,
    maxStaffAccounts: definition.maxStaffAccounts,
    smsEnabled: definition.smsEnabled,
    whatsappEnabled: definition.whatsappEnabled,
    emailEnabled: definition.emailEnabled,
    onlinePaymentsEnabled: definition.onlinePaymentsEnabled
  };
}

export function listSubscriptionPlans(): SubscriptionPlanDto[] {
  return (Object.entries(PLAN_DEFINITIONS) as Array<[SubscriptionPlan, Omit<SubscriptionPlanDto, "plan">]>).map(
    ([plan, definition]) => ({
      plan,
      ...definition
    })
  );
}

export async function ensureSubscription(ownerProfileId: string, db: DbClient = prisma) {
  const existing = await db.subscription.findUnique({
    where: { ownerProfileId }
  });

  if (existing) {
    return existing;
  }

  return db.subscription.create({
    data: {
      ownerProfileId,
      ...planData("FREE")
    }
  });
}

export function toSubscriptionDto(subscription: Subscription, propertyCount: number, staffCount: number): SubscriptionDto {
  return {
    id: subscription.id,
    ownerProfileId: subscription.ownerProfileId,
    plan: subscription.plan,
    status: subscription.status,
    maxProperties: subscription.maxProperties,
    maxStaffAccounts: subscription.maxStaffAccounts,
    smsEnabled: subscription.smsEnabled,
    whatsappEnabled: subscription.whatsappEnabled,
    emailEnabled: subscription.emailEnabled,
    onlinePaymentsEnabled: subscription.onlinePaymentsEnabled,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    usage: {
      properties: propertyCount,
      staffAccounts: staffCount
    }
  };
}

export function toInvoiceDto(input: {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: "PENDING" | "PAID" | "FAILED" | "VOID";
  paidAt: Date | null;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}): InvoiceDto {
  return {
    id: input.id,
    invoiceNumber: input.invoiceNumber,
    amount: input.amount,
    status: input.status,
    paidAt: input.paidAt?.toISOString() ?? null,
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    createdAt: input.createdAt.toISOString()
  };
}

export async function getSubscriptionOverview(ownerProfileId: string) {
  const subscription = await ensureSubscription(ownerProfileId);
  const [propertyCount, staffCount] = await Promise.all([
    prisma.property.count({
      where: { ownerProfileId }
    }),
    prisma.staffAssignment.count({
      where: {
        isActive: true,
        inviteStatus: { not: "REVOKED" },
        property: { ownerProfileId }
      }
    })
  ]);

  return toSubscriptionDto(subscription, propertyCount, staffCount);
}

export async function assertCanCreateProperty(ownerProfileId: string, db: DbClient = prisma) {
  const subscription = await ensureSubscription(ownerProfileId, db);

  if (subscription.status !== "ACTIVE") {
    throw new AppError(402, "SUBSCRIPTION_INACTIVE", "Subscription is not active");
  }

  const propertyCount = await db.property.count({
    where: { ownerProfileId }
  });

  if (propertyCount >= subscription.maxProperties) {
    throw new AppError(402, "PLAN_LIMIT_PROPERTIES", "Current plan does not allow more properties", {
      plan: subscription.plan,
      maxProperties: subscription.maxProperties,
      usage: {
        properties: propertyCount
      }
    });
  }
}

export async function assertCanInviteStaff(ownerProfileId: string, db: DbClient = prisma) {
  const subscription = await ensureSubscription(ownerProfileId, db);

  if (subscription.status !== "ACTIVE") {
    throw new AppError(402, "SUBSCRIPTION_INACTIVE", "Subscription is not active");
  }

  const staffCount = await db.staffAssignment.count({
    where: {
      isActive: true,
      inviteStatus: { not: "REVOKED" },
      property: { ownerProfileId }
    }
  });

  if (staffCount >= subscription.maxStaffAccounts) {
    throw new AppError(402, "PLAN_LIMIT_STAFF", "Current plan does not allow more staff accounts", {
      plan: subscription.plan,
      maxStaffAccounts: subscription.maxStaffAccounts,
      usage: {
        staffAccounts: staffCount
      }
    });
  }
}
