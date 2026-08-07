"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function EnquiryForm({ slug }: { slug: string }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch(`${API_URL}/listings/${slug}/enquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          phone: form.phone.replace(/\D/g, ""),
          email: form.email || null,
          message: form.message || null
        })
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        setStatus(json.error?.message ?? "Could not send enquiry.");
        return;
      }
      setForm({ name: "", phone: "", email: "", message: "" });
      setStatus("Enquiry sent. The property owner will contact you.");
    } catch {
      setStatus("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <h2 className="text-lg font-bold text-foreground">Ask About Vacancy</h2>
      <div className="mt-4 grid gap-3">
        <Input required placeholder="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Input required inputMode="numeric" maxLength={10} placeholder="10-digit phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} />
        <Input type="email" placeholder="Email optional" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <textarea
          rows={3}
          placeholder="Message optional"
          value={form.message}
          onChange={(event) => setForm({ ...form, message: event.target.value })}
          className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>
      {status ? <p className="mt-3 text-sm font-semibold text-muted-foreground">{status}</p> : null}
      <Button type="submit" disabled={loading} className="mt-4 w-full">
        {loading ? "Sending..." : "Send Enquiry"}
      </Button>
    </form>
  );
}
