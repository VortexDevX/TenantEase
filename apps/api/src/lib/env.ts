import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: "../../.env" });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  OTP_PEPPER: z.string().min(16),
  CRON_SECRET: z.string().min(16).optional(),
  ADMIN_PHONES: z.string().optional(),
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default("0.0.0.0"),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  STORAGE_DIR: z.string().default("../../storage")
});

export const env = envSchema.parse(process.env);
