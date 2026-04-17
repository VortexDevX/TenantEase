import { prisma } from "../../lib/db.js";
import { env } from "../../lib/env.js";
import { AppError } from "../../lib/errors.js";
import { createOtpCode, createToken, hashValue } from "../../lib/security.js";
import { mockOtpProvider } from "../../providers/mock-providers.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function sendOtp(phone: string) {
  const user = await prisma.user.findUnique({ where: { phone } });
  const otpCode = createOtpCode();
  const challenge = await prisma.otpChallenge.create({
    data: {
      phone,
      userId: user?.id,
      otpHash: hashValue(otpCode, env.OTP_PEPPER),
      expiresAt: new Date(Date.now() + OTP_TTL_MS)
    }
  });

  await mockOtpProvider.send(phone, otpCode, challenge.id);

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
 *   2. user has OwnerProfile → OWNER
 *   3. Tenant record exists for phone → TENANT
 *   4. New user (no records) → TENANT (default)
 */
export async function verifyOtp(phone: string, otp: string, challengeId: string) {
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
    let user = await tx.user.findUnique({
      where: { phone },
      include: { ownerProfile: true }
    });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await tx.user.create({
        data: {
          phone,
          role: "TENANT"
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
    let resolvedRole: "ADMIN" | "OWNER" | "TENANT" = "TENANT";
    let ownerProfileId: string | undefined;
    let tenantId: string | undefined;

    if (user.role === "ADMIN") {
      resolvedRole = "ADMIN";
    } else if (user.ownerProfile) {
      resolvedRole = "OWNER";
      ownerProfileId = user.ownerProfile.id;
    } else {
      // Check if there's an active tenant booking for this phone
      const tenant = await tx.tenant.findFirst({
        where: { phone, status: { in: ["ACTIVE", "NOTICE"] } },
        orderBy: { createdAt: "desc" }
      });
      resolvedRole = "TENANT";
      tenantId = tenant?.id;
    }

    return { isNewUser, user, resolvedRole, ownerProfileId, tenantId, refreshToken };
  });

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
  let resolvedRole: "ADMIN" | "OWNER" | "TENANT" = "TENANT";
  let ownerProfileId: string | undefined;
  let tenantId: string | undefined;

  if (existing.user.role === "ADMIN") {
    resolvedRole = "ADMIN";
  } else if (existing.user.ownerProfile) {
    resolvedRole = "OWNER";
    ownerProfileId = existing.user.ownerProfile.id;
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
