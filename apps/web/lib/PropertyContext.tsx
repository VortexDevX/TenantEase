"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { PropertyDto } from "@tenantease/types";
import { fetchApi } from "./api-client";

interface PropertyContextValue {
  properties: PropertyDto[];
  activeProperty: PropertyDto | null;
  setActivePropertyId: (id: string) => void;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const PropertyContext = createContext<PropertyContextValue>({
  properties: [],
  activeProperty: null,
  setActivePropertyId: () => {},
  loading: true,
  error: null,
  refetch: () => {},
});

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const [properties, setProperties] = useState<PropertyDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<PropertyDto[]>("/properties");
      setProperties(data);
      if (data.length === 0) {
        setActiveId(null);
        return;
      }

      const storedId = typeof window !== "undefined" ? window.localStorage.getItem("te_active_property_id") : null;
      const preferredId = activeId ?? storedId;
      const hasPreferred = preferredId ? data.some((property) => property.id === preferredId) : false;

      if (hasPreferred) {
        setActiveId(preferredId);
      } else {
        setActiveId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load properties");
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (activeId) {
      window.localStorage.setItem("te_active_property_id", activeId);
    } else {
      window.localStorage.removeItem("te_active_property_id");
    }
  }, [activeId]);

  const activeProperty = properties.find((p) => p.id === activeId) ?? null;

  return (
    <PropertyContext.Provider
      value={{
        properties,
        activeProperty,
        setActivePropertyId: setActiveId,
        loading,
        error,
        refetch: load,
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  return useContext(PropertyContext);
}
