"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchApi } from "../lib/api-client";

type Role = "ADMIN" | "OWNER" | "TENANT";

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
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User, isNewUser: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_PATHS = ["/login"];

function roleHomePath(role: Role): string {
  switch (role) {
    case "ADMIN": return "/admin";
    case "OWNER": return "/";
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
      const token = localStorage.getItem("te_access_token");
      if (!token) {
        setIsLoading(false);
        if (!PUBLIC_PATHS.includes(pathname)) {
          router.replace("/login");
        }
        return;
      }

      try {
        const userData = await fetchApi<User>("/auth/me");
        setUser(userData);

        if (PUBLIC_PATHS.includes(pathname)) {
          router.replace(roleHomePath(userData.role));
        } else if (userData.role === "OWNER" && !userData.displayName && pathname !== "/onboarding") {
          router.replace("/onboarding");
        }
      } catch {
        localStorage.removeItem("te_access_token");
        setUser(null);
        if (!PUBLIC_PATHS.includes(pathname)) {
          router.replace("/login");
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [pathname, router]);

  const login = useCallback((token: string, userData: User, isNewUser: boolean) => {
    localStorage.setItem("te_access_token", token);
    setUser(userData);

    if (userData.role === "OWNER" && (isNewUser || !userData.displayName)) {
      router.push("/onboarding");
    } else {
      router.push(roleHomePath(userData.role));
    }
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem("te_access_token");
    setUser(null);
    router.push("/login");
  }, [router]);

  if (isLoading) {
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
