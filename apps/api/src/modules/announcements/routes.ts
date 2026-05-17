import type { FastifyInstance } from "fastify";
import { requireOwnerProfileId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { assertPropertyOwnership } from "../common/owner.js";

export async function announcementRoutes(app: FastifyInstance) {
  // 13.1 List Announcements
  app.get("/properties/:propertyId/announcements", { preHandler: [app.authenticate] }, async (request, reply) => {
    const params = request.params as { propertyId: string };
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    
    await assertPropertyOwnership(params.propertyId, ownerProfileId);

    const announcements = await prisma.announcement.findMany({
      where: { propertyId: params.propertyId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { reads: true }
        }
      }
    });

    return ok(announcements.map(a => ({
      id: a.id,
      propertyId: a.propertyId,
      title: a.title,
      content: a.content,
      category: a.category,
      isImportant: a.isImportant,
      targetFloor: a.targetFloor,
      targetRoomId: a.targetRoomId,
      createdAt: a.createdAt,
      readCount: a._count.reads
    })));
  });

  // 13.2 Create Announcement
  app.post("/properties/:propertyId/announcements", { 
    preHandler: [app.authenticate] 
  }, async (request, reply) => {
    const params = request.params as { propertyId: string };
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    
    await assertPropertyOwnership(params.propertyId, ownerProfileId);

    const body = request.body as any; // Validation skipped to save lines
    if (!body.title || !body.content || !body.category) {
      throw new AppError(400, "VALIDATION_ERROR", "title, content, and category are required");
    }

    const targetFloor = body.targetFloor !== undefined ? Number(body.targetFloor) : null;
    const targetRoomId = body.targetRoomId || null;

    const announcement = await prisma.announcement.create({
      data: {
        propertyId: params.propertyId,
        title: body.title,
        content: body.content,
        category: body.category,
        isImportant: body.isImportant === true,
        targetFloor: isNaN(targetFloor as number) ? null : targetFloor,
        targetRoomId
      }
    });

    return reply.status(201).send(ok(announcement));
  });

  // 13.3 Update Announcement
  app.put("/announcements/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const params = request.params as { id: string };
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    
    const target = await prisma.announcement.findUnique({ where: { id: params.id } });
    if (!target) throw new AppError(404, "NOT_FOUND", "Announcement not found");

    await assertPropertyOwnership(target.propertyId, ownerProfileId);

    const body = request.body as any;
    
    const targetFloor = body.targetFloor !== undefined ? Number(body.targetFloor) : target.targetFloor;
    const targetRoomId = body.targetRoomId !== undefined ? body.targetRoomId : target.targetRoomId;

    const updated = await prisma.announcement.update({
      where: { id: params.id },
      data: {
        title: body.title !== undefined ? body.title : target.title,
        content: body.content !== undefined ? body.content : target.content,
        category: body.category !== undefined ? body.category : target.category,
        isImportant: body.isImportant !== undefined ? Boolean(body.isImportant) : target.isImportant,
        targetFloor: isNaN(targetFloor as number) ? null : targetFloor,
        targetRoomId: targetRoomId === "" ? null : targetRoomId,
      }
    });

    return ok(updated);
  });

  // 13.4 Delete Announcement
  app.delete("/announcements/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const params = request.params as { id: string };
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    
    const target = await prisma.announcement.findUnique({ where: { id: params.id } });
    if (!target) return ok({ success: true });

    await assertPropertyOwnership(target.propertyId, ownerProfileId);

    await prisma.announcement.delete({ where: { id: params.id } });
    return ok({ success: true });
  });
}
