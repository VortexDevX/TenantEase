import "@fastify/jwt";
import "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      phone: string;
      role: "OWNER";
      ownerProfileId: string;
    };
    user: {
      sub: string;
      phone: string;
      role: "OWNER";
      ownerProfileId: string;
    };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
