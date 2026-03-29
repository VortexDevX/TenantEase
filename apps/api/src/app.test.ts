import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

const app = createApp();

afterAll(async () => {
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
});

