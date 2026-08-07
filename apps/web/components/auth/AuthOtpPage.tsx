"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Building2, KeyRound, Loader2, ReceiptText, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

type AuthMode = "signin" | "owner-register";

interface AuthOtpPageProps {
  mode: AuthMode;
}

const modeCopy: Record<AuthMode, {
  eyebrow: string;
  title: string;
  description: string;
  cardTitle: string;
  phoneHelp: string;
  verifyPath: string;
  footerText: string;
  switchText: string;
  switchHref: string;
  switchLabel: string;
}> = {
  signin: {
    eyebrow: "Sign in",
    title: "Open your rent ledger with one OTP.",
    description: "Owners, staff, tenants, and admins use the same simple sign-in. New phone numbers start as tenant accounts.",
    cardTitle: "Sign in with mobile",
    phoneHelp: "Use the phone number already linked to your account or invite.",
    verifyPath: "/auth/verify-otp",
    footerText: "Staff must use the exact phone invited by the owner. New owners should register instead.",
    switchText: "Starting as a property owner?",
    switchHref: "/register",
    switchLabel: "Create owner account"
  },
  "owner-register": {
    eyebrow: "Owner registration",
    title: "Create an owner workspace for your PG or rental.",
    description: "Use this only if you manage a property. Tenants and staff should sign in from the login page.",
    cardTitle: "Register as owner",
    phoneHelp: "This phone will become the owner login for your workspace.",
    verifyPath: "/auth/owner/verify-otp",
    footerText: "Tenants do not need to register here. Your owner or staff will add your room details later.",
    switchText: "Already have an account or staff invite?",
    switchHref: "/login",
    switchLabel: "Sign in instead"
  }
};

export function AuthOtpPage({ mode }: AuthOtpPageProps) {
  const copy = modeCopy[mode];
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleSendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const submittedPhone = String(new FormData(form).get("phone") ?? "").replace(/\D/g, "");
    setPhone(submittedPhone);

    if (submittedPhone.length !== 10) {
      setError("Phone number must be 10 digits");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetchApi<{ challengeId: string; debugOtp?: string }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone: submittedPhone })
      });
      setChallengeId(res.challengeId);
      setDebugOtp(res.debugOtp ?? "");
      if (res.debugOtp) setOtp(res.debugOtp);
      setStep("OTP");
    } catch (err: any) {
      setError(err.message || "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const submittedOtp = String(new FormData(form).get("otp") ?? "").replace(/\D/g, "");
    setOtp(submittedOtp);

    if (submittedOtp.length !== 6) {
      setError("OTP must be 6 digits");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetchApi<any>(copy.verifyPath, {
        method: "POST",
        body: JSON.stringify({ phone, otp: submittedOtp, challengeId })
      });
      login(res.accessToken, res.refreshToken, res.user, res.isNewUser);
    } catch (err: any) {
      setError(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden flex-col justify-between border-r border-border bg-card p-10 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-soft">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight text-foreground">TenantEase</p>
            <p className="text-sm font-medium text-muted-foreground">Digital rent register</p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-strong">{copy.eyebrow}</p>
          <h2 className="mt-4 text-5xl font-bold leading-tight tracking-tight text-foreground">{copy.title}</h2>
          <p className="mt-5 text-base font-medium leading-7 text-muted-foreground">{copy.description}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: ReceiptText, label: "Rent", value: "Status first" },
            { icon: ShieldCheck, label: "Access", value: "Role based" },
            { icon: Building2, label: "Rooms", value: "Owner managed" }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border border-border bg-secondary/40 p-4 shadow-card">
                <Icon className="h-5 w-5 text-primary" />
                <p className="mt-4 text-sm font-bold text-foreground">{item.label}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">{item.value}</p>
              </div>
            );
          })}
        </div>
      </section>

      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">TenantEase</p>
                <p className="text-xs font-medium text-muted-foreground">{copy.eyebrow}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-7">
            <div className="mb-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft text-primary">
                {step === "PHONE" ? <Smartphone className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
              </div>
              <h1 className="text-3xl font-bold tracking-[-0.04em] text-foreground">
                {step === "PHONE" ? copy.cardTitle : "Enter OTP"}
              </h1>
              <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
                {step === "PHONE" ? copy.phoneHelp : `Code sent to +91 ${phone}.`}
              </p>
            </div>

            {error ? (
              <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive-soft p-4">
                <p className="text-sm font-semibold text-destructive">{error}</p>
              </div>
            ) : null}

            {step === "PHONE" ? (
              <form className="space-y-6" onSubmit={handleSendOtp}>
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-foreground">
                    Mobile number
                  </label>
                  <div className="relative mt-2 rounded-lg shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-sm font-medium text-muted-foreground">+91</span>
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      required
                      maxLength={10}
                      inputMode="numeric"
                      className="flex h-12 w-full rounded-lg border border-input bg-background pl-12 pr-3 text-sm font-medium ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="99999 99999"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="h-12 w-full">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                  {loading ? "Sending OTP..." : "Send OTP"}
                </Button>
              </form>
            ) : (
              <form className="space-y-6" onSubmit={handleVerifyOtp}>
                <div>
                  <label htmlFor="otp" className="block text-sm font-semibold text-foreground">
                    6-digit OTP
                  </label>
                  <input
                    type="text"
                    id="otp"
                    name="otp"
                    required
                    maxLength={6}
                    inputMode="numeric"
                    autoFocus
                    className="mt-2 flex h-12 w-full rounded-lg border border-input bg-background px-3 text-center text-lg font-bold tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="------"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <Button type="submit" disabled={loading} className="h-12 w-full">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  {loading ? "Verifying..." : mode === "owner-register" ? "Create owner account" : "Sign in"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("PHONE");
                    setOtp("");
                    setDebugOtp("");
                    setError("");
                  }}
                  className="h-11 w-full rounded-lg text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  Change mobile number
                </button>
              </form>
            )}

            {step === "OTP" && debugOtp ? (
              <div className="mt-4 rounded-lg border border-success/20 bg-success-soft px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-success">Local debug OTP</p>
                <p className="mt-1 text-base font-bold tabular-nums text-foreground">{debugOtp}</p>
              </div>
            ) : null}

            <div className="mt-6 rounded-lg border border-border bg-secondary/40 px-4 py-3">
              <p className="text-xs font-medium leading-5 text-muted-foreground">{copy.footerText}</p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-border bg-card px-4 py-3 text-center shadow-card">
            <p className="text-sm font-medium text-muted-foreground">
              {copy.switchText}{" "}
              <Link href={copy.switchHref} className="font-bold text-primary-strong hover:text-primary">
                {copy.switchLabel}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
