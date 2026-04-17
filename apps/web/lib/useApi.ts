"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchApi } from "./api-client";

interface UseApiOptions {
  enabled?: boolean;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Generic data-fetching hook for API endpoints.
 */
export function useApi<T>(path: string | null, options?: UseApiOptions): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const enabled = options?.enabled ?? true;
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async () => {
    const currentPath = pathRef.current;
    if (!currentPath || !enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<T>(currentPath);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load, path]);

  return { data, loading, error, refetch: load };
}
