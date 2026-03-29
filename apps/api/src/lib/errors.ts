import type { ApiErrorCode } from "@tenantease/types";

export class AppError extends Error {
  statusCode: number;
  code: ApiErrorCode;
  details?: unknown;

  constructor(statusCode: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

