import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import { env } from "./lib/env.js";
import { AppError } from "./lib/errors.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { docsRoutes } from "./modules/docs/routes.js";
import { maintenanceRoutes } from "./modules/maintenance/routes.js";
import { paymentRoutes } from "./modules/payments/routes.js";
import { onlinePaymentRoutes } from "./modules/online-payments/routes.js";
import { propertyRoutes } from "./modules/properties/routes.js";
import { receiptRoutes } from "./modules/receipts/routes.js";
import { remindersRoutes } from "./modules/reminders/routes.js";
import { rentRoutes } from "./modules/rent/routes.js";
import { roomRoutes } from "./modules/rooms/routes.js";
import { subscriptionRoutes } from "./modules/subscriptions/routes.js";
import { staffRoutes } from "./modules/staff/routes.js";
import { systemRoutes } from "./modules/system/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import { tenantPortalRoutes } from "./modules/tenant-portal/routes.js";
import { tenantRoutes } from "./modules/tenants/routes.js";
import authPlugin from "./plugins/auth.js";
import requestContextPlugin from "./plugins/request-context.js";

import fastifyMultipart from "@fastify/multipart";
import { documentRoutes } from "./modules/documents/routes.js";
import { importTenantRoutes } from "./modules/tenants/import.js";
import { announcementRoutes } from "./modules/announcements/routes.js";
import { cronRoutes } from "./modules/cron/routes.js";
import { utilityRoutes } from "./modules/utilities/routes.js";
import { agreementRoutes } from "./modules/agreements/routes.js";
import { reportsRoutes } from "./modules/reports/routes.js";
import { listingRoutes } from "./modules/listings/routes.js";
import { prisma } from "./lib/db.js";
import { notificationRoutes } from "./modules/notifications/routes.js";

export function createApp() {
  const app = Fastify({
    logger: env.NODE_ENV === "test"
      ? false
      : {
          level: env.NODE_ENV === "production" ? "info" : "debug",
          redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"]
        }
  });

  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    const rawBody = typeof body === "string" ? body : body.toString("utf8");
    request.rawBody = rawBody;
    if (rawBody.length === 0) {
      done(null, null);
      return;
    }

    try {
      done(null, JSON.parse(rawBody));
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  app.register(requestContextPlugin);
  app.register(cookie);
  app.register(cors, {
    origin: [env.WEB_URL],
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["authorization", "content-type"]
  });
  app.register(rateLimit, {
    max: env.NODE_ENV === "test" ? 1000 : 120,
    timeWindow: "1 minute"
  });
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit for KYC docs
    }
  });
  app.register(authPlugin);

  app.addHook("onSend", async (_request, reply) => {
    reply
      .header("x-content-type-options", "nosniff")
      .header("x-frame-options", "DENY")
      .header("referrer-policy", "no-referrer")
      .header("permissions-policy", "camera=(), microphone=(), geolocation=()")
      .header("cross-origin-opener-policy", "same-origin")
      .header("content-security-policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");

    if (env.NODE_ENV === "production") {
      reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
    }
  });

  app.get("/health", async () => ({
    status: "healthy",
    timestamp: new Date().toISOString()
  }));

  app.get("/ready", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ready", timestamp: new Date().toISOString() };
    } catch {
      return reply.status(503).send({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Database is not ready" }
      });
    }
  });

  app.register(adminRoutes);
  app.register(authRoutes);
  app.register(docsRoutes);
  app.register(documentRoutes);
  app.register(propertyRoutes);
  app.register(roomRoutes);
  app.register(subscriptionRoutes);
  app.register(staffRoutes);
  app.register(tenantRoutes);
  app.register(importTenantRoutes);
  app.register(announcementRoutes);
  app.register(tenantPortalRoutes);
  app.register(dashboardRoutes);
  app.register(rentRoutes);
  app.register(remindersRoutes);
  app.register(maintenanceRoutes);
  app.register(paymentRoutes);
  app.register(onlinePaymentRoutes);
  app.register(receiptRoutes);
  app.register(systemRoutes);
  app.register(cronRoutes);
  app.register(utilityRoutes);
  app.register(agreementRoutes);
  app.register(reportsRoutes);
  app.register(listingRoutes);
  app.register(notificationRoutes);

  app.setErrorHandler((error, request, reply) => {
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

    if (typeof error === "object" && error !== null && "statusCode" in error) {
      const statusCode = Number(error.statusCode);
      if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) {
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: statusCode === 429 ? "RATE_LIMITED" : "REQUEST_ERROR",
            message: error instanceof Error ? error.message : "Request failed"
          }
        });
      }
    }

    if (env.NODE_ENV !== "production") {
      request.log.error(error);
      console.error(error);
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
