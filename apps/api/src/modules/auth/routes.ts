import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireOwnerProfileId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";
import { otpSendSchema, otpVerifySchema, profileSchema } from "../common/schemas.js";
import { rotateRefreshToken, revokeRefreshToken, sendOtp, verifyOtp, verifyTenantOtp } from "./service.js";
import { env } from "../../lib/env.js";

const REFRESH_COOKIE_NAME = "te_refresh_token";
const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function setRefreshCookie(reply: FastifyReply, refreshToken: string) {
  reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
    path: "/auth",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS
  });
}

function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE_NAME, {
    path: "/auth",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax"
  });
}

function assertTrustedBrowserOrigin(request: FastifyRequest) {
  if (env.NODE_ENV === "test") return;
  const origin = request.headers.origin;
  if (origin && origin !== env.WEB_URL) {
    throw new AppError(403, "AUTH_FORBIDDEN", "Untrusted authentication origin");
  }
}

function signAccessToken(
  app: FastifyInstance,
  payload: {
    userId: string;
    phone: string;
    role: "ADMIN" | "OWNER" | "STAFF" | "TENANT";
    ownerProfileId?: string;
    tenantId?: string;
  }
) {
  return app.jwt.sign({
    sub: payload.userId,
    phone: payload.phone,
    role: payload.role,
    ownerProfileId: payload.ownerProfileId,
    tenantId: payload.tenantId
  });
}

function authUserPayload(result: Awaited<ReturnType<typeof verifyOtp>>) {
  const ownerProfile = result.resolvedRole === "OWNER" ? result.user.ownerProfile : null;

  return {
    id: result.user.id,
    phone: result.user.phone,
    role: result.resolvedRole,
    ownerProfileId: result.ownerProfileId,
    tenantId: result.tenantId,
    displayName: ownerProfile?.displayName ?? undefined,
    companyName: ownerProfile?.companyName ?? undefined
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/send-otp", async (request) => {
    const body = otpSendSchema.parse(request.body);
    const result = await sendOtp(body.phone);
    await createAuditLog({
      action: "auth.send_otp",
      resource: "OtpChallenge",
      resourceId: result.challengeId,
      payload: { phone: body.phone },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });
    return ok(result);
  });

  // Unified verify — backend auto-detects role
  app.post("/auth/verify-otp", async (request, reply) => {
    const body = otpVerifySchema.parse(request.body);
    const result = await verifyOtp(body.phone, body.otp, body.challengeId);

    const accessToken = signAccessToken(app, {
      userId: result.user.id,
      phone: result.user.phone,
      role: result.resolvedRole,
      ownerProfileId: result.ownerProfileId,
      tenantId: result.tenantId
    });
    setRefreshCookie(reply, result.refreshToken);

    await createAuditLog({
      userId: result.user.id,
      action: "auth.verify_otp",
      resource: "User",
      resourceId: result.user.id,
      payload: { isNewUser: result.isNewUser, resolvedRole: result.resolvedRole },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok({
      accessToken,
      user: authUserPayload(result),
      isNewUser: result.isNewUser
    });
  });

  app.post("/auth/owner/verify-otp", async (request, reply) => {
    const body = otpVerifySchema.parse(request.body);
    const result = await verifyOtp(body.phone, body.otp, body.challengeId, { ownerSignup: true });

    if (result.resolvedRole !== "OWNER" || !result.ownerProfileId) {
      throw new AppError(403, "AUTH_FORBIDDEN", "Owner access is required for this phone number");
    }

    const accessToken = signAccessToken(app, {
      userId: result.user.id,
      phone: result.user.phone,
      role: "OWNER",
      ownerProfileId: result.ownerProfileId
    });
    setRefreshCookie(reply, result.refreshToken);

    await createAuditLog({
      userId: result.user.id,
      action: "auth.verify_owner_otp",
      resource: "User",
      resourceId: result.user.id,
      payload: { isNewUser: result.isNewUser, resolvedRole: result.resolvedRole },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok({
      accessToken,
      user: authUserPayload(result),
      isNewUser: result.isNewUser
    });
  });

  app.post("/auth/tenant/verify-otp", async (request, reply) => {
    const body = otpVerifySchema.parse(request.body);
    const result = await verifyTenantOtp(body.phone, body.otp, body.challengeId);

    const accessToken = signAccessToken(app, {
      userId: result.user.id,
      phone: result.user.phone,
      role: result.resolvedRole,
      ownerProfileId: result.ownerProfileId,
      tenantId: result.tenantId
    });
    setRefreshCookie(reply, result.refreshToken);

    await createAuditLog({
      userId: result.user.id,
      action: "auth.verify_tenant_otp",
      resource: "User",
      resourceId: result.user.id,
      payload: { isNewUser: result.isNewUser, resolvedRole: result.resolvedRole },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok({
      accessToken,
      user: authUserPayload(result),
      isNewUser: result.isNewUser
    });
  });

  app.post("/auth/refresh", async (request, reply) => {
    assertTrustedBrowserOrigin(request);
    const refreshToken = request.cookies[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      throw new AppError(401, "AUTH_INVALID_TOKEN", "Refresh token is required");
    }
    const result = await rotateRefreshToken(refreshToken);
    setRefreshCookie(reply, result.refreshToken);

    const accessToken = signAccessToken(app, {
      userId: result.user.id,
      phone: result.user.phone,
      role: result.resolvedRole,
      ownerProfileId: result.ownerProfileId,
      tenantId: result.tenantId
    });

    return ok({
      accessToken,
      user: {
        id: result.user.id,
        phone: result.user.phone,
        role: result.resolvedRole,
        ownerProfileId: result.ownerProfileId,
        tenantId: result.tenantId,
        displayName: result.resolvedRole === "OWNER" ? result.user.ownerProfile?.displayName : undefined,
        companyName: result.resolvedRole === "OWNER" ? result.user.ownerProfile?.companyName : undefined
      }
    });
  });

  app.post("/auth/logout", async (request, reply) => {
    assertTrustedBrowserOrigin(request);
    const refreshToken = request.cookies[REFRESH_COOKIE_NAME];
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    clearRefreshCookie(reply);
    await createAuditLog({
      userId: request.user?.sub ?? null,
      action: "auth.logout",
      resource: "RefreshToken",
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });
    return ok({ loggedOut: true });
  });

  // GET /auth/me — works for all roles
  app.get("/auth/me", { preHandler: [app.authenticateAny] }, async (request) => {
    const { role } = request.user;

    if (role === "ADMIN") {
      const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
      if (!user) throw new AppError(404, "NOT_FOUND", "User not found");
      return ok({
        id: user.id,
        phone: user.phone,
        role: "ADMIN" as const
      });
    }

    if (role === "TENANT") {
      let tenantData = null;
      if (request.user.tenantId) {
        tenantData = await prisma.tenant.findUnique({
          where: { id: request.user.tenantId },
          select: { id: true, fullName: true, roomId: true, propertyId: true }
        });
      }
      return ok({
        id: request.user.sub,
        phone: request.user.phone,
        role: "TENANT" as const,
        tenantId: tenantData?.id ?? null,
        fullName: tenantData?.fullName ?? null,
        hasBooking: !!tenantData
      });
    }

    if (role === "STAFF") {
      const assignments = await prisma.staffAssignment.findMany({
        where: {
          userId: request.user.sub,
          isActive: true,
          inviteStatus: { not: "REVOKED" }
        },
        include: {
          property: { select: { id: true, name: true } }
        },
        orderBy: { invitedAt: "desc" }
      });

      return ok({
        id: request.user.sub,
        phone: request.user.phone,
        role: "STAFF" as const,
        staffAssignments: assignments.map((assignment) => ({
          id: assignment.id,
          userId: assignment.userId,
          propertyId: assignment.propertyId,
          propertyName: assignment.property.name,
          phone: assignment.invitePhone,
          email: assignment.inviteEmail,
          role: assignment.role,
          inviteStatus: assignment.inviteStatus,
          isActive: assignment.isActive,
          invitedAt: assignment.invitedAt.toISOString(),
          acceptedAt: assignment.acceptedAt?.toISOString() ?? null,
          deactivatedAt: assignment.deactivatedAt?.toISOString() ?? null
        }))
      });
    }

    // OWNER
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      include: { ownerProfile: true }
    });

    if (!user?.ownerProfile) {
      throw new AppError(404, "NOT_FOUND", "Owner not found");
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

  // PUT /auth/complete-profile — OWNER only
  app.put("/auth/complete-profile", { preHandler: [app.authenticate] }, async (request) => {
    const body = profileSchema.parse(request.body);
    const profile = await prisma.ownerProfile.update({
      where: { id: requireOwnerProfileId(request.user.ownerProfileId) },
      data: {
        displayName: body.displayName,
        companyName: body.companyName
      }
    });
    await createAuditLog({
      userId: request.user.sub,
      action: "owner.complete_profile",
      resource: "OwnerProfile",
      resourceId: profile.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok(profile);
  });
}
