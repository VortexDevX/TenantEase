"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { clearAuthTokens, fetchApi, storeAuthTokens } from "../lib/api-client";

type Role = "ADMIN" | "OWNER" | "STAFF" | "TENANT";

interface User {
  id: string;
  phone: string;
  role: Role;
  displayName?: string | null;
  companyName?: string | null;
  ownerProfileId?: string | null;
  tenantId?: string | null;
  propertyId?: string | null;
  fullName?: string | null;
  hasBooking?: boolean;
  staffAssignments?: Array<{
    id: string;
    propertyId: string;
    propertyName: string;
    role: "MANAGER" | "ACCOUNTANT" | "WARDEN";
  }>;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string | undefined, user: User, isNewUser: boolean) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_PATHS = ["/login"];

function roleHomePath(role: Role): string {
  switch (role) {
    case "ADMIN": return "/admin";
    case "OWNER": return "/";
    case "STAFF": return "/staff-portal";
    case "TENANT": return "/tenant";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const initAuth = async () => {
      const currentPath = pathname || (typeof window !== "undefined" ? window.location.pathname : "");
      const token = localStorage.getItem("te_access_token");
      if (PUBLIC_PATHS.includes(currentPath)) {
        setIsLoading(false);
        if (token) {
          try {
            const userData = await fetchApi<User>("/auth/me");
            setUser(userData);
            router.replace(roleHomePath(userData.role));
          } catch {
            clearAuthTokens();
            setUser(null);
          }
        }
        return;
      }

      if (!token) {
        setIsLoading(false);
        router.replace("/login");
        return;
      }

      try {
        const userData = await fetchApi<User>("/auth/me");
        setUser(userData);

        if (userData.role === "OWNER" && !userData.displayName && currentPath !== "/onboarding") {
          router.replace("/onboarding");
        }
      } catch {
        clearAuthTokens();
        setUser(null);
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [pathname, router]);

  const login = useCallback((accessToken: string, refreshToken: string | undefined, userData: User, isNewUser: boolean) => {
    storeAuthTokens(accessToken, refreshToken);
    setUser(userData);

    if (userData.role === "OWNER" && (isNewUser || !userData.displayName)) {
      router.push("/onboarding");
    } else {
      router.push(roleHomePath(userData.role));
    }
  }, [router]);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem("te_refresh_token");
    if (refreshToken) {
      await fetchApi("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken })
      }).catch(() => undefined);
    }
    clearAuthTokens();
    setUser(null);
    router.push("/login");
  }, [router]);

  const renderPath = pathname || (typeof window !== "undefined" ? window.location.pathname : "");

  if (isLoading && !PUBLIC_PATHS.includes(renderPath)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Hook to enforce role-based access on a page.
 * Automatically redirects users with the wrong role to their home.
 */
export function useRequireRole(requiredRole: Role) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && user.role !== requiredRole) {
      router.replace(roleHomePath(user.role));
    }
  }, [user, isLoading, requiredRole, router]);

  return { authorized: !isLoading && user?.role === requiredRole, user };
}
