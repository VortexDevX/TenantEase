import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { env } from "../lib/env.js";

export interface IStorageProvider {
  saveBuffer(relativePath: string, buffer: Buffer): Promise<string>;
  readBuffer(filePath: string): Promise<Buffer>;
  deleteFile(filePath: string): Promise<void>;
}

class LocalStorageProvider implements IStorageProvider {
  private baseDir() {
    return path.resolve(process.cwd(), env.STORAGE_DIR);
  }

  private assertSafeRelativePath(relativePath: string) {
    if (path.isAbsolute(relativePath) || relativePath.includes("\0")) {
      throw new Error("Storage path must be a safe relative path");
    }

    const segments = relativePath.split(/[\\/]+/);
    if (segments.some((segment) => segment === ".." || segment === "")) {
      throw new Error("Storage path must not contain traversal segments");
    }
  }

  private resolveInsideBase(filePath: string) {
    const baseDir = this.baseDir();
    const target = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(baseDir, filePath);

    if (target !== baseDir && !target.startsWith(`${baseDir}${path.sep}`)) {
      throw new Error("Storage path escapes configured storage directory");
    }

    return target;
  }

  async saveBuffer(relativePath: string, buffer: Buffer) {
    this.assertSafeRelativePath(relativePath);
    const target = this.resolveInsideBase(relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return target;
  }

  async readBuffer(filePath: string) {
    return fs.readFile(this.resolveInsideBase(filePath));
  }

  async deleteFile(filePath: string) {
    await fs.rm(this.resolveInsideBase(filePath), { force: true });
  }
}

class PdfProvider {
  async createReceiptPdf(input: {
    receiptNumber: string;
    propertyName: string;
    tenantName: string;
    amount: number;
    paidAt: string;
    mode: string;
  }) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);

    page.drawText("TenantEase Receipt", {
      x: 48,
      y: 780,
      size: 24,
      font,
      color: rgb(0.08, 0.32, 0.34)
    });

    const lines = [
      `Receipt No: ${input.receiptNumber}`,
      `Property: ${input.propertyName}`,
      `Tenant: ${input.tenantName}`,
      `Amount: INR ${(input.amount / 100).toFixed(2)}`,
      `Paid At: ${input.paidAt}`,
      `Mode: ${input.mode}`
    ];

    lines.forEach((line, index) => {
      page.drawText(line, {
        x: 48,
        y: 725 - index * 28,
        size: 14,
        font
      });
    });

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  async createSettlementPdf(input: {
    tenantName: string;
    propertyName: string;
    vacatedAt: string;
    depositPaid: number;
    damageDeduction: number;
    pendingRent: number;
    refundAmount: number;
    refundStatus: string;
    finalNotes?: string | null;
  }) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

    page.drawText("TenantEase Final Settlement", {
      x: 48,
      y: 780,
      size: 22,
      font: boldFont,
      color: rgb(0.08, 0.32, 0.34)
    });

    const lines = [
      `Property: ${input.propertyName}`,
      `Tenant: ${input.tenantName}`,
      `Vacated At: ${input.vacatedAt}`,
      `Deposit Paid: INR ${(input.depositPaid / 100).toFixed(2)}`,
      `Damage Deduction: INR ${(input.damageDeduction / 100).toFixed(2)}`,
      `Pending Rent: INR ${(input.pendingRent / 100).toFixed(2)}`,
      `Refund Amount: INR ${(input.refundAmount / 100).toFixed(2)}`,
      `Refund Status: ${input.refundStatus}`,
      `Notes: ${input.finalNotes ?? "None"}`
    ];

    lines.forEach((line, index) => {
      page.drawText(line, {
        x: 48,
        y: 725 - index * 28,
        size: 13,
        font
      });
    });

    return Buffer.from(await doc.save());
  }
}

export const storageProvider: IStorageProvider = new LocalStorageProvider();
export const pdfProvider = new PdfProvider();
