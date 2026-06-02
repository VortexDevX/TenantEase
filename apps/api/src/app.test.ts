import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./lib/db.js";

const app = createApp();
const createdPhones = new Set<string>();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  if (createdPhones.size > 0) {
    await prisma.user.deleteMany({
      where: {
        phone: {
          in: Array.from(createdPhones)
        }
      }
    });
  }
  await app.close();
});

describe("api app", () => {
  it("should return health status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "healthy"
    });
  });

  it("should reject protected routes without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/auth/me"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "AUTH_INVALID_TOKEN"
      }
    });
  });

  it("should reject phase 2 owner routes without auth", async () => {
    const protectedRoutes = [
      { method: "GET" as const, url: "/properties/00000000-0000-0000-0000-000000000000/reports/monthly" },
      { method: "POST" as const, url: "/properties/00000000-0000-0000-0000-000000000000/receipts/bulk" },
      { method: "GET" as const, url: "/properties/00000000-0000-0000-0000-000000000000/receipts/annual" },
      { method: "POST" as const, url: "/properties/00000000-0000-0000-0000-000000000000/late-fees/apply" },
      { method: "GET" as const, url: "/properties/00000000-0000-0000-0000-000000000000/utilities" },
      { method: "POST" as const, url: "/properties/00000000-0000-0000-0000-000000000000/utilities" },
      { method: "POST" as const, url: "/tenants/00000000-0000-0000-0000-000000000000/agreements" },
      { method: "GET" as const, url: "/tenants/00000000-0000-0000-0000-000000000000/agreements" },
      { method: "GET" as const, url: "/agreements/00000000-0000-0000-0000-000000000000/download" }
    ];

    for (const route of protectedRoutes) {
      const response = await app.inject({
        method: route.method,
        url: route.url,
        payload: route.method === "POST" ? {} : undefined
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        success: false,
        error: {
          code: "AUTH_INVALID_TOKEN"
        }
      });
    }
  });

  it("should reject cron and system routes without service secret", async () => {
    const protectedRoutes = [
      { method: "POST" as const, url: "/cron/reminders" },
      { method: "POST" as const, url: "/system/sync-occupancy" }
    ];

    for (const route of protectedRoutes) {
      const response = await app.inject({
        method: route.method,
        url: route.url
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        success: false,
        error: {
          code: "AUTH_FORBIDDEN"
        }
      });
    }
  });

  it("should reject OTP requests for blocked users", async () => {
    const phone = "9111111111";

    await prisma.user.create({
      data: {
        phone,
        role: "OWNER",
        isBlocked: true,
        ownerProfile: {
          create: {}
        }
      }
    });
    createdPhones.add(phone);

    const response = await app.inject({
      method: "POST",
      url: "/auth/send-otp",
      payload: { phone }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "AUTH_FORBIDDEN"
      }
    });
  });
});
