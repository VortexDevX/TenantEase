import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: "../../.env", quiet: true });
dotenv.config({ quiet: true });

if (process.env.NODE_ENV === "test") {
  const source = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
  if (!source) throw new Error("DATABASE_URL_TEST or DATABASE_URL is required for tests");
  const testUrl = new URL(source);
  if (!process.env.DATABASE_URL_TEST) {
    const database = testUrl.pathname.replace(/^\//, "");
    testUrl.pathname = `/${database.endsWith("_test") ? database : `${database}_test`}`;
  }
  if (!/test/i.test(testUrl.pathname)) throw new Error("Tests refuse to use a database without 'test' in its name");
  process.env.DATABASE_URL = testUrl.toString();
}

const optionalString = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const optionalHttpUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "URL must use http or https")
    .optional()
);
const optionalHttpHeaderName = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().regex(/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/, "Invalid HTTP header name").optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  OTP_PEPPER: z.string().min(32),
  CRON_SECRET: z.string().min(32).optional(),
  ADMIN_PHONES: z.string().optional(),
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default("0.0.0.0"),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  STORAGE_DIR: z.string().default("../../storage"),
  SMS_PROVIDER: z.enum(["mock", "textbelt", "http"]).default("mock"),
  SMS_API_KEY: optionalString,
  SMS_SENDER_NAME: z.string().default("TenantEase"),
  SMS_HTTP_URL: optionalHttpUrl,
  SMS_HTTP_AUTH_HEADER: optionalHttpHeaderName,
  SMS_HTTP_AUTH_VALUE: optionalString,
  EMAIL_PROVIDER: z.enum(["mock", "http"]).default("mock"),
  EMAIL_HTTP_URL: optionalHttpUrl,
  EMAIL_HTTP_AUTH_HEADER: optionalHttpHeaderName,
  EMAIL_HTTP_AUTH_VALUE: optionalString,
  WHATSAPP_PROVIDER: z.enum(["mock", "http"]).default("mock"),
  WHATSAPP_HTTP_URL: optionalHttpUrl,
  WHATSAPP_HTTP_AUTH_HEADER: optionalHttpHeaderName,
  WHATSAPP_HTTP_AUTH_VALUE: optionalString,
  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,
  RAZORPAY_PLAN_STARTER_ID: optionalString,
  RAZORPAY_PLAN_PRO_ID: optionalString,
  RAZORPAY_PLAN_BUSINESS_ID: optionalString
});

export const env = envSchema.parse(process.env);

if (env.NODE_ENV === "production") {
  const invalidSecrets = [env.JWT_ACCESS_SECRET, env.JWT_REFRESH_SECRET, env.OTP_PEPPER, env.CRON_SECRET]
    .filter((value): value is string => Boolean(value))
    .some((value) => /replace|change-this|example|local-only/i.test(value));

  const problems = [
    !env.CRON_SECRET ? "CRON_SECRET is required" : null,
    invalidSecrets ? "Production secrets must not use placeholder values" : null,
    new URL(env.WEB_URL).protocol !== "https:" ? "WEB_URL must use HTTPS" : null,
    env.SMS_PROVIDER !== "http" ? "Production SMS_PROVIDER must use the configured HTTP gateway" : null,
    !env.SMS_HTTP_URL ? "SMS_HTTP_URL is required in production" : null,
    env.RAZORPAY_KEY_ID !== undefined && !env.RAZORPAY_KEY_SECRET
      ? "RAZORPAY_KEY_SECRET is required when RAZORPAY_KEY_ID is set"
      : null,
    env.RAZORPAY_KEY_SECRET !== undefined && !env.RAZORPAY_KEY_ID
      ? "RAZORPAY_KEY_ID is required when RAZORPAY_KEY_SECRET is set"
      : null,
    env.RAZORPAY_KEY_ID && !env.RAZORPAY_WEBHOOK_SECRET
      ? "RAZORPAY_WEBHOOK_SECRET is required when Razorpay is enabled"
      : null
  ].filter((value): value is string => Boolean(value));

  if (problems.length > 0) {
    throw new Error(`Invalid production configuration: ${problems.join("; ")}`);
  }
}
