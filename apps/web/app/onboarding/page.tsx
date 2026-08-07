"use client";

import { useState } from "react";
import { ArrowRight, Building2, Loader2, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "../../lib/api-client";
import { useAuth } from "../../contexts/AuthContext";

export default function OnboardingPage() {
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!displayName.trim() || !companyName.trim()) {
      setError("Enter your name and business name");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await fetchApi("/auth/complete-profile", {
        method: "PUT",
        body: JSON.stringify({
          displayName: displayName.trim(),
          companyName: companyName.trim()
        })
      });
      window.location.href = "/properties?setup=property";
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-soft">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-foreground">TenantEase</p>
              <p className="text-xs font-medium text-muted-foreground">Owner workspace setup</p>
            </div>
          </div>

          <div className="mt-10 max-w-lg">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-strong">Profile first</p>
            <h1 className="mt-4 text-5xl font-bold leading-tight tracking-tight text-foreground">
              Name workspace now. Add properties when ready.
            </h1>
            <p className="mt-5 text-base font-medium leading-7 text-muted-foreground">
              New tenant accounts never see this screen. Owner property setup now stays in Properties, where it belongs.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-float sm:p-8">
          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserCircle className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-strong">Owner profile</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Finish account setup</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
              We only need identity details. Property and room setup can happen later from dashboard.
            </p>
          </div>

          {error ? (
            <div className="mb-5 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
              <p className="text-sm font-semibold text-destructive">{error}</p>
            </div>
          ) : null}

          <form className="space-y-5" onSubmit={handleProfileSubmit}>
            <div>
              <label htmlFor="displayName" className="block text-sm font-semibold text-foreground">
                Full name
              </label>
              <input
                id="displayName"
                type="text"
                required
                className="mt-2 flex h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Rahul Sharma"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="companyName" className="block text-sm font-semibold text-foreground">
                Business or brand name
              </label>
              <input
                id="companyName"
                type="text"
                required
                className="mt-2 flex h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Sharma PG"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
            </div>

            <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3">
              <p className="text-xs font-medium leading-5 text-muted-foreground">
                Signed in as +91 {user?.phone ?? "your phone"}. Tenant and staff accounts skip owner setup automatically.
              </p>
            </div>

            <Button type="submit" disabled={loading} className="h-12 w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              {loading ? "Saving..." : "Continue to dashboard"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
