import type { FastifyInstance } from "fastify";
import { ok } from "../../lib/http.js";

const routeGroups = {
  auth: [
    "POST /auth/send-otp",
    "POST /auth/verify-otp",
    "POST /auth/refresh",
    "POST /auth/logout",
    "GET /auth/me",
    "PUT /auth/complete-profile"
  ],
  properties: [
    "GET /properties",
    "POST /properties",
    "GET /properties/:id",
    "PUT /properties/:id"
  ],
  rooms: [
    "GET /properties/:propertyId/rooms",
    "POST /properties/:propertyId/rooms",
    "GET /rooms/:id",
    "PUT /rooms/:id",
    "DELETE /rooms/:id"
  ],
  tenants: [
    "GET /properties/:propertyId/tenants",
    "POST /properties/:propertyId/tenants",
    "GET /tenants/:id",
    "PUT /tenants/:id",
    "POST /tenants/:id/vacate",
    "POST /tenants/:id/transfer"
  ],
  maintenance: [
    "GET /properties/:propertyId/maintenance",
    "GET /maintenance/:id",
    "POST /maintenance",
    "PUT /maintenance/:id",
    "POST /maintenance/:id/comments",
    "POST /maintenance/:id/close"
  ],
  rent: [
    "GET /properties/:propertyId/rent",
    "POST /properties/:propertyId/rent/generate",
    "GET /tenants/:tenantId/rent"
  ],
  payments: [
    "POST /payments",
    "GET /payments/:id",
    "PUT /payments/:id"
  ],
  receipts: [
    "POST /receipts",
    "GET /receipts/:id/download",
    "GET /tenants/:tenantId/receipts"
  ]
};

export async function docsRoutes(app: FastifyInstance) {
  app.get("/openapi.json", async () =>
    ok({
      name: "TenantEase API",
      version: "0.1.0",
      description: "Wave 1 backend contract reference",
      routeGroups
    })
  );
}
