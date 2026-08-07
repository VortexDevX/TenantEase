import type { ApiSuccess } from "@tenantease/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const API_BASE_URL = createApiBaseUrl(API_BASE);
const ACCESS_TOKEN_KEY = "te_access_token";
const REFRESH_TOKEN_KEY = "te_refresh_token";
let accessTokenMemory: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

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
  return accessTokenMemory;
}

function createApiBaseUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("NEXT_PUBLIC_API_URL must use http or https");
  }
  return url;
}

function apiUrl(path: string) {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\0")) {
    throw new ApiError(400, "INVALID_API_PATH", "API path must be a relative path");
  }
  return new URL(path, API_BASE_URL);
}

export function storeAuthTokens(accessToken: string, refreshToken?: string | null) {
  accessTokenMemory = accessToken;
  if (typeof window !== "undefined") {
    // Remove legacy JS-readable sessions during migration to HttpOnly refresh cookies.
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function clearAuthTokens() {
  accessTokenMemory = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = performRefresh();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function performRefresh(): Promise<string | null> {
  const res = await fetch(apiUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({})
  });
  const json = await res.json().catch(() => null);

  if (!res.ok || json?.success === false || !json?.data?.accessToken) {
    clearAuthTokens();
    return null;
  }

  storeAuthTokens(json.data.accessToken);
  return json.data.accessToken;
}

function shouldRefresh(path: string, status: number, code: string) {
  return (
    status === 401 &&
    !["/auth/refresh", "/auth/send-otp", "/auth/verify-otp", "/auth/owner/verify-otp", "/auth/tenant/verify-otp"].includes(path) &&
    (code === "AUTH_INVALID_TOKEN" || code === "AUTH_TOKEN_EXPIRED")
  );
}

function handleInvalidSession(path: string, status: number, code: string) {
  if (status !== 401 || path.startsWith("/auth/") || code !== "AUTH_INVALID_TOKEN") return;
  clearAuthTokens();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

function requestSignal(options: RequestInit) {
  const controller = options.signal ? null : new AbortController();
  const timeout = controller ? globalThis.setTimeout(() => controller.abort(), 10000) : null;

  return {
    signal: options.signal ?? controller?.signal,
    cleanup: () => {
      if (timeout) {
        globalThis.clearTimeout(timeout);
      }
    }
  };
}

function requestHeaders(options: RequestInit, includeJsonContentType: boolean) {
  const token = getAuthToken();

  return {
    ...(includeJsonContentType ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined)
  };
}

async function retryAfterRefresh<T>(
  path: string,
  status: number,
  code: string,
  hasRetried: boolean,
  retry: () => Promise<T>
) {
  if (hasRetried || !shouldRefresh(path, status, code)) {
    return null;
  }

  return (await refreshAccessToken()) ? retry() : null;
}

function throwApiError(status: number, code: string, message?: string, details?: unknown): never {
  throw new ApiError(status, code, message ?? "Request failed", details);
}

function rethrowNetworkError(error: unknown): never {
  if (error instanceof DOMException && error.name === "AbortError") {
    throw new ApiError(0, "NETWORK_TIMEOUT", "Server did not respond in time");
  }
  throw error;
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
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const { signal, cleanup } = requestSignal(options);

  try {
    const res = await fetch(apiUrl(path), {
      ...options,
      headers: requestHeaders(options, !isFormData),
      credentials: "include",
      signal
    });

    const json = await res.json();

    if (res.ok && json.success !== false) {
      return (json as ApiSuccess<T>).data;
    }

    const code = json.error?.code ?? "UNKNOWN";
    const retryResult = await retryAfterRefresh(path, res.status, code, hasRetried, () =>
      fetchApiInternal<T>(path, options, true)
    );
    if (retryResult !== null) return retryResult;

    handleInvalidSession(path, res.status, code);
    return throwApiError(res.status, code, json.error?.message, json.error?.details);
  } catch (error) {
    return rethrowNetworkError(error);
  } finally {
    cleanup();
  }
}

export async function fetchApiBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  return fetchApiBlobInternal(path, options, false);
}

export async function openApiBlob(path: string, suggestedName?: string) {
  const blob = await fetchApiBlob(path);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.rel = "noopener";
  if (suggestedName) link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

async function fetchApiBlobInternal(path: string, options: RequestInit = {}, hasRetried: boolean): Promise<Blob> {
  const { signal, cleanup } = requestSignal(options);

  try {
    const res = await fetch(apiUrl(path), {
      ...options,
      headers: requestHeaders(options, false),
      credentials: "include",
      signal
    });

    if (res.ok) {
      return res.blob();
    }

    const json = await res.json().catch(() => null);
    const code = json?.error?.code ?? "UNKNOWN";
    const retryResult = await retryAfterRefresh(path, res.status, code, hasRetried, () =>
      fetchApiBlobInternal(path, options, true)
    );
    if (retryResult !== null) return retryResult;

    handleInvalidSession(path, res.status, code);
    return throwApiError(res.status, code, json?.error?.message, json?.error?.details);
  } catch (error) {
    return rethrowNetworkError(error);
  } finally {
    cleanup();
  }
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}
