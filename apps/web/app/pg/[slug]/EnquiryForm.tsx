"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api-client";

export function EnquiryForm({ slug }: { slug: string }) {
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    setLoading(true);
    setStatus(null);
    try {
      await fetchApi(`/listings/${encodeURIComponent(slug)}/enquiry`, {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          phone: form.get("phone"),
          email: form.get("email") || null,
          message: String(form.get("message") ?? "").trim() || null,
        }),
      });
      target.reset();
      setStatus({ success: true, message: "Enquiry sent. The property owner will contact you." });
    } catch (error) {
      setStatus({ success: false, message: error instanceof Error ? error.message : "Could not send enquiry" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="dashboard-panel listing-enquiry">
      <h2 className="mb-4 text-xl font-bold tracking-tight">Ask about vacancy</h2>
      <div className="grid gap-3">
        <label className="grid gap-1.5 text-sm font-semibold">Full name
          <Input name="name" autoComplete="name" minLength={2} maxLength={100} required />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">Mobile number
          <Input name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required pattern="[0-9]{10}" maxLength={10} placeholder="10-digit number" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">Email (optional)
          <Input name="email" type="email" autoComplete="email" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">Message (optional)
          <textarea name="message" rows={3} maxLength={1000} className="rounded-lg border border-input px-3 py-2 text-base sm:text-sm" />
        </label>
      </div>
      {status && <p role={status.success ? "status" : "alert"} className={`mt-3 text-sm ${status.success ? "text-success" : "text-destructive"}`}>{status.message}</p>}
      <Button type="submit" disabled={loading} className="mt-4 w-full justify-between">
        {loading ? "Sending…" : "Send enquiry"}<ArrowRight size={17} aria-hidden="true" />
      </Button>
    </form>
  );
}
