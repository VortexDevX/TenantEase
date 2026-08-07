import { createHmac, timingSafeEqual } from "node:crypto";
import type { SubscriptionPlan } from "@tenantease/types";
import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
};

type CreateOrderInput = {
  amount: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
};

export type CreatedRazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  createdAt: Date;
  raw: unknown;
};

export type CreatedRazorpaySubscription = {
  id: string;
  status: string;
  shortUrl: string | null;
  currentStart: Date | null;
  currentEnd: Date | null;
  raw: unknown;
};

function hasLiveCredentials() {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

export function getRazorpayCheckoutKeyId() {
  return env.RAZORPAY_KEY_ID ?? "mock_razorpay_key";
}

function razorpayAuthHeader() {
  return `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;
}

function planIdFor(plan: Exclude<SubscriptionPlan, "FREE">) {
  const planIds: Record<Exclude<SubscriptionPlan, "FREE">, string | undefined> = {
    STARTER: env.RAZORPAY_PLAN_STARTER_ID,
    PRO: env.RAZORPAY_PLAN_PRO_ID,
    BUSINESS: env.RAZORPAY_PLAN_BUSINESS_ID
  };
  return planIds[plan];
}

function getWebhookSecret() {
  if (env.RAZORPAY_WEBHOOK_SECRET) {
    return env.RAZORPAY_WEBHOOK_SECRET;
  }

  if (env.NODE_ENV === "production") {
    throw new AppError(500, "CONFIG_ERROR", "RAZORPAY_WEBHOOK_SECRET is required in production");
  }

  return "mock_razorpay_webhook_secret";
}

export function createRazorpayWebhookSignature(body: string) {
  return createHmac("sha256", getWebhookSecret()).update(body).digest("hex");
}

export function verifyRazorpayWebhookSignature(body: string, signature: string | undefined) {
  if (!signature) {
    throw new AppError(401, "ONLINE_PAYMENT_SIGNATURE_INVALID", "Missing Razorpay webhook signature");
  }

  const expected = createRazorpayWebhookSignature(body);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new AppError(401, "ONLINE_PAYMENT_SIGNATURE_INVALID", "Invalid Razorpay webhook signature");
  }
}

export async function createRazorpayOrder(input: CreateOrderInput): Promise<CreatedRazorpayOrder> {
  if (!hasLiveCredentials()) {
    const createdAt = new Date();
    const id = `order_mock_${input.receipt.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
    return {
      id,
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt,
      status: "created",
      createdAt,
      raw: {
        id,
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt,
        status: "created",
        notes: input.notes,
        created_at: Math.floor(createdAt.getTime() / 1000)
      }
    };
  }

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: razorpayAuthHeader(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(10_000)
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AppError(502, "CONFIG_ERROR", "Razorpay order creation failed", json);
  }

  const order = json as RazorpayOrderResponse;
  return {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    receipt: order.receipt,
    status: order.status,
    createdAt: new Date(order.created_at * 1000),
    raw: order
  };
}

export async function createRazorpaySubscription(input: {
  plan: Exclude<SubscriptionPlan, "FREE">;
  ownerProfileId: string;
  totalCount?: number;
}): Promise<CreatedRazorpaySubscription> {
  const now = new Date();
  if (!hasLiveCredentials()) {
    const id = `sub_mock_${input.ownerProfileId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20)}_${Date.now().toString(36)}`;
    return {
      id,
      status: "created",
      shortUrl: `https://rzp.io/i/mock-${id.slice(-10)}`,
      currentStart: null,
      currentEnd: null,
      raw: {
        id,
        entity: "subscription",
        plan_id: `plan_mock_${input.plan.toLowerCase()}`,
        status: "created",
        short_url: `https://rzp.io/i/mock-${id.slice(-10)}`,
        customer_notify: true,
        total_count: input.totalCount ?? 120,
        created_at: Math.floor(now.getTime() / 1000),
        notes: {
          ownerProfileId: input.ownerProfileId,
          plan: input.plan
        }
      }
    };
  }

  const planId = planIdFor(input.plan);
  if (!planId) {
    throw new AppError(500, "CONFIG_ERROR", `Razorpay plan ID is not configured for ${input.plan}`);
  }

  const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: razorpayAuthHeader(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      plan_id: planId,
      total_count: input.totalCount ?? 120,
      quantity: 1,
      customer_notify: true,
      expire_by: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000),
      notes: {
        ownerProfileId: input.ownerProfileId,
        plan: input.plan
      }
    }),
    signal: AbortSignal.timeout(10_000)
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AppError(502, "CONFIG_ERROR", "Razorpay subscription creation failed", json);
  }

  const subscription = json as {
    id: string;
    status: string;
    short_url?: string | null;
    current_start?: number | null;
    current_end?: number | null;
  };

  return {
    id: subscription.id,
    status: subscription.status,
    shortUrl: subscription.short_url ?? null,
    currentStart: subscription.current_start ? new Date(subscription.current_start * 1000) : null,
    currentEnd: subscription.current_end ? new Date(subscription.current_end * 1000) : null,
    raw: json
  };
}

export async function cancelRazorpaySubscription(input: {
  providerSubscriptionId: string;
  cancelAtCycleEnd: boolean;
}) {
  if (!hasLiveCredentials()) {
    return {
      id: input.providerSubscriptionId,
      status: input.cancelAtCycleEnd ? "active" : "cancelled",
      raw: {
        id: input.providerSubscriptionId,
        entity: "subscription",
        status: input.cancelAtCycleEnd ? "active" : "cancelled",
        cancel_at_cycle_end: input.cancelAtCycleEnd
      }
    };
  }

  const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${input.providerSubscriptionId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: razorpayAuthHeader(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      cancel_at_cycle_end: input.cancelAtCycleEnd
    }),
    signal: AbortSignal.timeout(10_000)
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AppError(502, "CONFIG_ERROR", "Razorpay subscription cancellation failed", json);
  }

  return {
    id: (json as { id?: string })?.id ?? input.providerSubscriptionId,
    status: (json as { status?: string })?.status ?? "cancelled",
    raw: json
  };
}
