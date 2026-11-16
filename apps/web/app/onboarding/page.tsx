"use client";

import { useState } from "react";
import { ArrowRight, Loader2, UserRound } from "lucide-react";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireRole } from "@/contexts/AuthContext";
import { fetchApi } from "@/lib/api-client";

export default function OnboardingPage() {
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { authorized } = useRequireRole("OWNER");

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!displayName.trim() || !companyName.trim()) {
      setError("Enter your name and business name");
      return;
    }

    setLoading(true);
    try {
      await fetchApi("/auth/complete-profile", {
        method: "PUT",
        body: JSON.stringify({ displayName: displayName.trim(), companyName: companyName.trim() }),
      });
      window.location.assign("/properties?setup=property");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
      setLoading(false);
    }
  }

  if (!authorized) return null;

  return (
    <AuthFrame caption="Rooms, rent and residents. All in one place.">
      <div className="auth-intro">
        <span className="auth-icon"><UserRound size={22} aria-hidden="true" /></span>
        <h1>Set up your workspace</h1>
        <p>Add your name and the business name you use for your properties.</p>
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-destructive-soft p-3 text-sm text-destructive">{error}</p>}
      <form className="grid gap-4" onSubmit={saveProfile}>
        <div>
          <label className="mb-2 block text-sm font-semibold" htmlFor="displayName">Full name</label>
          <Input id="displayName" autoComplete="name" required className="h-12" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold" htmlFor="companyName">Business or brand name</label>
          <Input id="companyName" autoComplete="organization" required className="h-12" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
        </div>
        <Button type="submit" disabled={loading} className="h-12 w-full justify-between">
          {loading ? "Saving profile…" : "Continue to dashboard"}
          {loading ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
        </Button>
      </form>
    </AuthFrame>
  );
}
