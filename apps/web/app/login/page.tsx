"use client";

import { useState } from "react";
import { ArrowRight, Building2, KeyRound, Loader2, ReceiptText, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "../../lib/api-client";
import { useAuth } from "../../contexts/AuthContext";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const submittedPhone = String(new FormData(form).get("phone") ?? "").replace(/\D/g, "");
    setPhone(submittedPhone);

    if (submittedPhone.length !== 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetchApi<{ challengeId: string; debugOtp?: string }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone: submittedPhone }),
      });
      setChallengeId(res.challengeId);
      setDebugOtp(res.debugOtp ?? "");
      if (res.debugOtp) {
        setOtp(res.debugOtp);
      }
      setStep("OTP");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const submittedOtp = String(new FormData(form).get("otp") ?? "").replace(/\D/g, "");
    setOtp(submittedOtp);

    if (submittedOtp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetchApi<any>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, otp: submittedOtp, challengeId }),
      });
      login(res.accessToken, res.refreshToken, res.user, res.isNewUser);
    } catch (err: any) {
      setError(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden lg:flex flex-col justify-between border-r border-border bg-card p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-soft">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">TenantEase</p>
            <p className="text-sm font-medium text-muted-foreground">PG access for tenants and owners</p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-strong">Owner and tenant portal</p>
          <h1 className="mt-4 text-5xl font-bold leading-tight tracking-tight text-foreground">
            Rent, rooms, receipts, and requests in one steady workspace.
          </h1>
          <p className="mt-5 text-base font-medium leading-7 text-muted-foreground">
            Sign in with phone OTP. New phones start as tenant accounts; owners are upgraded from admin or seeded owner records.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: ReceiptText, label: "Receipts", value: "Auto PDFs" },
            { icon: ShieldCheck, label: "Access", value: "Role based" },
            { icon: Building2, label: "Properties", value: "Multi PG" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-xl border border-border bg-secondary/40 p-4">
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
                <p className="text-lg font-bold">TenantEase</p>
                <p className="text-xs font-medium text-muted-foreground">PG command center</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-float sm:p-7">
          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {step === "PHONE" ? <Smartphone className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {step === "PHONE" ? "Sign in with mobile" : "Enter OTP"}
            </h2>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              {step === "PHONE"
                ? "Use your 10-digit Indian mobile number."
                : `Code sent to +91 ${phone}.`}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          )}

          {step === "PHONE" ? (
            <form className="space-y-6" onSubmit={handleSendOtp}>
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-foreground">
                  Mobile Number
                </label>
                <div className="mt-2 relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-muted-foreground sm:text-sm">+91</span>
                  </div>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    maxLength={10}
                    className="flex h-12 w-full rounded-lg border border-input bg-background pl-12 pr-3 py-2 text-sm font-medium ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="99999 99999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                {loading ? "Sending OTP..." : "Continue"}
              </Button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleVerifyOtp}>
              <div>
                <label htmlFor="otp" className="block text-sm font-semibold text-foreground">
                  Enter 6-digit OTP
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="otp"
                    name="otp"
                    required
                    maxLength={6}
                    autoFocus
                    className="flex h-12 w-full text-center text-lg font-bold rounded-lg border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="------"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </Button>
                <button
                  type="button"
                    onClick={() => {
                      setStep("PHONE");
                      setOtp("");
                      setDebugOtp("");
                      setError("");
                    }}
                  className="w-full py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Change Mobile Number
                </button>
              </div>
            </form>
          )}

          {step === "OTP" && debugOtp ? (
            <div className="mt-4 rounded-lg border border-success/20 bg-success/10 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-success">Local Debug OTP</p>
              <p className="mt-1 text-base font-bold text-foreground">{debugOtp}</p>
            </div>
          ) : null}

          <div className="mt-6 rounded-lg border border-border bg-secondary/40 px-4 py-3">
            <p className="text-xs font-medium leading-5 text-muted-foreground">
              New accounts start as tenants. Owners and admins are matched from existing records.
            </p>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
