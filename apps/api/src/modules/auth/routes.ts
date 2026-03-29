import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { otpSendSchema, otpVerifySchema, profileSchema } from "../common/schemas.js";
import { rotateRefreshToken, revokeRefreshToken, sendOtp, verifyOtp } from "./service.js";

function signAccessToken(app: FastifyInstance, user: { id: string; phone: string; ownerProfile: { id: string } }) {
  return app.jwt.sign({
    sub: user.id,
    phone: user.phone,
    role: "OWNER",
    ownerProfileId: user.ownerProfile.id
  });
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/send-otp", async (request) => {
    const body = otpSendSchema.parse(request.body);
    return ok(await sendOtp(body.phone));
  });

  app.post("/auth/verify-otp", async (request) => {
    const body = otpVerifySchema.parse(request.body);
    const result = await verifyOtp(body.phone, body.otp, body.challengeId);
    const accessToken = signAccessToken(app, {
      ...result.user,
      ownerProfile: result.user.ownerProfile!
    });

    return ok({
      accessToken,
      refreshToken: result.refreshToken,
      user: {
        id: result.user.id,
        phone: result.user.phone,
        role: "OWNER" as const,
        ownerProfileId: result.user.ownerProfile!.id
      },
      isNewUser: result.isNewUser
    });
  });

  app.post("/auth/refresh", async (request) => {
    const body = request.body as { refreshToken?: string } | undefined;
    if (!body?.refreshToken) {
      throw new AppError(401, "AUTH_INVALID_TOKEN", "Refresh token is required");
    }
    const result = await rotateRefreshToken(body.refreshToken);
    const accessToken = signAccessToken(app, {
      id: result.user.id,
      phone: result.user.phone,
      ownerProfile: result.user.ownerProfile!
    });
    return ok({
      accessToken,
      refreshToken: result.refreshToken,
      user: {
        id: result.user.id,
        phone: result.user.phone,
        role: "OWNER" as const,
        ownerProfileId: result.user.ownerProfile!.id
      }
    });
  });

  app.post("/auth/logout", async (request) => {
    const body = request.body as { refreshToken?: string } | undefined;
    if (body?.refreshToken) {
      await revokeRefreshToken(body.refreshToken);
    }
    return ok({ loggedOut: true });
  });

  app.get("/auth/me", { preHandler: [app.authenticate] }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      include: { ownerProfile: true }
    });

    if (!user?.ownerProfile) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    return ok({
      id: user.id,
      phone: user.phone,
      role: "OWNER" as const,
      ownerProfileId: user.ownerProfile.id,
      displayName: user.ownerProfile.displayName,
      companyName: user.ownerProfile.companyName
    });
  });

  app.put("/auth/complete-profile", { preHandler: [app.authenticate] }, async (request) => {
    const body = profileSchema.parse(request.body);
    const profile = await prisma.ownerProfile.update({
      where: { id: request.user.ownerProfileId },
      data: {
        displayName: body.displayName,
        companyName: body.companyName
      }
    });

    return ok(profile);
  });
}
