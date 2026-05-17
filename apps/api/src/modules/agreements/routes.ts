import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import path from "path";
import fs from "fs";

const createAgreementSchema = z.object({
  templateType: z.string().default("pg"),
  state: z.string().optional(),
  startDate: z.string(), // ISO date
  endDate: z.string().optional(),
  duration: z.string().optional(),
  customClauses: z.array(z.string()).default([]),
});

export async function agreementRoutes(app: FastifyInstance) {

  // ─── POST /tenants/:tenantId/agreements ───
  // Generate a rental agreement PDF for a tenant
  app.post("/tenants/:tenantId/agreements", async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    const body = createAgreementSchema.parse(request.body);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        room: true,
        property: { include: { ownerProfile: true } },
      },
    });

    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");
    }

    // Build agreement data snapshot
    const agreementData = {
      tenant: {
        name: tenant.fullName,
        phone: tenant.phone,
        email: tenant.email,
      },
      property: {
        name: tenant.property.name,
        address: tenant.property.address,
        city: tenant.property.city,
        state: tenant.property.state,
      },
      room: {
        number: tenant.room.roomNumber,
        type: tenant.room.type,
        monthlyRent: tenant.monthlyRent,
        deposit: tenant.depositPaid,
      },
      terms: {
        templateType: body.templateType,
        state: body.state,
        startDate: body.startDate,
        endDate: body.endDate,
        duration: body.duration,
        customClauses: body.customClauses,
      },
    };

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    let page = pdfDoc.addPage([595, 842]); // A4
    const { height } = page.getSize();
    let y = height - 60;
    const leftMargin = 50;
    const lineHeight = 18;

    const drawText = (text: string, options?: { bold?: boolean; size?: number; indent?: number }) => {
      const sz = options?.size ?? 11;
      const f = options?.bold ? boldFont : font;
      const x = leftMargin + (options?.indent ?? 0);
      if (y < 60) {
        page = pdfDoc.addPage([595, 842]);
        y = height - 60;
      }
      page.drawText(text, { x, y, size: sz, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= lineHeight;
    };

    const drawLine = () => { y -= 6; };

    // Header
    drawText("RENTAL / PG ACCOMMODATION AGREEMENT", { bold: true, size: 16 });
    drawLine();
    drawText(`Template: ${body.templateType.toUpperCase()} | State: ${body.state || "General"}`, { size: 9 });
    drawLine();
    drawLine();

    // Parties
    drawText("1. PARTIES", { bold: true, size: 13 });
    drawLine();
    drawText(`Owner: ${tenant.property.ownerProfile?.displayName ?? "Property Owner"}`, { indent: 10 });
    drawText(`Property: ${tenant.property.name}`, { indent: 10 });
    drawText(`Address: ${tenant.property.address}, ${tenant.property.city}, ${tenant.property.state}`, { indent: 10 });
    drawLine();
    drawText(`Tenant: ${tenant.fullName}`, { indent: 10 });
    drawText(`Phone: ${tenant.phone}`, { indent: 10 });
    if (tenant.email) drawText(`Email: ${tenant.email}`, { indent: 10 });
    drawLine();

    // Room Details
    drawText("2. PREMISES", { bold: true, size: 13 });
    drawLine();
    drawText(`Room Number: ${tenant.room.roomNumber}`, { indent: 10 });
    drawText(`Room Type: ${tenant.room.type}`, { indent: 10 });
    drawText(`Monthly Rent: Rs. ${(tenant.monthlyRent / 100).toLocaleString("en-IN")}`, { indent: 10 });
    drawText(`Security Deposit: Rs. ${(tenant.depositPaid / 100).toLocaleString("en-IN")}`, { indent: 10 });
    drawLine();

    // Term
    drawText("3. TERM OF AGREEMENT", { bold: true, size: 13 });
    drawLine();
    drawText(`Start Date: ${body.startDate}`, { indent: 10 });
    if (body.endDate) drawText(`End Date: ${body.endDate}`, { indent: 10 });
    if (body.duration) drawText(`Duration: ${body.duration}`, { indent: 10 });
    drawLine();

    // Standard Clauses
    drawText("4. STANDARD TERMS", { bold: true, size: 13 });
    drawLine();
    const standardClauses = [
      "Rent is payable on or before the 1st of each month.",
      "Security deposit is refundable upon vacating, subject to deductions for damages.",
      "Either party may terminate with 30 days written notice.",
      "The tenant shall maintain the premises in good condition.",
      "Subletting is not permitted without prior written consent.",
      "The owner reserves the right of inspection with reasonable notice.",
    ];
    standardClauses.forEach((clause, i) => {
      drawText(`${i + 1}. ${clause}`, { indent: 10, size: 10 });
    });
    drawLine();

    // Custom Clauses
    if (body.customClauses.length > 0) {
      drawText("5. ADDITIONAL TERMS", { bold: true, size: 13 });
      drawLine();
      body.customClauses.forEach((clause, i) => {
        drawText(`${i + 1}. ${clause}`, { indent: 10, size: 10 });
      });
      drawLine();
    }

    // Signatures
    drawLine();
    drawLine();
    drawText("SIGNATURES", { bold: true, size: 13 });
    drawLine();
    drawLine();
    drawText("_________________________          _________________________");
    drawText("Owner Signature                              Tenant Signature", { size: 9 });
    drawLine();
    drawText(`Date: ${new Date().toLocaleDateString("en-IN")}`, { size: 9 });

    const pdfBytes = await pdfDoc.save();
    
    // Save PDF
    const pdfDir = path.join(process.cwd(), "storage", "agreements");
    fs.mkdirSync(pdfDir, { recursive: true });
    const fileName = `agreement-${tenantId}-${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);
    fs.writeFileSync(filePath, pdfBytes);

    // Save to DB
    const agreement = await prisma.agreement.create({
      data: {
        tenantId,
        propertyId: tenant.propertyId,
        templateType: body.templateType,
        state: body.state,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        duration: body.duration,
        customClauses: body.customClauses,
        agreementData,
        pdfPath: `/storage/agreements/${fileName}`,
        status: "draft",
      },
    });

    return reply.status(201).send(ok({
      id: agreement.id,
      pdfUrl: `/storage/agreements/${fileName}`,
      status: agreement.status,
    }));
  });

  // ─── GET /tenants/:tenantId/agreements ───
  // List agreements for a tenant
  app.get("/tenants/:tenantId/agreements", async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };

    const agreements = await prisma.agreement.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    const mapped = agreements.map((a) => ({
      id: a.id,
      tenantId: a.tenantId,
      propertyId: a.propertyId,
      templateType: a.templateType,
      state: a.state,
      startDate: a.startDate.toISOString(),
      endDate: a.endDate?.toISOString() ?? null,
      duration: a.duration,
      pdfUrl: a.pdfPath,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    }));

    return reply.send(ok(mapped));
  });

  // ─── GET /agreements/:agreementId/download ───
  // Download agreement PDF
  app.get("/agreements/:agreementId/download", async (request, reply) => {
    const { agreementId } = request.params as { agreementId: string };

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement || !agreement.pdfPath) {
      throw new AppError(404, "NOT_FOUND", "Agreement not found");
    }

    const absolutePath = path.join(process.cwd(), agreement.pdfPath);
    if (!fs.existsSync(absolutePath)) {
      throw new AppError(404, "NOT_FOUND", "Agreement PDF file not found");
    }

    const pdfBuffer = fs.readFileSync(absolutePath);
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="agreement-${agreementId}.pdf"`)
      .send(pdfBuffer);
  });
}
