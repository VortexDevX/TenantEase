import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";

export interface SmsProvider {
  sendOtp(phone: string, otpCode: string, challengeId: string): Promise<void>;
  sendSms(phone: string, message: string, metadata?: Record<string, unknown>): Promise<void>;
}

class MockSmsProvider implements SmsProvider {
  async sendOtp(phone: string, otpCode: string, challengeId: string) {
    console.info(`[mock-otp] ${maskPhone(phone)} challenge=${challengeId}`);
    if (env.NODE_ENV !== "production") {
      console.info(`[mock-otp-code] ${otpCode}`);
    }
  }

  async sendSms(phone: string, message: string) {
    console.info(`[mock-sms] To ${maskPhone(phone)} length=${message.length}`);
  }
}

class TextbeltSmsProvider implements SmsProvider {
  async sendOtp(phone: string, otpCode: string) {
    await this.sendSms(phone, `Your TenantEase OTP is ${otpCode}. It expires in 5 minutes.`);
  }

  async sendSms(phone: string, message: string) {
    const response = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        phone: toE164India(phone),
        message,
        key: env.SMS_API_KEY || "textbelt",
        sender: env.SMS_SENDER_NAME
      })
    });
    const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;

    if (!response.ok || !payload?.success) {
      throw new AppError(503, "SMS_SERVICE_DOWN", payload?.error ?? "SMS provider failed");
    }
  }
}

class HttpSmsProvider implements SmsProvider {
  async sendOtp(phone: string, otpCode: string, challengeId: string) {
    await this.sendSms(phone, `Your TenantEase OTP is ${otpCode}. It expires in 5 minutes.`, {
      purpose: "otp",
      challengeId
    });
  }

  async sendSms(phone: string, message: string, metadata?: Record<string, unknown>) {
    if (!env.SMS_HTTP_URL) {
      throw new AppError(500, "CONFIG_ERROR", "SMS_HTTP_URL is required for HTTP SMS provider");
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (env.SMS_HTTP_AUTH_HEADER && env.SMS_HTTP_AUTH_VALUE) {
      headers[env.SMS_HTTP_AUTH_HEADER] = env.SMS_HTTP_AUTH_VALUE;
    }

    const response = await fetch(env.SMS_HTTP_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: toE164India(phone),
        message,
        sender: env.SMS_SENDER_NAME,
        metadata
      })
    });

    if (!response.ok) {
      throw new AppError(503, "SMS_SERVICE_DOWN", "SMS provider failed");
    }
  }
}

function createSmsProvider(): SmsProvider {
  switch (env.SMS_PROVIDER) {
    case "textbelt":
      return new TextbeltSmsProvider();
    case "http":
      return new HttpSmsProvider();
    case "mock":
    default:
      return new MockSmsProvider();
  }
}

function toE164India(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `***${digits.slice(-4)}` : "***";
}

export const smsProvider = createSmsProvider();
