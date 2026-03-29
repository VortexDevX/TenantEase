import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { env } from "../lib/env.js";

export type SentOtp = {
  phone: string;
  otpCode: string;
  challengeId: string;
};

class MockOtpProvider {
  lastSent: SentOtp[] = [];

  async send(phone: string, otpCode: string, challengeId: string) {
    this.lastSent.unshift({ phone, otpCode, challengeId });
    this.lastSent = this.lastSent.slice(0, 20);
    console.info(`[mock-otp] ${phone}: ${otpCode}`);
  }
}

class LocalStorageProvider {
  async saveBuffer(relativePath: string, buffer: Buffer) {
    const baseDir = path.resolve(process.cwd(), env.STORAGE_DIR);
    const target = path.resolve(baseDir, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return target;
  }

  async readBuffer(filePath: string) {
    return fs.readFile(filePath);
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
}

export const mockOtpProvider = new MockOtpProvider();
export const localStorageProvider = new LocalStorageProvider();
export const pdfProvider = new PdfProvider();

