import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./lib/db.js";

const app = createApp();
const createdPhones = new Set<string>();

function adminToken(userId: string, phone: string) {
  return app.jwt.sign({
    sub: userId,
    phone,
    role: "ADMIN"
  });
}

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  if (createdPhones.size > 0) {
    await prisma.otpChallenge.deleteMany({
      where: {
        phone: {
          in: Array.from(createdPhones)
        }
      }
    });
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
      { method: "GET" as const, url: "/subscription" },
      { method: "GET" as const, url: "/subscription/invoices" },
      { method: "GET" as const, url: "/properties/00000000-0000-0000-0000-000000000000/settings" },
      { method: "PUT" as const, url: "/properties/00000000-0000-0000-0000-000000000000/settings" },
      { method: "GET" as const, url: "/properties/00000000-0000-0000-0000-000000000000/reminders/config" },
      { method: "PUT" as const, url: "/properties/00000000-0000-0000-0000-000000000000/reminders/config" },
      { method: "POST" as const, url: "/properties/00000000-0000-0000-0000-000000000000/reminders/send" },
      { method: "GET" as const, url: "/properties/00000000-0000-0000-0000-000000000000/reminders/logs" },
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

  it("should rate limit repeated OTP requests for the same phone", async () => {
    const phone = "9111111120";
    createdPhones.add(phone);

    const firstResponse = await app.inject({
      method: "POST",
      url: "/auth/send-otp",
      payload: { phone }
    });
    const secondResponse = await app.inject({
      method: "POST",
      url: "/auth/send-otp",
      payload: { phone }
    });

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(429);
    expect(secondResponse.json()).toMatchObject({
      success: false,
      error: {
        code: "RATE_LIMITED"
      }
    });
  });

  it("should create fresh registrations as tenants by default", async () => {
    const phone = "9111111119";
    createdPhones.add(phone);

    const sendResponse = await app.inject({
      method: "POST",
      url: "/auth/send-otp",
      payload: { phone }
    });
    const sendBody = sendResponse.json() as { data: { challengeId: string; debugOtp?: string } };

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/auth/verify-otp",
      payload: {
        phone,
        otp: sendBody.data.debugOtp,
        challengeId: sendBody.data.challengeId
      }
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json()).toMatchObject({
      success: true,
      data: {
        user: {
          phone,
          role: "TENANT"
        },
        isNewUser: true
      }
    });

    await expect(
      prisma.user.findUnique({
        where: { phone },
        include: { ownerProfile: true }
      })
    ).resolves.toMatchObject({
      role: "TENANT",
      ownerProfile: null
    });
  });

  it("should block admin deletion of users with linked business data", async () => {
    const adminPhone = "9111111112";
    const ownerPhone = "9111111113";
    createdPhones.add(adminPhone);
    createdPhones.add(ownerPhone);

    const admin = await prisma.user.create({
      data: {
        phone: adminPhone,
        role: "ADMIN"
      }
    });
    const owner = await prisma.user.create({
      data: {
        phone: ownerPhone,
        role: "OWNER",
        ownerProfile: {
          create: {
            properties: {
              create: {
                name: "Delete Block PG",
                address: "1 Test Street",
                city: "Bengaluru",
                state: "Karnataka",
                pinCode: "560001",
                type: "PG"
              }
            }
          }
        }
      }
    });

    const response = await app.inject({
      method: "DELETE",
      url: `/admin/users/${owner.id}`,
      headers: { authorization: `Bearer ${adminToken(admin.id, adminPhone)}` }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "USER_HAS_BUSINESS_DATA"
      }
    });
  });

  it("should protect admin accounts from peer admin role, block, and delete actions", async () => {
    const actorPhone = "9111111116";
    const targetPhone = "9111111117";
    createdPhones.add(actorPhone);
    createdPhones.add(targetPhone);

    const actor = await prisma.user.create({
      data: {
        phone: actorPhone,
        role: "ADMIN"
      }
    });
    const target = await prisma.user.create({
      data: {
        phone: targetPhone,
        role: "ADMIN"
      }
    });
    const headers = { authorization: `Bearer ${adminToken(actor.id, actorPhone)}` };

    const roleResponse = await app.inject({
      method: "PUT",
      url: `/admin/users/${target.id}/role`,
      headers,
      payload: { role: "TENANT" }
    });
    const blockResponse = await app.inject({
      method: "POST",
      url: `/admin/users/${target.id}/block`,
      headers
    });
    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/admin/users/${target.id}`,
      headers
    });

    expect(roleResponse.statusCode).toBe(403);
    expect(blockResponse.statusCode).toBe(403);
    expect(deleteResponse.statusCode).toBe(403);
    await expect(prisma.user.findUnique({ where: { id: target.id } })).resolves.toMatchObject({
      role: "ADMIN",
      isBlocked: false
    });
  });

  it("should reject stale admin tokens when user row no longer exists", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin/users",
      headers: {
        authorization: `Bearer ${adminToken("00000000-0000-0000-0000-000000000000", "9111111118")}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "AUTH_FORBIDDEN"
      }
    });
  });

  it("should allow admin deletion of empty user accounts", async () => {
    const adminPhone = "9111111114";
    const emptyPhone = "9111111115";
    createdPhones.add(adminPhone);
    createdPhones.add(emptyPhone);

    const admin = await prisma.user.create({
      data: {
        phone: adminPhone,
        role: "ADMIN"
      }
    });
    const emptyUser = await prisma.user.create({
      data: {
        phone: emptyPhone,
        role: "TENANT"
      }
    });

    const response = await app.inject({
      method: "DELETE",
      url: `/admin/users/${emptyUser.id}`,
      headers: { authorization: `Bearer ${adminToken(admin.id, adminPhone)}` }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: {
        deleted: true,
        id: emptyUser.id
      }
    });

    await expect(prisma.user.findUnique({ where: { id: emptyUser.id } })).resolves.toBeNull();
  });
});
