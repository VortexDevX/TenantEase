import type { FastifyInstance } from "fastify";
import { assertPropertyAccess } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import "@fastify/multipart";
import { parse } from "csv-parse/sync";
import { createAuditLog } from "../common/audit.js";
import { assertRoomAvailability, lockRoom, recalculateRoom } from "./service.js";

const TEMPLATE_HEADERS = "fullName,phone,email,moveInDate,monthlyRent,depositPaid,roomNumber,emergencyContactName,emergencyContactPhone,emergencyContactRelation,aadhaarLast4,notes";
const TEMPLATE_EXAMPLE = "Rahul Sharma,9876543210,rahul@example.com,2023-11-01,8000.00,8000.00,101,Suresh Sharma,9876543200,Father,4567,Night shift";

function rupeesToPaisa(value: unknown) {
  const raw = String(value ?? "").trim().replace(/,/g, "");

  if (!/^\d+(\.\d{0,2})?$/.test(raw)) {
    return Number.NaN;
  }

  const [rupees, paise = ""] = raw.split(".");
  return Number(rupees) * 100 + Number(`${paise}00`.slice(0, 2));
}

export async function importTenantRoutes(app: FastifyInstance) {
  app.get("/properties/:propertyId/tenants/import/template", { preHandler: [app.authenticateOwnerOrStaff] }, async (request, reply) => {
    const params = request.params as { propertyId: string };
    await assertPropertyAccess(request, params.propertyId, "tenant:read");

    const csvData = `${TEMPLATE_HEADERS}\n${TEMPLATE_EXAMPLE}\n`;
    
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="tenants_template.csv"');
    return reply.send(csvData);
  });

  app.post("/properties/:propertyId/tenants/import", { preHandler: [app.authenticateOwnerOrStaff] }, async (request, reply) => {
    const params = request.params as { propertyId: string };
    const { ownerProfileId } = await assertPropertyAccess(request, params.propertyId, "tenant:write");

    const data = await request.file();
    if (!data) {
      throw new AppError(400, "VALIDATION_ERROR", "Upload a CSV file");
    }
    if (data.mimetype !== "text/csv" && data.mimetype !== "application/vnd.ms-excel") {
      throw new AppError(400, "VALIDATION_ERROR", "Only CSV files are accepted");
    }
    if (!data.filename.toLowerCase().endsWith(".csv")) {
      throw new AppError(400, "VALIDATION_ERROR", "File name must end in .csv");
    }

    const fileBuffer = await data.toBuffer();
    if (fileBuffer.includes(0)) {
      throw new AppError(400, "VALIDATION_ERROR", "CSV contains invalid binary content");
    }
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

        const monthlyRent = rupeesToPaisa(row.monthlyRent);
        if (isNaN(monthlyRent)) {
             errors.push({ row: rowNum, error: `Invalid monthly rent format` });
             continue;
        }
        
        let depositPaid = 0;
        if (row.depositPaid) {
            depositPaid = rupeesToPaisa(row.depositPaid);
            if (isNaN(depositPaid)) {
              errors.push({ row: rowNum, error: `Invalid deposit paid format` });
              continue;
            }
        }

        const moveInDate = new Date(row.moveInDate);
        if (isNaN(moveInDate.getTime())) {
            errors.push({ row: rowNum, error: `Invalid move in date format (YYYY-MM-DD expected)` });
            continue;
        }

        try {
            await prisma.$transaction(async (tx) => {
                await lockRoom(tx, room.id);
                await assertRoomAvailability(room.id, ownerProfileId, tx);
                const duplicate = await tx.tenant.findFirst({
                  where: { phone: String(row.phone), status: { in: ["ACTIVE", "NOTICE"] } },
                  select: { id: true }
                });
                if (duplicate) throw new AppError(409, "VALIDATION_ERROR", "Active tenant phone already exists");
                await tx.tenant.create({
                    data: {
                        propertyId: params.propertyId,
                        roomId: room.id,
                        fullName: row.fullName,
                        phone: row.phone,
                        email: row.email || null,
                        emergencyContactName: row.emergencyContactName || null,
                        emergencyContactPhone: row.emergencyContactPhone || null,
                        emergencyContactRelation: row.emergencyContactRelation || null,
                        aadhaarLast4: row.aadhaarLast4 || null,
                        notes: row.notes || null,
                        monthlyRent,
                        depositPaid,
                        moveInDate: moveInDate,
                        status: "ACTIVE"
                    }
                });

                await recalculateRoom(room.id, tx);
            });
            successCount++;
        } catch (dbErr: unknown) {
            errors.push({
              row: rowNum,
              error: dbErr instanceof AppError ? dbErr.message : "Unable to import this row"
            });
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
