import fp from "fastify-plugin";
import crypto from "node:crypto";

async function requestContextPlugin(app: import("fastify").FastifyInstance) {
  app.addHook("onRequest", async (request) => {
    request.requestId = request.headers["x-request-id"]?.toString() ?? crypto.randomUUID();
  });
}

export default fp(requestContextPlugin);

