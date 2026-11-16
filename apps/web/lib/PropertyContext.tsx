"use client";

import { createContext, useContext, useState } from "react";
import type { PropertyDto, StaffRole } from "@tenantease/types";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "./useApi";

interface PropertyContextValue {
  properties: PropertyDto[];
  activeProperty: PropertyDto | null;
  staffRole: StaffRole | undefined;
  setActivePropertyId: (id: string) => void;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const PropertyContext = createContext<PropertyContextValue | null>(null);

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const accountId = user?.role === "STAFF" || (user?.role === "OWNER" && user.displayName) ? user.id : null;

  return <AccountProperties key={accountId} accountId={accountId}>{children}</AccountProperties>;
}

function AccountProperties({ accountId, children }: { accountId: string | null; children: React.ReactNode }) {
  const { user } = useAuth();
  const storageKey = accountId ? `te_active_property_id:${accountId}` : null;
  const [activeId, setActiveId] = useState(() => {
    return storageKey && typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
  });
  const { data, loading, error, refetch } = useApi<PropertyDto[]>(accountId ? "/properties" : null);
  const properties = data ?? [];
  const activeProperty = properties.find((property) => property.id === activeId) ?? properties[0] ?? null;
  const staffRole = user?.staffAssignments?.find((assignment) => assignment.propertyId === activeProperty?.id)?.role;

  function setActivePropertyId(id: string) {
    if (!properties.some((property) => property.id === id)) return;
    setActiveId(id);
    if (storageKey) window.localStorage.setItem(storageKey, id);
  }

  return (
    <PropertyContext.Provider value={{ properties, activeProperty, staffRole, setActivePropertyId, loading, error, refetch }}>
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  const context = useContext(PropertyContext);
  if (!context) throw new Error("useProperty must be used within PropertyProvider");
  return context;
}
