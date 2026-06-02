import type { ApiSuccess } from "@tenantease/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("te_access_token");
}

export async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const controller = options.signal ? null : new AbortController();
  const timeout = controller ? globalThis.setTimeout(() => controller.abort(), 10000) : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? controller?.signal,
    });

    const json = await res.json();

    if (!res.ok || json.success === false) {
      throw new ApiError(
        res.status,
        json.error?.code ?? "UNKNOWN",
        json.error?.message ?? "Request failed",
        json.error?.details
      );
    }

    return (json as ApiSuccess<T>).data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(0, "NETWORK_TIMEOUT", "Server did not respond in time");
    }
    throw error;
  } finally {
    if (timeout) {
      globalThis.clearTimeout(timeout);
    }
  }
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}
