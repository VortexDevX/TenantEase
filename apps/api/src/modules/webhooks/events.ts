import { createHash } from "node:crypto";
import type { Prisma, WebhookEventStatus } from "@prisma/client";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";

function asJson(input: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue;
}

function hashPayload(rawBody: string) {
  return createHash("sha256").update(rawBody).digest("hex");
}

export async function beginWebhookEvent(input: {
  provider: string;
  eventId: string | undefined;
  eventType: string;
  rawBody: string;
  payload: unknown;
}) {
  if (!input.eventId) {
    throw new AppError(400, "VALIDATION_ERROR", "Webhook event id header is required");
  }

  const payloadHash = hashPayload(input.rawBody);

  try {
    const event = await prisma.webhookEvent.create({
      data: {
        provider: input.provider,
        eventId: input.eventId,
        eventType: input.eventType,
        payloadHash,
        payload: asJson(input.payload)
      }
    });
    return { event, duplicate: false };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const existing = await prisma.webhookEvent.findUnique({
        where: {
          provider_eventId: {
            provider: input.provider,
            eventId: input.eventId
          }
        }
      });

      if (!existing) {
        throw error;
      }

      if (existing.payloadHash !== payloadHash) {
        throw new AppError(409, "VALIDATION_ERROR", "Webhook event id was reused with a different payload");
      }

      if (existing.status === "PROCESSED" || existing.status === "IGNORED") {
        return { event: existing, duplicate: true };
      }

      const staleReceived = existing.status === "RECEIVED"
        && Date.now() - existing.receivedAt.getTime() >= 5 * 60 * 1000;
      if (existing.status === "RECEIVED" && !staleReceived) {
        return { event: existing, duplicate: true };
      }

      const claimed = await prisma.webhookEvent.updateMany({
        where: {
          id: existing.id,
          status: existing.status,
          receivedAt: existing.receivedAt
        },
        data: {
          status: "RECEIVED",
          error: null,
          processedAt: null,
          receivedAt: new Date()
        }
      });

      if (claimed.count === 0) {
        return { event: existing, duplicate: true };
      }

      const reclaimed = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: existing.id } });
      return { event: reclaimed, duplicate: false };
    }

    throw error;
  }
}

export async function finishWebhookEvent(input: {
  id: string;
  status: Exclude<WebhookEventStatus, "RECEIVED">;
  resourceType?: string | null;
  resourceId?: string | null;
  error?: string | null;
}) {
  return prisma.webhookEvent.update({
    where: { id: input.id },
    data: {
      status: input.status,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      error: input.error ?? null,
      processedAt: new Date()
    }
  });
}
