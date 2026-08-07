import crypto from "node:crypto";

export function createOtpCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashValue(value: string, pepper: string) {
  return crypto.createHash("sha256").update(`${value}:${pepper}`).digest("hex");
}

export function createToken() {
  return crypto.randomBytes(32).toString("hex");
}
