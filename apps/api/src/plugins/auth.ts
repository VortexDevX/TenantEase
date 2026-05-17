import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";

async function authPlugin(app: import("fastify").FastifyInstance) {
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET
  });

  // Owner-only guard
  app.decorate("authenticate", async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError(401, "AUTH_INVALID_TOKEN", "Authentication is required");
    }
    
    if (request.user.role !== "OWNER" || !request.user.ownerProfileId) {
      throw new AppError(403, "AUTH_FORBIDDEN", "Owner access is required");
    }
  });

  // Tenant-only guard
  app.decorate("authenticateTenant", async function authenticateTenant(request: FastifyRequest, _reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError(401, "AUTH_INVALID_TOKEN", "Authentication is required");
    }
    
    if (request.user.role !== "TENANT" || !request.user.tenantId) {
      throw new AppError(403, "AUTH_FORBIDDEN", "Tenant access is required");
    }
  });

  // Admin-only guard
  app.decorate("authenticateAdmin", async function authenticateAdmin(request: FastifyRequest, _reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError(401, "AUTH_INVALID_TOKEN", "Authentication is required");
    }
    
    if (request.user.role !== "ADMIN") {
      throw new AppError(403, "AUTH_FORBIDDEN", "Admin access is required");
    }
  });

  // Any authenticated user guard (no role restriction)
  app.decorate("authenticateAny", async function authenticateAny(request: FastifyRequest, _reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError(401, "AUTH_INVALID_TOKEN", "Authentication is required");
    }
  });
}

export default fp(authPlugin);
