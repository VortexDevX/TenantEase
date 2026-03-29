import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";

async function authPlugin(app: import("fastify").FastifyInstance) {
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET
  });

  app.decorate("authenticate", async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError(401, "AUTH_INVALID_TOKEN", "Authentication is required");
    }
  });
}

export default fp(authPlugin);

