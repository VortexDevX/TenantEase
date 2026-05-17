import type { FastifyInstance } from "fastify";
import path from "node:path";
import crypto from "node:crypto";
import { requireOwnerProfileId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";
import { assertTenantOwnership } from "../common/owner.js";
import { storageProvider } from "../../providers/mock-providers.js";

export async function documentRoutes(app: FastifyInstance) {
  app.post("/tenants/:tenantId/documents/upload", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { tenantId: string };
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    
    // Verify owner owns this tenant
    await assertTenantOwnership(params.tenantId, ownerProfileId);

    const data = await request.file();
    if (!data) {
      throw new AppError(400, "VALIDATION_ERROR", "No file uploaded");
    }

    const validMimes = ["image/jpeg", "image/png", "application/pdf"];
    if (!validMimes.includes(data.mimetype)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid file type. Only JPEG, PNG, and PDF are allowed.");
    }

    const ext = path.extname(data.filename).toLowerCase() || (data.mimetype === "application/pdf" ? ".pdf" : ".jpg");
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const storagePath = `kyc/${params.tenantId}/${uniqueName}`;

    const buffer = await data.toBuffer();
    await storageProvider.saveBuffer(storagePath, buffer);

    const document = await prisma.tenantDocument.create({
      data: {
        tenantId: params.tenantId,
        fileName: data.filename,
        mimeType: data.mimetype,
        storageKey: storagePath
      }
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "document.upload",
      resource: "TenantDocument",
      resourceId: document.id,
      payload: { fileName: data.filename, mimeType: data.mimetype },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok({
      id: document.id,
      fileName: document.fileName,
      mimeType: document.mimeType,
      url: `/tenants/${params.tenantId}/documents/${document.id}/download`,
      createdAt: document.createdAt.toISOString()
    });
  });

  app.get("/tenants/:tenantId/documents", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { tenantId: string };
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    await assertTenantOwnership(params.tenantId, ownerProfileId);

    const documents = await prisma.tenantDocument.findMany({
      where: { tenantId: params.tenantId },
      orderBy: { createdAt: "desc" }
    });

    return ok(documents.map(d => ({
      id: d.id,
      fileName: d.fileName,
      mimeType: d.mimeType,
      url: `/tenants/${params.tenantId}/documents/${d.id}/download`,
      createdAt: d.createdAt.toISOString()
    })));
  });

  app.get("/tenants/:tenantId/documents/:id/download", { preHandler: [app.authenticate] }, async (request, reply) => {
    const params = request.params as { tenantId: string; id: string };
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    await assertTenantOwnership(params.tenantId, ownerProfileId);

    const document = await prisma.tenantDocument.findUnique({
      where: { id: params.id }
    });

    if (!document || document.tenantId !== params.tenantId) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    try {
      const buffer = await storageProvider.readBuffer(document.storageKey);
      reply
        .header("content-type", document.mimeType)
        .header("content-disposition", `inline; filename="${document.fileName}"`);

      return reply.send(buffer);
    } catch (e) {
      throw new AppError(404, "NOT_FOUND", "File file not found on storage provider");
    }
  });

  app.delete("/tenants/:tenantId/documents/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = request.params as { tenantId: string; id: string };
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    await assertTenantOwnership(params.tenantId, ownerProfileId);

    const document = await prisma.tenantDocument.findUnique({
      where: { id: params.id }
    });

    if (!document || document.tenantId !== params.tenantId) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    await prisma.tenantDocument.delete({
      where: { id: params.id }
    });

    await createAuditLog({
      userId: request.user.sub,
      action: "document.delete",
      resource: "TenantDocument",
      resourceId: document.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });

    return ok({ deleted: true, id: params.id });
  });
}
