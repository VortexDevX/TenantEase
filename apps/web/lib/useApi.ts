"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "./api-client";

interface RequestState<T> {
  path: string;
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function useApi<T>(path: string | null, options?: { enabled?: boolean }) {
  const requestPath = options?.enabled === false ? null : path;
  const [request, setRequest] = useState<RequestState<T> | null>(null);
  const [revision, setRevision] = useState(0);
  const refetch = useCallback(() => setRevision((current) => current + 1), []);

  useEffect(() => {
    if (!requestPath) {
      setRequest(null);
      return;
    }

    const controller = new AbortController();
    setRequest((current) => ({
      path: requestPath,
      data: current?.path === requestPath ? current.data : null,
      error: null,
      loading: true,
    }));

    fetchApi<T>(requestPath, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setRequest({ path: requestPath, data, error: null, loading: false });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setRequest({
            path: requestPath,
            data: null,
            error: error instanceof Error ? error.message : "Request failed",
            loading: false,
          });
        }
      },
    );

    return () => controller.abort();
  }, [requestPath, revision]);

  const current = request?.path === requestPath ? request : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: Boolean(requestPath) && (current?.loading ?? true),
    refetch,
    mutate: refetch,
  };
}
