import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { env } from "../lib/env.js";
import { smsProvider } from "./sms-provider.js";

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
    console.info(`[mock-otp] ${maskPhone(phone)} challenge=${challengeId}`);
  }
}

class MockNotificationProvider {
  async sendSms(phone: string, message: string) {
    await smsProvider.sendSms(phone, message);
  }

  async sendWhatsApp(phone: string, message: string) {
    console.info(`[mock-whatsapp] To ${maskPhone(phone)} length=${message.length}`);
  }
}

export interface IStorageProvider {
  saveBuffer(relativePath: string, buffer: Buffer): Promise<string>;
  readBuffer(filePath: string): Promise<Buffer>;
}

class LocalStorageProvider implements IStorageProvider {
  private baseDir() {
    return path.resolve(process.cwd(), env.STORAGE_DIR);
  }

  private resolveInsideBase(filePath: string) {
    const baseDir = this.baseDir();
    const target = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(baseDir, filePath);

    if (target !== baseDir && !target.startsWith(`${baseDir}${path.sep}`)) {
      throw new Error("Storage path escapes configured storage directory");
    }

    return target;
  }

  async saveBuffer(relativePath: string, buffer: Buffer) {
    const target = this.resolveInsideBase(relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return target;
  }

  async readBuffer(filePath: string) {
    return fs.readFile(this.resolveInsideBase(filePath));
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
export const storageProvider: IStorageProvider = new LocalStorageProvider();
export const pdfProvider = new PdfProvider();
export const notificationProvider = new MockNotificationProvider();

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `***${digits.slice(-4)}` : "***";
}
