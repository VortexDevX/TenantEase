import type { ApiSuccess, PaginationMeta } from "@tenantease/types";

export function ok<T>(data: T, meta?: PaginationMeta): ApiSuccess<T> {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {})
  };
}

