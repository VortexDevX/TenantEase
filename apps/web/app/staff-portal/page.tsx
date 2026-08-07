"use client";

import Link from "next/link";
import { ShieldCheck, Building2, Loader2 } from "lucide-react";
import { useAuth, useRequireRole } from "@/contexts/AuthContext";
import { useApi } from "@/lib/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AuthUser } from "@tenantease/types";

export default function StaffPortalPage() {
  const { authorized } = useRequireRole("STAFF");
  const { user, isLoading, logout } = useAuth();
  const { data: profile, loading: profileLoading } = useApi<AuthUser>(authorized ? "/auth/me" : null);

  if (!authorized) return null;

  const assignments = profile?.staffAssignments ?? user?.staffAssignments ?? [];

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-soft md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Staff Portal</h1>
                <p className="text-sm font-medium text-muted-foreground">{user?.phone}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/profile"
              className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Profile
            </Link>
            <button
              type="button"
              onClick={logout}
              className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Log out
            </button>
          </div>
        </header>

        {isLoading || profileLoading ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : assignments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="font-semibold text-foreground">No active assignment found.</p>
              <p className="mt-2 text-sm text-muted-foreground">Ask owner to invite this phone number again.</p>
            </CardContent>
          </Card>
        ) : (
          <section className="grid gap-4 md:grid-cols-2">
            {assignments.map((assignment) => (
              <Card key={assignment.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3 text-lg">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      {assignment.propertyName}
                    </span>
                    <Badge>{assignment.role}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-secondary/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current access</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      Active property assignment with OTP login audit.
                    </p>
                  </div>
                  <Link
                    href="/"
                    className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Open operations dashboard
                  </Link>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
