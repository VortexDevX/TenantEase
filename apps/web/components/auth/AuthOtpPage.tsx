"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Loader2, LockKeyhole } from "lucide-react";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

type VerifyResult = {
  accessToken: string;
  refreshToken?: string;
  user: Parameters<ReturnType<typeof useAuth>["login"]>[2];
  isNewUser: boolean;
};

export function AuthOtpPage({ mode }: { mode: "signin" | "owner-register" }) {
  const registering = mode === "owner-register";
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  async function sendOtp() {
    setPending(true);
    setError("");
    try {
      const result = await fetchApi<{ challengeId: string; debugOtp?: string }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setChallengeId(result.challengeId);
      setOtp(result.debugOtp ?? "");
      setDebugOtp(result.debugOtp ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setPending(false);
    }
  }

  async function verifyOtp() {
    setPending(true);
    setError("");
    try {
      const result = await fetchApi<VerifyResult>(registering ? "/auth/owner/verify-otp" : "/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, otp, challengeId }),
      });
      login(result.accessToken, result.refreshToken, result.user, result.isNewUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify OTP");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame caption="Rooms, rent and residents. All in one place.">
      <div className="auth-intro">
        <span className="auth-icon"><LockKeyhole size={21} aria-hidden="true" /></span>
        <h1>{challengeId ? "Enter your OTP" : registering ? "Register as an owner" : "Welcome back"}</h1>
        <p>{challengeId ? `Enter the six-digit code sent to +91 ${phone}.` : registering
          ? "Use your mobile number to create a workspace for your property."
          : "Sign in with the mobile number linked to your account or staff invite."}</p>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg bg-destructive-soft p-3 text-sm text-destructive">{error}</p>}

      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void (challengeId ? verifyOtp() : sendOtp()); }}>
        {challengeId ? (
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="otp">6-digit OTP</label>
            <Input id="otp" key="otp" inputMode="numeric" autoComplete="one-time-code" autoFocus required
              pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
              className="h-12 text-lg tabular-nums tracking-[0.3em]" />
          </div>
        ) : (
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="phone">Mobile number</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-border px-3 text-sm font-semibold">+91</span>
              <Input key="phone" type="tel" id="phone" inputMode="numeric" autoComplete="tel-national" required
                pattern="[0-9]{10}" maxLength={10} placeholder="10-digit number" value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} className="h-12 pl-16" />
            </div>
          </div>
        )}
        <Button type="submit" disabled={pending} className="h-12 w-full justify-between">
          {pending ? (challengeId ? "Verifying…" : "Sending OTP…") : challengeId ? (registering ? "Create owner account" : "Sign in") : "Send OTP"}
          {pending ? <Loader2 className="animate-spin" size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
        </Button>
      </form>

      {challengeId ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" disabled={pending} onClick={() => {
              setChallengeId(""); setError(""); setDebugOtp(""); setOtp("");
            }}>Change number</Button>
            <Button variant="ghost" disabled={pending} onClick={() => void sendOtp()}>Resend code</Button>
          </div>
          {debugOtp && <p className="mt-4 rounded-lg bg-warning-soft p-3 text-sm text-warning">Local debug OTP <strong className="ml-2 tabular-nums">{debugOtp}</strong></p>}
        </>
      ) : (
        <p className="auth-switch">
          {registering ? "Already have an account?" : "Manage a rental property?"}{" "}
          <Link href={registering ? "/login" : "/register"}>{registering ? "Sign in" : "Create owner account"}</Link>
        </p>
      )}
    </AuthFrame>
  );
}
