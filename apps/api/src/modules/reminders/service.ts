import type { ReminderConfig, RentEntry, Tenant } from "@prisma/client";
import { prisma } from "../../lib/db.js";
import { notificationProvider, type NotificationChannel } from "../../providers/notification-provider.js";
import { ensureSubscription } from "../subscriptions/service.js";
import { AppError } from "../../lib/errors.js";

export type ReminderMode = "PRE_DUE" | "ON_DUE" | "OVERDUE";

export type SendDueRemindersInput = {
  propertyId: string;
  mode?: ReminderMode;
  billingMonth?: string;
  today?: Date;
};

type ReminderEntry = RentEntry & { tenant: Tenant };

function daysBetween(a: Date, b: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const end = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((start - end) / msPerDay);
}

function render(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{{${key}}}`, String(value)),
    template
  );
}

function enabledChannels(config: ReminderConfig, subscription: Awaited<ReturnType<typeof ensureSubscription>>): NotificationChannel[] {
  const active = subscription.status === "ACTIVE";
  return [
    ...(config.inAppEnabled ? ["IN_APP" as const] : []),
    ...(active && subscription.smsEnabled && config.smsEnabled ? ["SMS" as const] : []),
    ...(active && subscription.whatsappEnabled && config.whatsappEnabled ? ["WHATSAPP" as const] : []),
    ...(active && subscription.emailEnabled && config.emailEnabled ? ["EMAIL" as const] : [])
  ];
}

function requestedModeMatches(mode: ReminderMode, daysFromDue: number, config: ReminderConfig) {
  if (mode === "PRE_DUE") return daysFromDue === config.preDueDays;
  if (mode === "ON_DUE") return config.onDueEnabled && daysFromDue === 0;
  return daysFromDue < 0;
}

function resolveReminderMode(inputMode: ReminderMode | undefined, daysFromDue: number, config: ReminderConfig) {
  if (!inputMode) {
    return modeForEntry(daysFromDue, config);
  }

  return requestedModeMatches(inputMode, daysFromDue, config) ? inputMode : null;
}

function reminderMessage(entry: ReminderEntry, config: ReminderConfig, mode: ReminderMode, daysFromDue: number) {
  const pending = entry.amountDue - entry.amountPaid;
  const daysLate = Math.max(0, -daysFromDue);
  const template = mode === "OVERDUE" ? config.overdueTemplate : config.friendlyTemplate;

  return render(template, {
    name: entry.tenant.fullName,
    month: entry.billingMonth,
    date: entry.dueDate.toISOString().slice(0, 10),
    days: daysLate,
    amount: pending / 100
  });
}

async function createInAppReminder(entry: ReminderEntry, propertyId: string, mode: ReminderMode, message: string) {
  await prisma.notification.create({
    data: {
      tenantId: entry.tenant.id,
      propertyId,
      title: mode === "OVERDUE" ? "Rent overdue" : "Rent reminder",
      content: message,
      category: "RENT"
    }
  });
}

async function sendReminderChannel(input: {
  entry: ReminderEntry;
  propertyId: string;
  mode: ReminderMode;
  channel: NotificationChannel;
  message: string;
}) {
  if (input.channel === "IN_APP") {
    await createInAppReminder(input.entry, input.propertyId, input.mode, input.message);
    return;
  }

  await notificationProvider.send(
    input.channel,
    { phone: input.entry.tenant.phone, email: input.entry.tenant.email },
    input.message
  );
}

async function sendAndLogReminder(input: {
  entry: ReminderEntry;
  propertyId: string;
  mode: ReminderMode;
  channel: NotificationChannel;
  message: string;
  scheduleDate: string;
}) {
  const dedupeKey = `${input.entry.id}:${input.mode}:${input.channel}:${input.scheduleDate}`;
  let log: { id: string };
  try {
    log = await prisma.reminderLog.create({
      data: {
        propertyId: input.propertyId,
        tenantId: input.entry.tenant.id,
        rentEntryId: input.entry.id,
        channel: input.channel,
        status: "PENDING",
        message: input.message,
        dedupeKey
      },
      select: { id: true }
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return false;
    }
    throw error;
  }

  try {
    await sendReminderChannel(input);
    await prisma.reminderLog.update({
      where: { id: log.id },
      data: { status: "SENT", error: null }
    });
    return true;
  } catch (error) {
    await prisma.reminderLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown error"
      }
    });
    return false;
  }
}

async function markOverdue(entry: ReminderEntry, mode: ReminderMode) {
  if (mode !== "OVERDUE" || entry.status === "OVERDUE") {
    return;
  }

  await prisma.rentEntry.update({
    where: { id: entry.id },
    data: { status: "OVERDUE" }
  });
}

export async function sendDueReminders(input: SendDueRemindersInput) {
  const property = await prisma.property.findUnique({
    where: { id: input.propertyId },
    select: { ownerProfileId: true }
  });
  if (!property) {
    throw new AppError(404, "PROPERTY_NOT_FOUND", "Property not found for reminder send");
  }
  const subscription = await ensureSubscription(property.ownerProfileId);
  const config = await prisma.reminderConfig.upsert({
    where: { propertyId: input.propertyId },
    update: {},
    create: { propertyId: input.propertyId }
  });

  const today = input.today ?? new Date();
  const entries = await prisma.rentEntry.findMany({
    where: {
      ...(input.billingMonth ? { billingMonth: input.billingMonth } : {}),
      status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
      tenant: {
        propertyId: input.propertyId,
        status: "ACTIVE"
      }
    },
    include: {
      tenant: true
    }
  });

  const channels = enabledChannels(config, subscription);
  notificationProvider.assertConfigured(channels);

  let sentCount = 0;
  let eligibleCount = 0;
  const scheduleDate = today.toISOString().slice(0, 10);

  for (const entry of entries) {
    const daysFromDue = daysBetween(entry.dueDate, today);
    const mode = resolveReminderMode(input.mode, daysFromDue, config);
    if (!mode) continue;

    eligibleCount++;
    const message = reminderMessage(entry, config, mode, daysFromDue);

    for (const channel of channels) {
      const sent = await sendAndLogReminder({
        entry,
        propertyId: input.propertyId,
        mode,
        channel,
        message,
        scheduleDate
      });
      if (sent) {
        sentCount++;
      }
    }

    await markOverdue(entry, mode);
  }

  return { sentCount, eligibleCount };
}

function modeForEntry(daysFromDue: number, config: ReminderConfig): ReminderMode | null {
  if (daysFromDue === config.preDueDays) return "PRE_DUE";
  if (config.onDueEnabled && daysFromDue === 0) return "ON_DUE";
  if (daysFromDue < 0 && (config.overdueFrequency === "DAILY" || (-daysFromDue) % 7 === 0)) return "OVERDUE";
  return null;
}
