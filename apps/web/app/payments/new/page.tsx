"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Search, Send } from "lucide-react";
import type { PaymentDto, PaymentWithReceiptDto, RentEntryDto, TenantDto } from "@tenantease/types";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireRoles } from "@/contexts/AuthContext";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { buildQuery, fetchApi } from "@/lib/api-client";
import { formatPaisa } from "@/lib/format";
import { paisaToRupeesInput, rupeesToPaisa } from "@/lib/money";

type ManualMode = Exclude<PaymentDto["mode"], "ONLINE">;
const paymentModes: { value: ManualMode; label: string }[] = [
  { value: "UPI", label: "UPI" }, { value: "CASH", label: "Cash" }, { value: "BANK_TRANSFER", label: "Bank transfer" },
];

function RecordPaymentContent() {
  const params = useSearchParams();
  const { activeProperty, staffRole } = useProperty();
  const [search, setSearch] = useState("");
  const [tenant, setTenant] = useState<TenantDto | null>(null);
  const [useLink, setUseLink] = useState(true);
  const [entryId, setEntryId] = useState<string | null>(params.get("rentEntryId"));
  const [amountDraft, setAmountDraft] = useState<string | null>(null);
  const [mode, setMode] = useState<ManualMode>("UPI");
  const [reference, setReference] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<PaymentWithReceiptDto | null>(null);
  const [delivery, setDelivery] = useState<"idle" | "sending" | "sent">("idle");
  const attempt = useRef<{ details: string; key: string } | null>(null);
  const linkedId = useLink ? params.get("tenantId") : null;
  const linked = useApi<TenantDto>(linkedId ? `/tenants/${encodeURIComponent(linkedId)}` : null);
  const selected = tenant ?? (linked.data && linked.data.propertyId === activeProperty?.id ? linked.data : null);
  const matches = useApi<TenantDto[]>(activeProperty && !selected && search.trim()
    ? `/properties/${activeProperty.id}/tenants${buildQuery({ search: search.trim(), limit: 8 })}` : null);
  const ledger = useApi<RentEntryDto[]>(selected ? `/tenants/${selected.id}/rent` : null);
  const entries = ledger.data?.filter((entry) => entry.amountPaid < entry.amountDue) ?? [];
  const entry = entryId ? entries.find((item) => item.id === entryId) : entries[0];
  const balance = entry ? entry.amountDue - entry.amountPaid : 0;
  const amount = amountDraft ?? (entry ? paisaToRupeesInput(balance) : "");
  const paisa = rupeesToPaisa(amount);

  function selectTenant(next: TenantDto | null) {
    setTenant(next);
    setUseLink(false);
    setEntryId(null);
    setAmountDraft(null);
    setSearch("");
    setReference("");
    setError("");
  }

  async function record(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !entry || pending) return;
    if (!Number.isSafeInteger(paisa) || paisa <= 0 || paisa > balance) {
      setError("Enter an amount within the outstanding balance.");
      return;
    }

    const details = { rentEntryId: entry.id, amount: paisa, mode, referenceNumber: reference.trim() || null };
    const serialized = JSON.stringify(details);
    if (attempt.current?.details !== serialized) attempt.current = { details: serialized, key: crypto.randomUUID() };
    setPending(true);
    setError("");
    try {
      setSaved(await fetchApi<PaymentWithReceiptDto>("/payments", {
        method: "POST",
        body: JSON.stringify({ ...details, paidAt: new Date().toISOString(), idempotencyKey: attempt.current.key }),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record payment");
    } finally {
      setPending(false);
    }
  }

  async function sendReceipt(receiptId: string) {
    setDelivery("sending");
    setError("");
    try {
      await fetchApi(`/receipts/${receiptId}/send`, { method: "POST" });
      setDelivery("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send receipt");
      setDelivery("idle");
    }
  }

  const back = <Button asChild variant="outline"><Link href="/payments"><ArrowLeft size={16} aria-hidden="true" /> Payments</Link></Button>;

  if (saved) {
    return (
      <section className="dashboard-panel mx-auto grid max-w-xl justify-items-start gap-4">
        <span className="dashboard-row-icon"><CheckCircle2 size={20} aria-hidden="true" /></span>
        <h1 className="text-3xl font-bold tracking-tight">Payment recorded</h1>
        <p>{formatPaisa(saved.payment.amount)} received from {selected?.fullName}.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {delivery === "sent" && <p role="status" className="text-sm text-success">Receipt delivery requested.</p>}
        <div className="flex flex-wrap gap-2">
          {back}
          <Button variant="outline" onClick={() => { selectTenant(null); setSaved(null); setDelivery("idle"); attempt.current = null; }}>Record another</Button>
          {saved.receipt && staffRole !== "MANAGER" && delivery !== "sent" && (
            <Button disabled={delivery === "sending"} onClick={() => void sendReceipt(saved.receipt!.id)}>
              <Send size={16} aria-hidden="true" />{delivery === "sending" ? "Sending…" : "Send receipt"}
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <PageHeader title="Record payment" description="Apply a cash, UPI or bank transfer to an outstanding rent bill." actions={back} />
      <form onSubmit={record} className="dashboard-panel grid gap-5">
        {error && <p role="alert" className="rounded-lg bg-destructive-soft p-3 text-sm text-destructive">{error}</p>}
        {selected ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/55 p-3">
            <div><p className="font-bold">{selected.fullName}</p><p className="text-sm text-muted-foreground">{selected.phone}</p></div>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => selectTenant(null)}>Change tenant</Button>
          </div>
        ) : (
          <div>
            <label htmlFor="tenant-search" className="mb-2 block text-sm font-semibold">Find a tenant</label>
            <div className="relative">
              <Search size={17} aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 text-muted-foreground" />
              <Input id="tenant-search" value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or mobile number" className="pl-10" />
            </div>
            {(linked.loading || matches.loading) && <p role="status" className="mt-2 text-sm text-muted-foreground">Finding tenants…</p>}
            {linkedId && !linked.loading && !selected && !search && <p className="mt-2 text-sm text-muted-foreground">The linked tenant is unavailable for this property. Search to choose a tenant.</p>}
            {matches.error && <p role="alert" className="mt-2 text-sm text-destructive">{matches.error}</p>}
            {matches.data?.length ? (
              <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                {matches.data.map((item) => <li key={item.id}>
                  <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left text-sm hover:bg-secondary/50"
                    onClick={() => selectTenant(item)}><strong>{item.fullName}</strong><span className="text-muted-foreground">{item.phone}</span></button>
                </li>)}
              </ul>
            ) : search.trim() && !matches.loading && !matches.error && <p className="mt-2 text-sm text-muted-foreground">No matching tenants.</p>}
          </div>
        )}
        {selected && (ledger.error ? (
          <p role="alert" className="text-sm text-destructive">{ledger.error} <Button size="sm" variant="ghost" onClick={ledger.refetch}>Try again</Button></p>
        ) : ledger.loading ? <p role="status" className="text-sm text-muted-foreground">Loading rent bills…</p> : entries.length ? (
          <>
            <label className="grid gap-2 text-sm font-semibold">Rent bill
              <select required value={entry?.id ?? ""} disabled={pending} onChange={(event) => { setEntryId(event.target.value); setAmountDraft(null); }}
                className="min-h-11 rounded-lg border border-input bg-card px-3 text-sm">
                {!entry && <option value="">Choose an outstanding bill</option>}
                {entries.map((item) => <option key={item.id} value={item.id}>{item.billingMonth} · {formatPaisa(item.amountDue - item.amountPaid)} outstanding</option>)}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">Amount (₹)
                <Input type="number" step="0.01" min="0.01" max={balance / 100} required inputMode="decimal"
                  disabled={!entry || pending} value={amount} onChange={(event) => setAmountDraft(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-semibold">Payment method
                <select value={mode} disabled={pending} onChange={(event) => setMode(event.target.value as ManualMode)} className="min-h-11 rounded-lg border border-input bg-card px-3 text-sm">
                  {paymentModes.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                </select>
              </label>
            </div>
            <label className="grid gap-2 text-sm font-semibold">Reference (optional)
              <Input maxLength={100} disabled={pending} value={reference} onChange={(event) => setReference(event.target.value)} />
            </label>
            <Button type="submit" className="justify-between" disabled={pending || !entry || !amount}>
              {pending ? "Recording…" : "Confirm payment"}{pending ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
            </Button>
          </>
        ) : <p className="text-sm text-muted-foreground">This tenant has no outstanding rent bills.</p>)}
      </form>
    </div>
  );
}

export default function RecordPayment() {
  const { authorized } = useRequireRoles(["OWNER", "STAFF"]);
  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/payments">
      <Suspense fallback={<p role="status">Loading payment form…</p>}><RecordPaymentContent /></Suspense>
    </DashboardLayout>
  );
}
