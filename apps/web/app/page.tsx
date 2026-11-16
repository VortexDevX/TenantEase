"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ArrowDownLeft, ArrowRight, ArrowUpRight, BedDouble, Bell, Building2, CalendarDays, MapPin, Plus, ReceiptText, Users, Wrench } from "lucide-react";
import type { NotificationDto, PropertyDto, RecentPaymentDto, RentEntryDto } from "@tenantease/types";
import { useAuth, useRequireRoles } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { fetchApi } from "@/lib/api-client";
import { formatPaisa } from "@/lib/format";
import { isRentOverdue } from "@/lib/money";

type RentEntry = RentEntryDto & { tenantName: string };
type PaymentClaim = {
  id: string;
  tenantName: string;
  billingMonth: string;
  amount: number;
  mode: string;
  referenceNumber: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

const dayFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const monthFormat = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="dashboard-link">{children}<ArrowUpRight size={15} aria-hidden="true" /></Link>;
}

function RequestError({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-destructive-soft p-3 text-sm text-destructive">
      <span>{error}</span>
      <Button variant="outline" size="sm" onClick={retry}>Try again</Button>
    </div>
  );
}

function RentCollection({ entries, loading, error, refetch }: {
  entries: RentEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}) {
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = entries.filter((entry) => entry.billingMonth === month);
  const billed = thisMonth.reduce((sum, entry) => sum + entry.amountDue, 0);
  const collected = thisMonth.reduce((sum, entry) => sum + entry.amountPaid, 0);
  const outstanding = thisMonth.reduce((sum, entry) => sum + Math.max(0, entry.amountDue - entry.amountPaid), 0);
  const percent = billed ? Math.round(collected / billed * 100) : 0;

  return (
    <section className="dashboard-rent" aria-labelledby="collection-title">
      <div className="dashboard-panel-heading">
        <h2 id="collection-title">Rent collection</h2>
        <span className="dashboard-month"><CalendarDays size={15} aria-hidden="true" />{monthFormat.format(new Date(`${month}-01T00:00:00Z`))}</span>
      </div>
      {error ? <RequestError error={error} retry={refetch} /> : loading ? (
        <p role="status" className="py-8">Loading rent ledger…</p>
      ) : (
        <>
          <div className="dashboard-rent-amount">
            <strong>{formatPaisa(collected)}</strong>
            <span>collected</span>
          </div>
          <progress className="dashboard-rent-progress" value={Math.min(100, percent)} max={100} aria-label="Rent collection percentage" />
          <dl className="dashboard-rent-totals">
            <div><dt>Billed</dt><dd>{formatPaisa(billed)}</dd></div>
            <div><dt>Outstanding</dt><dd>{formatPaisa(outstanding)}</dd></div>
            <div><dt>Collected</dt><dd>{percent}%</dd></div>
          </dl>
          {!thisMonth.length && <p className="dashboard-no-ledger">Rent ledger for this month is empty. <Link href="/payments">Open payments <ArrowRight size={14} aria-hidden="true" /></Link></p>}
        </>
      )}
    </section>
  );
}

function Occupancy({ property }: { property: PropertyDto }) {
  const { totalRooms, occupiedBeds, vacantBeds } = property;
  const totalBeds = occupiedBeds + vacantBeds;
  const percent = totalBeds ? Math.round(occupiedBeds / totalBeds * 100) : 0;

  return (
    <section className="dashboard-panel" aria-labelledby="occupancy-title">
      <div className="dashboard-panel-heading">
        <h2 id="occupancy-title">Occupancy</h2>
        <SectionLink href="/rooms">Rooms</SectionLink>
      </div>
      <div className="dashboard-occupancy">
        <div className="dashboard-occupancy-ring" style={{ "--occupancy": `${percent}%` } as React.CSSProperties}>
          <div><strong>{percent}%</strong><span>occupied</span></div>
        </div>
        <dl>
          <div><dt><span className="bg-primary" />Occupied</dt><dd>{occupiedBeds}</dd></div>
          <div><dt><span className="bg-secondary" />Vacant</dt><dd>{vacantBeds}</dd></div>
          <div><dt><BedDouble size={14} aria-hidden="true" />Rooms</dt><dd>{totalRooms}</dd></div>
        </dl>
      </div>
      {!totalBeds && <p className="text-sm text-muted-foreground">Add rooms to start tracking bed availability.</p>}
    </section>
  );
}

function RecentPayments({ result }: { result: ReturnType<typeof useApi<RecentPaymentDto[]>> }) {
  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading">
        <h2>Recent payments</h2>
        <SectionLink href="/payments">Open ledger</SectionLink>
      </div>
      {result.error ? <RequestError error={result.error} retry={result.refetch} /> : result.loading ? (
        <p role="status" className="text-sm text-muted-foreground">Loading payments…</p>
      ) : result.data?.length ? (
        <ul className="dashboard-rows">
          {result.data.map((payment) => (
            <li key={payment.id}>
              <span className="dashboard-row-icon"><ArrowDownLeft size={17} aria-hidden="true" /></span>
              <div><strong>{payment.tenantName}</strong><span>{dayFormat.format(new Date(payment.paidAt))} · {payment.mode.replaceAll("_", " ")}</span></div>
              <b>{formatPaisa(payment.amount)}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dashboard-panel-empty"><ReceiptText size={19} aria-hidden="true" />No payments recorded yet.</p>
      )}
    </section>
  );
}

function OverdueRent({ entries, loading, error }: { entries: RentEntry[]; loading: boolean; error: string | null }) {
  const now = Date.now();
  const overdue = entries.filter((entry) => isRentOverdue(entry, now))
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));

  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading">
        <h2>Overdue rent</h2>
        <SectionLink href="/payments">Review dues</SectionLink>
      </div>
      {error ? <p className="text-sm text-destructive">Overdue balances unavailable.</p> : loading ? (
        <p role="status" className="text-sm text-muted-foreground">Loading balances…</p>
      ) : overdue.length ? (
        <>
          <p className="mb-2 text-sm text-muted-foreground">{formatPaisa(overdue.reduce((sum, entry) => sum + entry.amountDue - entry.amountPaid, 0))} across {overdue.length} overdue {overdue.length === 1 ? "entry" : "entries"}</p>
          <ul className="dashboard-rows">
            {overdue.slice(0, 5).map((entry) => (
              <li key={entry.id}>
                <span className="dashboard-row-icon dashboard-row-warning"><AlertCircle size={17} aria-hidden="true" /></span>
                <div><strong>{entry.tenantName}</strong><span>Due {dayFormat.format(new Date(entry.dueDate))} · {entry.billingMonth}</span></div>
                <b>{formatPaisa(entry.amountDue - entry.amountPaid)}</b>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="dashboard-panel-empty"><CalendarDays size={19} aria-hidden="true" />No overdue rent.</p>
      )}
    </section>
  );
}

function PaymentClaims({ result, onResolved }: {
  result: ReturnType<typeof useApi<PaymentClaim[]>>;
  onResolved: () => void;
}) {
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = result.data?.filter((claim) => claim.status === "PENDING") ?? [];

  async function resolve(id: string, decision: "APPROVE" | "REJECT") {
    if (saving || (decision === "REJECT" && reason.trim().length < 3)) return;
    setSaving(true);
    setError(null);
    try {
      await fetchApi(`/payment-claims/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify(decision === "APPROVE" ? { decision } : { decision, reason: reason.trim() }),
      });
      setRejectId(null);
      setReason("");
      result.refetch();
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review payment");
    } finally {
      setSaving(false);
    }
  }

  if (!pending.length && !result.error) return null;

  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading"><h2>Payments to review</h2></div>
      {result.error && <RequestError error={result.error} retry={result.refetch} />}
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      <ul className="divide-y divide-border">
        {pending.map((claim) => (
          <li key={claim.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <strong className="break-words">{claim.tenantName}</strong>
                <p className="break-words text-sm text-muted-foreground">
                  {formatPaisa(claim.amount)} · {claim.mode} · {claim.billingMonth}{claim.referenceNumber ? ` · ${claim.referenceNumber}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={saving} onClick={() => { setRejectId(claim.id); setReason(""); setError(null); }}>Reject</Button>
                <Button size="sm" disabled={saving} onClick={() => void resolve(claim.id, "APPROVE")}>Confirm payment</Button>
              </div>
            </div>
            {rejectId === claim.id && (
              <form className="mt-3 grid gap-2" onSubmit={(event) => { event.preventDefault(); void resolve(claim.id, "REJECT"); }}>
                <label htmlFor="claim-reason" className="text-sm font-semibold">Reason for rejection</label>
                <input id="claim-reason" autoFocus required minLength={3} maxLength={255} value={reason}
                  onChange={(event) => setReason(event.target.value)} className="rounded-lg border border-input px-3 py-2" />
                <div className="flex gap-2">
                  <Button size="sm" type="submit" variant="destructive" disabled={saving || reason.trim().length < 3}>Reject claim</Button>
                  <Button size="sm" variant="ghost" disabled={saving} onClick={() => setRejectId(null)}>Cancel</Button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DashboardAlerts() {
  const alerts = useApi<NotificationDto[]>("/notifications");
  const [error, setError] = useState<string | null>(null);

  async function markRead(id: string) {
    setError(null);
    try {
      await fetchApi(`/notifications/${id}/read`, { method: "POST" });
      alerts.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark alert as read");
    }
  }

  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading"><h2>Alerts</h2><Bell size={18} aria-hidden="true" /></div>
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      {alerts.error ? <RequestError error={alerts.error} retry={alerts.refetch} /> : alerts.loading ? (
        <p role="status" className="text-sm text-muted-foreground">Loading alerts…</p>
      ) : alerts.data?.length ? (
        <ul className="divide-y divide-border">
          {alerts.data.slice(0, 5).map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div className="min-w-0"><strong>{entry.title}</strong><p className="mt-1 text-sm text-muted-foreground">{entry.content}</p></div>
              {!entry.readAt && <Button size="sm" variant="ghost" onClick={() => void markRead(entry.id)}>Mark read</Button>}
            </li>
          ))}
        </ul>
      ) : <p className="dashboard-panel-empty"><Bell size={19} aria-hidden="true" />No alerts.</p>}
    </section>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const { activeProperty, loading } = useProperty();
  const isOwner = user?.role === "OWNER";
  const assignment = user?.staffAssignments?.find((item) => item.propertyId === activeProperty?.id);
  const canUsePayments = isOwner || assignment?.role === "MANAGER" || assignment?.role === "ACCOUNTANT";
  const canManageTenants = isOwner || assignment?.role === "MANAGER" || assignment?.role === "WARDEN";
  const canManageMaintenance = canManageTenants;
  const base = activeProperty && canUsePayments ? `/properties/${activeProperty.id}` : null;
  const rent = useApi<RentEntry[]>(base ? `${base}/rent` : null);
  const payments = useApi<RecentPaymentDto[]>(base ? `${base}/payments/recent` : null);
  const claims = useApi<PaymentClaim[]>(base ? `${base}/payment-claims` : null);

  return (
    <div className="dashboard-stack">
      <header className="dashboard-heading">
        <div>
          <h1>Property overview</h1>
          {activeProperty && (
            <p><MapPin size={16} aria-hidden="true" /><strong>{activeProperty.name}</strong><span aria-hidden="true">·</span>{activeProperty.city}, {activeProperty.state}</p>
          )}
        </div>
        {activeProperty && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/tenants"><Users size={17} aria-hidden="true" />{canManageTenants ? "Manage tenants" : "View tenants"}</Link></Button>
            {canUsePayments && <Button asChild><Link href="/payments/new"><Plus size={17} aria-hidden="true" />Record payment</Link></Button>}
            {!canUsePayments && canManageMaintenance && <Button asChild><Link href="/maintenance"><Wrench size={17} aria-hidden="true" />Maintenance</Link></Button>}
          </div>
        )}
      </header>
      {loading ? <p role="status" className="py-10 text-muted-foreground">Loading workspace…</p> : !activeProperty ? (
        <EmptyState title={isOwner ? "Add your first property" : "No active assignment"}
          description={isOwner ? "Create a property to manage rooms, tenants and rent in one place." : "Your property assignments appear here after you accept an invitation."}
          icon={<Building2 size={24} aria-hidden="true" />}
          action={<Button asChild><Link href={isOwner ? "/properties?setup=property" : "/staff-portal"}>{isOwner ? "Add property" : "View assignments"}<ArrowRight size={17} aria-hidden="true" /></Link></Button>}
        />
      ) : (
        <>
          <div className={canUsePayments ? "dashboard-summary" : undefined}>
            {canUsePayments && <RentCollection entries={rent.data ?? []} loading={rent.loading} error={rent.error} refetch={rent.refetch} />}
            <Occupancy property={activeProperty} />
          </div>
          {canUsePayments && (
            <>
              <div className="dashboard-details">
                <RecentPayments result={payments} />
                <OverdueRent entries={rent.data ?? []} loading={rent.loading} error={rent.error} />
              </div>
              <PaymentClaims result={claims} onResolved={() => { rent.refetch(); payments.refetch(); }} />
            </>
          )}
          <DashboardAlerts />
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { authorized } = useRequireRoles(["OWNER", "STAFF"]);
  if (!authorized) return null;

  return <DashboardLayout activePath="/"><DashboardContent /></DashboardLayout>;
}
