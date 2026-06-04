import type { ApiSuccess } from "@tenantease/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ACCESS_TOKEN_KEY = "te_access_token";
const REFRESH_TOKEN_KEY = "te_refresh_token";

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
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeAuthTokens(accessToken: string, refreshToken?: string | null) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });
  const json = await res.json().catch(() => null);

  if (!res.ok || json?.success === false || !json?.data?.accessToken) {
    clearAuthTokens();
    return null;
  }

  storeAuthTokens(json.data.accessToken, json.data.refreshToken);
  return json.data.accessToken;
}

function shouldRefresh(path: string, status: number, code: string) {
  return (
    status === 401 &&
    !path.startsWith("/auth/") &&
    (code === "AUTH_INVALID_TOKEN" || code === "AUTH_TOKEN_EXPIRED")
  );
}

export async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  return fetchApiInternal<T>(path, options, false);
}

async function fetchApiInternal<T>(
  path: string,
  options: RequestInit = {},
  hasRetried: boolean
): Promise<T> {
  const token = getAuthToken();
  const controller = options.signal ? null : new AbortController();
  const timeout = controller ? globalThis.setTimeout(() => controller.abort(), 10000) : null;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
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
      const code = json.error?.code ?? "UNKNOWN";
      if (!hasRetried && shouldRefresh(path, res.status, code)) {
        const nextToken = await refreshAccessToken();
        if (nextToken) {
          return fetchApiInternal<T>(path, options, true);
        }
      }

      throw new ApiError(
        res.status,
        code,
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

export async function fetchApiBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  return fetchApiBlobInternal(path, options, false);
}

async function fetchApiBlobInternal(path: string, options: RequestInit = {}, hasRetried: boolean): Promise<Blob> {
  const token = getAuthToken();
  const controller = options.signal ? null : new AbortController();
  const timeout = controller ? globalThis.setTimeout(() => controller.abort(), 10000) : null;
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? controller?.signal,
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const code = json?.error?.code ?? "UNKNOWN";
      if (!hasRetried && shouldRefresh(path, res.status, code)) {
        const nextToken = await refreshAccessToken();
        if (nextToken) {
          return fetchApiBlobInternal(path, options, true);
        }
      }

      throw new ApiError(
        res.status,
        code,
        json?.error?.message ?? "Request failed",
        json?.error?.details
      );
    }

    return res.blob();
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
