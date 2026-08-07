import { prisma } from "../../lib/db.js";
import { env } from "../../lib/env.js";
import { AppError } from "../../lib/errors.js";
import { createOtpCode, createToken, hashValue } from "../../lib/security.js";
import { smsProvider } from "../../providers/sms-provider.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_HOURLY_LIMIT = 3;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const adminPhones = new Set(
  (env.ADMIN_PHONES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

export async function sendOtp(phone: string) {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (user?.isBlocked) {
    throw new AppError(403, "AUTH_FORBIDDEN", "This account is blocked");
  }

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recentChallenges = await prisma.otpChallenge.findMany({
    where: {
      phone,
      createdAt: { gte: since }
    },
    orderBy: { createdAt: "desc" },
    take: OTP_HOURLY_LIMIT
  });

  if (
    env.NODE_ENV !== "development" &&
    recentChallenges[0] &&
    Date.now() - recentChallenges[0].createdAt.getTime() < OTP_RESEND_COOLDOWN_MS
  ) {
    throw new AppError(429, "RATE_LIMITED", "Wait before requesting another OTP", {
      retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - recentChallenges[0].createdAt.getTime())) / 1000)
    });
  }

  if (env.NODE_ENV !== "development" && recentChallenges.length >= OTP_HOURLY_LIMIT) {
    throw new AppError(429, "RATE_LIMITED", "Too many OTP requests. Try again later.", {
      limit: OTP_HOURLY_LIMIT,
      windowSeconds: 3600
    });
  }

  const otpCode = createOtpCode();
  const challenge = await prisma.otpChallenge.create({
    data: {
      phone,
      userId: user?.id,
      otpHash: hashValue(otpCode, env.OTP_PEPPER),
      expiresAt: new Date(Date.now() + OTP_TTL_MS)
    }
  });

  await smsProvider.sendOtp(phone, otpCode, challenge.id);

  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt.toISOString(),
    debugOtp: process.env.NODE_ENV === "production" ? undefined : otpCode
  };
}

/**
 * Unified OTP verification — auto-detects role from database state.
 *
 * Role resolution order:
 *   1. user.role === ADMIN (set manually in DB) → ADMIN
 *   2. user.role === OWNER and user has OwnerProfile → OWNER
 *   3. user.role === STAFF and active staff assignment exists → STAFF
 *   4. Tenant record exists for phone → TENANT
 *   5. New user (no records) → TENANT (default)
 */
export async function verifyOtp(phone: string, otp: string, challengeId: string, options?: { ownerSignup?: boolean }) {
  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      id: challengeId,
      phone,
      consumedAt: null
    }
  });

  if (!challenge) {
    throw new AppError(401, "AUTH_INVALID_OTP", "OTP challenge is invalid");
  }

  if (challenge.expiresAt < new Date()) {
    throw new AppError(401, "AUTH_OTP_EXPIRED", "OTP challenge has expired");
  }

  if (challenge.attempts >= 5) {
    throw new AppError(429, "RATE_LIMITED", "Too many OTP attempts");
  }

  if (challenge.otpHash !== hashValue(otp, env.OTP_PEPPER)) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } }
    });
    throw new AppError(401, "AUTH_INVALID_OTP", "OTP is incorrect");
  }

  const result = await prisma.$transaction(async (tx) => {
    const activeTenant = await tx.tenant.findFirst({
      where: { phone, status: { in: ["ACTIVE", "NOTICE"] } },
      orderBy: { createdAt: "desc" }
    });
    const isAdminPhone = adminPhones.has(phone);

    let user = await tx.user.findUnique({
      where: { phone },
      include: { ownerProfile: true }
    });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      if (isAdminPhone) {
        user = await tx.user.create({
          data: {
            phone,
            role: "ADMIN"
          },
          include: { ownerProfile: true }
        });
      } else if (options?.ownerSignup) {
        user = await tx.user.create({
          data: {
            phone,
            role: "OWNER",
            ownerProfile: { create: {} }
          },
          include: { ownerProfile: true }
        });
      } else {
        user = await tx.user.create({
          data: {
            phone,
            role: "TENANT"
          },
          include: { ownerProfile: true }
        });
      }
    } else if (user.isBlocked) {
      throw new AppError(403, "AUTH_FORBIDDEN", "This account is blocked");
    } else if (options?.ownerSignup) {
      throw new AppError(409, "VALIDATION_ERROR", "An account with this number already exists. Please sign in instead.");
    } else if (isAdminPhone && user.role !== "ADMIN") {
      user = await tx.user.update({
        where: { id: user.id },
        data: {
          role: "ADMIN"
        },
        include: { ownerProfile: true }
      });
    }

    await tx.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() }
    });

    const refreshToken = createToken();
    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashValue(refreshToken, env.JWT_REFRESH_SECRET),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS)
      }
    });

    // --- Role resolution ---
    const activeStaffAssignment = await tx.staffAssignment.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        inviteStatus: { not: "REVOKED" }
      },
      orderBy: { invitedAt: "desc" }
    });

    if (options?.ownerSignup && !isAdminPhone && !user.ownerProfile) {
      if (activeTenant || activeStaffAssignment || user.role === "ADMIN") {
        throw new AppError(403, "AUTH_OWNER_SIGNUP_UNAVAILABLE", "This phone already has tenant, staff, or admin access");
      }

      user = await tx.user.update({
        where: { id: user.id },
        data: {
          role: "OWNER",
          ownerProfile: { create: {} }
        },
        include: { ownerProfile: true }
      });
    }

    if (activeStaffAssignment?.inviteStatus === "PENDING") {
      await tx.staffAssignment.updateMany({
        where: {
          userId: user.id,
          isActive: true,
          inviteStatus: "PENDING"
        },
        data: {
          inviteStatus: "ACCEPTED",
          acceptedAt: new Date()
        }
      });
    }

    if (activeStaffAssignment && user.role === "TENANT" && !activeTenant) {
      user = await tx.user.update({
        where: { id: user.id },
        data: { role: "STAFF" },
        include: { ownerProfile: true }
      });
    }

    let resolvedRole: "ADMIN" | "OWNER" | "STAFF" | "TENANT" = "TENANT";
    let ownerProfileId: string | undefined;
    let tenantId: string | undefined;

    if (isAdminPhone || user.role === "ADMIN") {
      resolvedRole = "ADMIN";
    } else if (user.role === "OWNER" && user.ownerProfile) {
      resolvedRole = "OWNER";
      ownerProfileId = user.ownerProfile.id;
    } else if (user.role === "STAFF" && activeStaffAssignment) {
      resolvedRole = "STAFF";
    } else {
      resolvedRole = "TENANT";
      tenantId = activeTenant?.id;
    }

    return { isNewUser, user, resolvedRole, ownerProfileId, tenantId, refreshToken };
  });

  return result;
}

export async function verifyTenantOtp(phone: string, otp: string, challengeId: string) {
  const result = await verifyOtp(phone, otp, challengeId);

  if (result.resolvedRole !== "TENANT" || !result.tenantId) {
    throw new AppError(403, "AUTH_FORBIDDEN", "Tenant access is required for this phone number");
  }

  return result;
}

export async function revokeRefreshToken(rawToken: string) {
  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashValue(rawToken, env.JWT_REFRESH_SECRET),
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
}

export async function rotateRefreshToken(rawToken: string) {
  const tokenHash = hashValue(rawToken, env.JWT_REFRESH_SECRET);
  const existing = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: {
      user: {
        include: {
          ownerProfile: true
        }
      }
    }
  });

  if (!existing) {
    throw new AppError(401, "AUTH_INVALID_TOKEN", "Refresh token is invalid");
  }

  const nextToken = createToken();

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() }
    }),
    prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: hashValue(nextToken, env.JWT_REFRESH_SECRET),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS)
      }
    })
  ]);

  // Resolve role for token re-signing
  const activeStaffAssignment = await prisma.staffAssignment.findFirst({
    where: {
      userId: existing.user.id,
      isActive: true,
      inviteStatus: { not: "REVOKED" }
    },
    orderBy: { invitedAt: "desc" }
  });

  let resolvedRole: "ADMIN" | "OWNER" | "STAFF" | "TENANT" = "TENANT";
  let ownerProfileId: string | undefined;
  let tenantId: string | undefined;

  if (existing.user.role === "ADMIN") {
    resolvedRole = "ADMIN";
  } else if (existing.user.role === "OWNER" && existing.user.ownerProfile) {
    resolvedRole = "OWNER";
    ownerProfileId = existing.user.ownerProfile.id;
  } else if (existing.user.role === "STAFF" && activeStaffAssignment) {
    resolvedRole = "STAFF";
  } else {
    const tenant = await prisma.tenant.findFirst({
      where: { phone: existing.user.phone, status: { in: ["ACTIVE", "NOTICE"] } },
      orderBy: { createdAt: "desc" }
    });
    resolvedRole = "TENANT";
    tenantId = tenant?.id;
  }

  return {
    user: existing.user,
    resolvedRole,
    ownerProfileId,
    tenantId,
    refreshToken: nextToken
  };
}
