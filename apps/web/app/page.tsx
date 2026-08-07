"use client";

import Link from "next/link";
import {
  AlertCircle,
  Bell,
  BedDouble,
  Clock,
  DoorClosed,
  IndianRupee,
  Loader2,
  Plus,
  ReceiptText,
  UserPlus,
  WalletCards
} from "lucide-react";
import type { NotificationDto, RentEntryDto, TenantDto } from "@tenantease/types";

import { useAuth, useRequireRoles } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { EmptyState } from "@/components/shared/EmptyState";
import { MetricCard } from "@/components/shared/MetricCard";
import { MobileListCard } from "@/components/shared/MobileListCard";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { PageHeader } from "@/components/shared/PageHeader";
import { QuickActionBar } from "@/components/shared/QuickActionBar";
import { RentLedgerStrip } from "@/components/shared/RentLedgerStrip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { fetchApi } from "@/lib/api-client";

interface RentEntryWithName extends RentEntryDto {
  tenantName: string;
}

type DashboardStats = {
  totalDue: number;
  totalPaid: number;
  overdueTotal: number;
  collectionPct: number;
  currentMonth: string;
  currentMonthLabel: string;
  recentPayments: RentEntryWithName[];
  overdueEntries: RentEntryWithName[];
  activeTenants: TenantDto[];
  noticeTenants: TenantDto[];
};

type PaymentClaim = {
  id: string;
  tenantName: string;
  billingMonth: string;
  amount: number;
  mode: string;
  referenceNumber: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

function getCurrentMonth() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return { currentMonth, currentMonthLabel };
}

function getDashboardStats(tenants: TenantDto[] = [], rentEntries: RentEntryWithName[] = []): DashboardStats {
  const { currentMonth, currentMonthLabel } = getCurrentMonth();
  const currentMonthEntries = rentEntries.filter((entry) => entry.billingMonth === currentMonth);
  const totalDue = currentMonthEntries.reduce((sum, entry) => sum + entry.amountDue, 0);
  const totalPaid = currentMonthEntries.reduce((sum, entry) => sum + entry.amountPaid, 0);
  const overdueEntries = rentEntries.filter((entry) => entry.status === "OVERDUE");

  return {
    totalDue,
    totalPaid,
    overdueTotal: overdueEntries.reduce((sum, entry) => sum + Math.max(0, entry.amountDue - entry.amountPaid), 0),
    collectionPct: totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0,
    currentMonth,
    currentMonthLabel,
    recentPayments: rentEntries.filter((entry) => entry.amountPaid > 0).slice(0, 5),
    overdueEntries: overdueEntries.slice(0, 5),
    activeTenants: tenants.filter((tenant) => tenant.status === "ACTIVE"),
    noticeTenants: tenants.filter((tenant) => tenant.status === "NOTICE")
  };
}

function DashboardLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <Card key={item} className="h-32 animate-pulse bg-secondary/60" />
      ))}
      <div className="col-span-full flex items-center justify-center py-10">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    </div>
  );
}

function EmptyPropertyPanel() {
  return (
    <EmptyState
      title="No active property yet"
      description="Create your first property, add rooms, then invite tenants into the rent ledger."
      icon={<DoorClosed className="h-6 w-6" />}
      action={
        <Button asChild>
          <Link href="/properties/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Property
          </Link>
        </Button>
      }
    />
  );
}

function OverduePanel({ entries, total }: { entries: RentEntryWithName[]; total: number }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-destructive/20 bg-destructive-soft/10 p-5 backdrop-blur-md relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-1 bg-destructive" />
      <div className="flex items-start gap-4">
        <span className="rounded-lg bg-destructive/10 p-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-foreground">
                {entries.length} overdue tenant{entries.length === 1 ? "" : "s"} need follow-up
              </h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Pending now: <MoneyValue amount={total} className="text-destructive font-bold" />.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="border-destructive/20 hover:bg-destructive/10 hover:text-destructive">
              <Link href="/payments">Review dues</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ActivityList({ entries }: { entries: RentEntryWithName[] }) {
  return (
    <Card className="shadow-card">
      <CardHeader className="border-b border-white/[0.04] p-5">
        <CardTitle className="text-lg">Recent Payments</CardTitle>
      </CardHeader>
      <div className="space-y-3 p-4">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <MobileListCard
              key={entry.id}
              title={entry.tenantName}
              meta={
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {entry.billingMonth}
                </span>
              }
              value={<MoneyValue amount={entry.amountPaid} size="sm" />}
              status={<StatusBadge status="PAID" />}
            />
          ))
        ) : (
          <EmptyState
            title="No rent collected yet"
            description="Payments recorded this month will appear here."
            icon={<ReceiptText className="h-6 w-6" />}
            className="py-10"
          />
        )}
      </div>
    </Card>
  );
}

function DuesList({ entries }: { entries: RentEntryWithName[] }) {
  return (
    <Card className="shadow-card">
      <CardHeader className="border-b border-white/[0.04] p-5">
        <CardTitle className="text-lg">Outstanding Dues</CardTitle>
      </CardHeader>
      <div className="space-y-3 p-4">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <MobileListCard
              key={entry.id}
              title={entry.tenantName}
              meta={`${entry.billingMonth} overdue`}
              value={<MoneyValue amount={entry.amountDue - entry.amountPaid} size="sm" />}
              status={<StatusBadge status={entry.status} />}
            />
          ))
        ) : (
          <EmptyState
            title="No overdue rent"
            description="All tenants are clear for now."
            icon={<IndianRupee className="h-6 w-6" />}
            className="py-10"
          />
        )}
      </div>
    </Card>
  );
}

function NotificationList({ entries, refetch }: { entries: NotificationDto[]; refetch: () => void }) {
  return (
    <Card className="shadow-card lg:col-span-2">
      <CardHeader className="border-b border-white/[0.04] p-5">
        <CardTitle className="flex items-center gap-2 text-lg"><Bell className="h-5 w-5" /> Owner alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {entries.length ? entries.slice(0, 5).map((entry) => (
          <button
            type="button"
            key={entry.id}
            className="w-full rounded-lg border border-border p-4 text-left hover:bg-secondary/40"
            onClick={async () => {
              if (!entry.readAt) await fetchApi(`/notifications/${entry.id}/read`, { method: "POST" });
              refetch();
            }}
          >
            <span className="font-semibold text-foreground">{entry.title}</span>
            {!entry.readAt ? <span className="ml-2 text-xs font-bold text-primary">NEW</span> : null}
            <span className="mt-1 block text-sm text-muted-foreground">{entry.content}</span>
          </button>
        )) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No owner alerts.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentClaims({ entries, refetch }: { entries: PaymentClaim[]; refetch: () => void }) {
  const pending = entries.filter((entry) => entry.status === "PENDING");
  if (!pending.length) return null;
  return (
    <Card className="shadow-card lg:col-span-2">
      <CardHeader><CardTitle className="text-lg">Payments awaiting confirmation</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {pending.map((claim) => (
          <div key={claim.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{claim.tenantName} · {claim.billingMonth}</p>
              <p className="text-sm text-muted-foreground"><MoneyValue amount={claim.amount} size="sm" /> via {claim.mode}{claim.referenceNumber ? ` · ${claim.referenceNumber}` : ""}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={async () => {
                const reason = window.prompt("Reason for rejection");
                if (!reason) return;
                await fetchApi(`/payment-claims/${claim.id}/resolve`, { method: "POST", body: JSON.stringify({ decision: "REJECT", reason }) });
                refetch();
              }}>Reject</Button>
              <Button size="sm" onClick={async () => {
                await fetchApi(`/payment-claims/${claim.id}/resolve`, { method: "POST", body: JSON.stringify({ decision: "APPROVE" }) });
                refetch();
              }}>Confirm payment</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const { activeProperty, loading: propertyLoading } = useProperty();
  const propertyId = activeProperty?.id;
  const { data: tenants, loading: tenantsLoading } = useApi<TenantDto[]>(
    propertyId ? `/properties/${propertyId}/tenants?limit=100` : null
  );
  const { data: rentEntries, loading: rentLoading } = useApi<RentEntryWithName[]>(
    propertyId ? `/properties/${propertyId}/rent` : null
  );
  const { data: notifications, refetch: refetchNotifications } = useApi<NotificationDto[]>("/notifications");
  const canReviewPayments = user?.role === "OWNER" || user?.staffAssignments?.some((assignment) =>
    assignment.propertyId === propertyId && ["MANAGER", "ACCOUNTANT"].includes(assignment.role)
  );
  const { data: paymentClaims, refetch: refetchClaims } = useApi<PaymentClaim[]>(
    propertyId && canReviewPayments ? `/properties/${propertyId}/payment-claims` : null
  );
  const loading = propertyLoading || tenantsLoading || rentLoading;
  const stats = getDashboardStats(tenants ?? [], rentEntries ?? []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Daily Control"
        description={
          activeProperty
            ? `${activeProperty.name}, ${activeProperty.city} - ${activeProperty.state}`
            : "Start with a property, then rooms, tenants, rent, and receipts."
        }
        actions={
          <QuickActionBar>
            <Button asChild variant="outline" className="justify-start sm:w-auto">
              <Link href="/tenants">
                <UserPlus className="mr-2 h-4 w-4" />
                Add Tenant
              </Link>
            </Button>
            <Button asChild className="justify-start sm:w-auto">
              <Link href="/payments/new">
                <WalletCards className="mr-2 h-4 w-4" />
                Record Rent
              </Link>
            </Button>
          </QuickActionBar>
        }
      />

      {!activeProperty ? <EmptyPropertyPanel /> : null}
      {loading ? <DashboardLoading /> : null}

      {!loading && activeProperty ? (
        <>
          <RentLedgerStrip
            monthLabel={`${stats.currentMonthLabel} rent ledger`}
            className="rounded-xl border border-white/[0.06] bg-card/40 backdrop-blur-xl p-5 shadow-glass"
            items={[
              { id: "expected", label: "Expected", value: stats.totalDue, isMoney: true },
              { id: "collected", label: "Collected", value: stats.totalPaid, isMoney: true, color: "success" },
              { id: "overdue", label: "Overdue", value: stats.overdueTotal, isMoney: true, color: "destructive" },
              { id: "rate", label: "Collection", value: `${stats.collectionPct}%`, color: stats.collectionPct >= 85 ? "success" : "warning" }
            ]}
          />

          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              title="Occupied Beds"
              value={activeProperty.occupiedBeds}
              icon={<BedDouble className="text-primary" />}
              subtitle={`${stats.activeTenants.length} active tenants`}
            />
            <MetricCard
              title="Vacant Beds"
              value={activeProperty.vacantBeds}
              icon={<DoorClosed className="text-primary" />}
              subtitle={`${stats.noticeTenants.length} on notice`}
            />
            <MetricCard
              title="Expected Rent"
              value={<MoneyValue amount={stats.totalDue} />}
              icon={<IndianRupee className="text-primary" />}
              subtitle={stats.currentMonth}
            />
            <MetricCard
              title="Collected"
              value={<MoneyValue amount={stats.totalPaid} />}
              icon={<ReceiptText className="text-primary" />}
              subtitle={`${stats.collectionPct}% collection rate`}
            />
          </section>

          <OverduePanel entries={stats.overdueEntries} total={stats.overdueTotal} />

          <section className="grid gap-6 lg:grid-cols-2">
            <ActivityList entries={stats.recentPayments} />
            <DuesList entries={stats.overdueEntries} />
            <NotificationList entries={notifications ?? []} refetch={refetchNotifications} />
            {canReviewPayments ? <PaymentClaims entries={paymentClaims ?? []} refetch={refetchClaims} /> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  const { authorized } = useRequireRoles(["OWNER", "STAFF"]);
  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/">
      <DashboardContent />
    </DashboardLayout>
  );
}
