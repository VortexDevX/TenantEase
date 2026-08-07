import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";
import { smsProvider } from "./sms-provider.js";

export type NotificationChannel = "SMS" | "WHATSAPP" | "EMAIL" | "IN_APP";

type NotificationRecipient = {
  phone?: string | null;
  email?: string | null;
};

interface NotificationProvider {
  send(channel: Exclude<NotificationChannel, "IN_APP">, recipient: NotificationRecipient, message: string): Promise<void>;
  assertConfigured(channels: NotificationChannel[]): void;
}

class HttpChannelProvider {
  private readonly endpoint: URL | undefined;

  constructor(
    url: string | undefined,
    private readonly authHeader: string | undefined,
    private readonly authValue: string | undefined
  ) {
    this.endpoint = url ? parseHttpEndpoint(url) : undefined;
  }

  async send(payload: Record<string, unknown>) {
    if (!this.endpoint) {
      throw new AppError(500, "CONFIG_ERROR", "Notification HTTP URL is required");
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.authHeader && this.authValue) {
      headers[this.authHeader] = this.authValue;
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      throw new AppError(503, "SMS_SERVICE_DOWN", "Notification provider failed");
    }
  }
}

function parseHttpEndpoint(url: string) {
  const endpoint = new URL(url);
  if (!["http:", "https:"].includes(endpoint.protocol)) {
    throw new AppError(500, "CONFIG_ERROR", "Notification HTTP URL must use http or https");
  }
  return endpoint;
}

class TenantEaseNotificationProvider implements NotificationProvider {
  private emailHttp = new HttpChannelProvider(env.EMAIL_HTTP_URL, env.EMAIL_HTTP_AUTH_HEADER, env.EMAIL_HTTP_AUTH_VALUE);
  private whatsappHttp = new HttpChannelProvider(env.WHATSAPP_HTTP_URL, env.WHATSAPP_HTTP_AUTH_HEADER, env.WHATSAPP_HTTP_AUTH_VALUE);

  assertConfigured(channels: NotificationChannel[]) {
    if (env.NODE_ENV !== "production") {
      return;
    }

    if (channels.includes("EMAIL") && (env.EMAIL_PROVIDER !== "http" || !env.EMAIL_HTTP_URL)) {
      throw new AppError(500, "CONFIG_ERROR", "EMAIL_HTTP_URL is required when email reminders are enabled in production");
    }

    if (channels.includes("WHATSAPP") && (env.WHATSAPP_PROVIDER !== "http" || !env.WHATSAPP_HTTP_URL)) {
      throw new AppError(500, "CONFIG_ERROR", "WHATSAPP_HTTP_URL is required when WhatsApp reminders are enabled in production");
    }

    if (channels.includes("SMS") && env.SMS_PROVIDER === "mock") {
      throw new AppError(500, "CONFIG_ERROR", "Production SMS reminders require a real SMS provider");
    }
  }

  async send(channel: Exclude<NotificationChannel, "IN_APP">, recipient: NotificationRecipient, message: string) {
    if (channel === "SMS") {
      if (!recipient.phone) throw new AppError(400, "VALIDATION_ERROR", "SMS recipient phone is required");
      await smsProvider.sendSms(recipient.phone, message);
      return;
    }

    if (channel === "EMAIL") {
      if (!recipient.email) throw new AppError(400, "VALIDATION_ERROR", "Email recipient address is required");
      if (env.EMAIL_PROVIDER === "http") {
        await this.emailHttp.send({ email: recipient.email, message, sender: "TenantEase" });
      } else {
        console.info(`[mock-email] To ${maskEmail(recipient.email)} length=${message.length}`);
      }
      return;
    }

    if (!recipient.phone) throw new AppError(400, "VALIDATION_ERROR", "WhatsApp recipient phone is required");
    if (env.WHATSAPP_PROVIDER === "http") {
      await this.whatsappHttp.send({ phone: toE164India(recipient.phone), message, sender: "TenantEase" });
    } else {
      console.info(`[mock-whatsapp] To ${maskPhone(recipient.phone)} length=${message.length}`);
    }
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

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain ?? "***"}`;
}

export const notificationProvider = new TenantEaseNotificationProvider();
