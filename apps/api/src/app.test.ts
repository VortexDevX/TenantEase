import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./lib/db.js";

const app = createApp();
const createdPhones = new Set<string>();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: {
      phone: {
        in: Array.from(createdPhones)
      }
    }
  });
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

  it("should reject OTP requests for blocked users", async () => {
    const phone = "9111111111";
    createdPhones.add(phone);

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
