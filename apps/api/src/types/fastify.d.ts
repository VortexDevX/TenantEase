import "@fastify/jwt";
import "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      phone: string;
      role: "ADMIN" | "OWNER" | "TENANT";
      ownerProfileId?: string;
      tenantId?: string;
    };
    user: {
      sub: string;
      phone: string;
      role: "ADMIN" | "OWNER" | "TENANT";
      ownerProfileId?: string;
      tenantId?: string;
    };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateTenant: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAny: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
