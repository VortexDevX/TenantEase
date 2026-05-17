import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./lib/env.js";
import { AppError } from "./lib/errors.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { docsRoutes } from "./modules/docs/routes.js";
import { maintenanceRoutes } from "./modules/maintenance/routes.js";
import { paymentRoutes } from "./modules/payments/routes.js";
import { propertyRoutes } from "./modules/properties/routes.js";
import { receiptRoutes } from "./modules/receipts/routes.js";
import { remindersRoutes } from "./modules/reminders/routes.js";
import { rentRoutes } from "./modules/rent/routes.js";
import { roomRoutes } from "./modules/rooms/routes.js";
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
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit for KYC docs
    }
  });
  app.register(authPlugin);

  app.get("/health", async () => ({
    status: "healthy",
    timestamp: new Date().toISOString()
  }));

  app.register(adminRoutes);
  app.register(authRoutes);
  app.register(docsRoutes);
  app.register(documentRoutes);
  app.register(propertyRoutes);
  app.register(roomRoutes);
  app.register(tenantRoutes);
  app.register(importTenantRoutes);
  app.register(announcementRoutes);
  app.register(tenantPortalRoutes);
  app.register(dashboardRoutes);
  app.register(rentRoutes);
  app.register(remindersRoutes);
  app.register(maintenanceRoutes);
  app.register(paymentRoutes);
  app.register(receiptRoutes);
  app.register(systemRoutes);
  app.register(cronRoutes);
  app.register(utilityRoutes);
  app.register(agreementRoutes);
  app.register(reportsRoutes);

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
