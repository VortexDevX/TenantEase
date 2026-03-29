import crypto from "node:crypto";

export function createOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashValue(value: string, pepper: string) {
  return crypto.createHash("sha256").update(`${value}:${pepper}`).digest("hex");
}

export function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

