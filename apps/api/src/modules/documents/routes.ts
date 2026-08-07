import type { FastifyInstance } from "fastify";
import path from "node:path";
import crypto from "node:crypto";
import { assertTenantAccess } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";
import { storageProvider } from "../../providers/mock-providers.js";

function hasExpectedSignature(mimeType: string, buffer: Buffer) {
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/jpeg") return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9;
  return false;
}

export async function documentRoutes(app: FastifyInstance) {
  app.post("/tenants/:tenantId/documents/upload", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { tenantId: string };
    await assertTenantAccess(request, params.tenantId, "document:write");

    const data = await request.file();
    if (!data) {
      throw new AppError(400, "VALIDATION_ERROR", "No file uploaded");
    }

    const validMimes = ["image/jpeg", "image/png", "application/pdf"];
    if (!validMimes.includes(data.mimetype)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid file type. Only JPEG, PNG, and PDF are allowed.");
    }

    const ext = data.mimetype === "application/pdf" ? ".pdf" : data.mimetype === "image/png" ? ".png" : ".jpg";
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const storagePath = `kyc/${params.tenantId}/${uniqueName}`;
    const rawCategory = data.fields?.category;
    const categoryValue = rawCategory && !Array.isArray(rawCategory) && "value" in rawCategory
      ? String(rawCategory.value)
      : "KYC";
    const category = ["KYC", "PHOTO", "OTHER"].includes(categoryValue) ? categoryValue as "KYC" | "PHOTO" | "OTHER" : "KYC";

    const buffer = await data.toBuffer();
    if (!hasExpectedSignature(data.mimetype, buffer)) {
      throw new AppError(400, "VALIDATION_ERROR", "File contents do not match the declared type");
    }
    await storageProvider.saveBuffer(storagePath, buffer);

    const document = await prisma.tenantDocument.create({
      data: {
        tenantId: params.tenantId,
        fileName: data.filename,
        mimeType: data.mimetype,
        storageKey: storagePath,
        category
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
      category: document.category,
      url: `/tenants/${params.tenantId}/documents/${document.id}/download`,
      createdAt: document.createdAt.toISOString()
    });
  });

  app.get("/tenants/:tenantId/documents", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { tenantId: string };
    await assertTenantAccess(request, params.tenantId, "document:read");

    const documents = await prisma.tenantDocument.findMany({
      where: { tenantId: params.tenantId },
      orderBy: { createdAt: "desc" }
    });

    return ok(documents.map(d => ({
      id: d.id,
      fileName: d.fileName,
      mimeType: d.mimeType,
      category: d.category,
      url: `/tenants/${params.tenantId}/documents/${d.id}/download`,
      createdAt: d.createdAt.toISOString()
    })));
  });

  app.get("/tenants/:tenantId/documents/:id/download", { preHandler: [app.authenticateOwnerOrStaff] }, async (request, reply) => {
    const params = request.params as { tenantId: string; id: string };
    await assertTenantAccess(request, params.tenantId, "document:read");

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
        .header("content-disposition", `attachment; filename="document-${document.id}${path.extname(document.storageKey)}"`);

      return reply.send(buffer);
    } catch (e) {
      throw new AppError(404, "NOT_FOUND", "File file not found on storage provider");
    }
  });

  app.delete("/tenants/:tenantId/documents/:id", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { tenantId: string; id: string };
    await assertTenantAccess(request, params.tenantId, "document:write");

    const document = await prisma.tenantDocument.findUnique({
      where: { id: params.id }
    });

    if (!document || document.tenantId !== params.tenantId) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    await prisma.tenantDocument.delete({
      where: { id: params.id }
    });
    try {
      await storageProvider.deleteFile(document.storageKey);
    } catch (error) {
      request.log.error({ err: error, storageKey: document.storageKey }, "document storage cleanup failed");
    }

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
