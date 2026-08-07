import { timingSafeEqual } from "node:crypto";
import { env } from "./env.js";
import { AppError } from "./errors.js";

function cronSecret() {
  if (env.CRON_SECRET) return env.CRON_SECRET;
  if (env.NODE_ENV === "production") throw new AppError(500, "CONFIG_ERROR", "CRON_SECRET is required in production");
  return "local_dev_cron_secret";
}

export function requireCronAuth(header: string | undefined) {
  const expected = Buffer.from(`Bearer ${cronSecret()}`);
  const received = Buffer.from(header ?? "");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new AppError(401, "AUTH_FORBIDDEN", "Unauthorized system access");
  }
}
