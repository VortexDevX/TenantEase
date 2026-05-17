import type { FastifyInstance } from "fastify";
import { requireOwnerProfileId } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { assertPropertyOwnership } from "../common/owner.js";
import "@fastify/multipart";
import { parse } from "csv-parse/sync";
import { createAuditLog } from "../common/audit.js";

const TEMPLATE_HEADERS = "fullName,phone,email,moveInDate,monthlyRent,depositPaid,roomNumber";
const TEMPLATE_EXAMPLE = "Rahul Sharma,9876543210,rahul@example.com,2023-11-01,8000,8000,101";

export async function importTenantRoutes(app: FastifyInstance) {
  app.get("/properties/:propertyId/tenants/import/template", { preHandler: [app.authenticate] }, async (request, reply) => {
    const params = request.params as { propertyId: string };
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    await assertPropertyOwnership(params.propertyId, ownerProfileId);

    const csvData = `${TEMPLATE_HEADERS}\n${TEMPLATE_EXAMPLE}\n`;
    
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="tenants_template.csv"');
    return reply.send(csvData);
  });

  app.post("/properties/:propertyId/tenants/import", { preHandler: [app.authenticate] }, async (request, reply) => {
    const params = request.params as { propertyId: string };
    const ownerProfileId = requireOwnerProfileId(request.user.ownerProfileId);
    await assertPropertyOwnership(params.propertyId, ownerProfileId);

    const data = await request.file();
    if (!data) {
      throw new AppError(400, "VALIDATION_ERROR", "Upload a CSV file");
    }

    const fileBuffer = await data.toBuffer();
    const csvString = fileBuffer.toString("utf-8");

    let records: any[];
    try {
      records = parse(csvString, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (e: any) {
      throw new AppError(400, "VALIDATION_ERROR", `Failed to parse CSV: ${e.message}`);
    }

    if (records.length > 200) {
      throw new AppError(400, "VALIDATION_ERROR", "Maximum 200 rows allowed per import.");
    }

    // Pre-fetch rooms to map roomNumber -> roomId
    const propertyRooms = await prisma.room.findMany({
      where: { propertyId: params.propertyId },
    });
    const roomMap = new Map(propertyRooms.map(r => [String(r.roomNumber), r]));

    const errors: { row: number; error: string }[] = [];
    let successCount = 0;

    for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2; // +1 for 0-index, +1 for header

        if (!row.fullName || !row.phone || !row.monthlyRent || !row.moveInDate || !row.roomNumber) {
            errors.push({ row: rowNum, error: "Missing required fields (fullName, phone, monthlyRent, moveInDate, roomNumber)" });
            continue;
        }

        const room = roomMap.get(String(row.roomNumber));
        if (!room) {
            errors.push({ row: rowNum, error: `Room ${row.roomNumber} does not exist in this property` });
            continue;
        }

        if (room.occupiedBeds >= room.bedCount) {
             errors.push({ row: rowNum, error: `Room ${row.roomNumber} is full` });
             continue;
        }

        const monthlyRent = parseInt(row.monthlyRent) * 100;
        if (isNaN(monthlyRent)) {
             errors.push({ row: rowNum, error: `Invalid monthly rent format` });
             continue;
        }
        
        let depositPaid = 0;
        if (row.depositPaid) {
            depositPaid = parseInt(row.depositPaid) * 100;
            if (isNaN(depositPaid)) depositPaid = 0;
        }

        const moveInDate = new Date(row.moveInDate);
        if (isNaN(moveInDate.getTime())) {
            errors.push({ row: rowNum, error: `Invalid move in date format (YYYY-MM-DD expected)` });
            continue;
        }

        try {
            await prisma.$transaction(async (tx) => {
                await tx.tenant.create({
                    data: {
                        propertyId: params.propertyId,
                        roomId: room.id,
                        fullName: row.fullName,
                        phone: row.phone,
                        email: row.email || null,
                        monthlyRent,
                        depositPaid,
                        moveInDate: moveInDate,
                        status: "ACTIVE"
                    }
                });

                // update local room occupancy tracking
                room.occupiedBeds += 1;
                
                await tx.room.update({
                    where: { id: room.id },
                    data: {
                        occupiedBeds: room.occupiedBeds,
                        status: room.occupiedBeds >= room.bedCount ? "OCCUPIED" : "PARTIAL"
                    }
                });
            });
            successCount++;
        } catch (dbErr: any) {
            errors.push({ row: rowNum, error: `Failed to insert tenant: ${dbErr.message}` });
        }
    }

    if (successCount > 0) {
        await createAuditLog({
            userId: request.user.sub,
            action: "tenant.bulk_import",
            resource: "Property",
            resourceId: params.propertyId,
            payload: { successCount, errorsCount: errors.length },
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"]?.toString()
        });
    }

    return ok({
        successCount,
        errors,
        total: records.length
    });
  });
}
