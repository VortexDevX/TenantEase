import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./lib/env.js";
import { AppError } from "./lib/errors.js";
import { authRoutes } from "./modules/auth/routes.js";
import { paymentRoutes } from "./modules/payments/routes.js";
import { propertyRoutes } from "./modules/properties/routes.js";
import { receiptRoutes } from "./modules/receipts/routes.js";
import { rentRoutes } from "./modules/rent/routes.js";
import { roomRoutes } from "./modules/rooms/routes.js";
import { tenantRoutes } from "./modules/tenants/routes.js";
import authPlugin from "./plugins/auth.js";
import requestContextPlugin from "./plugins/request-context.js";

export function createApp() {
  const app = Fastify({
    logger: false
  });

  app.register(requestContextPlugin);
  app.register(cors, {
    origin: [env.WEB_URL]
  });
  app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute"
  });
  app.register(authPlugin);

  app.get("/health", async () => ({
    status: "healthy",
    timestamp: new Date().toISOString()
  }));

  app.register(authRoutes);
  app.register(propertyRoutes);
  app.register(roomRoutes);
  app.register(tenantRoutes);
  app.register(rentRoutes);
  app.register(paymentRoutes);
  app.register(receiptRoutes);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
    }

    if (typeof error === "object" && error !== null && "issues" in error) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: (error as { issues?: unknown }).issues
        }
      });
    }

    return reply.status(500).send({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error"
      }
    });
  });

  return app;
}
