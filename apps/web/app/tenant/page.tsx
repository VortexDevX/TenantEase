"use client";

import { useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  Banknote,
  Building2,
  Clock,
  CreditCard,
  FileText,
  Home,
  IndianRupee,
  Loader2,
  MessageSquare,
  ReceiptText,
  ShieldCheck,
  Wrench
} from "lucide-react";
import type { OnlinePaymentOrderDto, RentEntryDto, TenantPortalHomeDto } from "@tenantease/types";

import { useRequireRole, useAuth } from "@/contexts/AuthContext";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { ApiError, fetchApi } from "@/lib/api-client";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { useApi } from "@/lib/useApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { MobileListCard } from "@/components/shared/MobileListCard";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatPaisa } from "@/lib/format";

type OfflinePaymentMode = "CASH" | "UPI" | "BANK_TRANSFER";
type TenantPaymentController = ReturnType<typeof useTenantPaymentActions>;

const OFFLINE_PAYMENT_OPTIONS: Array<{
  mode: OfflinePaymentMode;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { mode: "CASH", label: "Cash Paid", description: "Owner confirms after collection.", icon: Banknote },
  { mode: "UPI", label: "UPI Paid", description: "Send UPI reference to owner.", icon: CreditCard },
  { mode: "BANK_TRANSFER", label: "Bank Paid", description: "Send bank reference to owner.", icon: Building2 }
];

function rentBalance(entry: RentEntryDto | null) {
  return entry ? Math.max(0, entry.amountDue - entry.amountPaid) : 0;
}

function NoBookingState() {
  return (
    <EmptyState
      title="No active booking"
      description="Your tenant account is ready. Ask your property owner to assign your room and activate the booking."
      icon={<Clock className="h-7 w-7 text-primary" />}
      className="min-h-[60vh] border border-border bg-secondary/50 rounded-xl"
    />
  );
}

function TenantLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <Card key={item} className="h-32 animate-pulse bg-secondary/50 border border-border" />
      ))}
      <div className="col-span-full flex items-center justify-center py-10">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    </div>
  );
}

function ProfileCard({ home }: { home: TenantPortalHomeDto }) {
  return (
    <Card className="shadow-glass border-border bg-secondary/50">
      <CardHeader className="border-b border-border p-5">
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <Home className="h-5 w-5 text-primary" />
          Stay Details
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</p>
          <p className="mt-1 font-bold text-foreground">{home.profile.phone}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Property</p>
          <p className="mt-1 font-bold text-foreground">{home.profile.propertyName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Room</p>
          <p className="mt-1 font-bold text-foreground">{home.profile.roomNumber}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function NoticesCard({ home }: { home: TenantPortalHomeDto }) {
  if (home.recentNotifications.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-glass border-border bg-secondary/50">
      <CardHeader className="border-b border-border p-5">
        <CardTitle className="text-lg text-foreground">Recent Notices</CardTitle>
      </CardHeader>
      <div className="space-y-3 p-4">
        {home.recentNotifications.slice(0, 4).map((notice) => (
          <MobileListCard
            key={notice.id}
            title={notice.title}
            meta={new Date(notice.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            status={!notice.readAt ? <StatusBadge status="NEW" /> : null}
            className="border-border bg-secondary/50 hover:bg-secondary/50"
          >
            <p className="text-sm text-muted-foreground">{notice.content}</p>
          </MobileListCard>
        ))}
      </div>
    </Card>
  );
}

function RentHistoryCard({ rentEntries }: { rentEntries: RentEntryDto[] }) {
  return (
    <Card className="shadow-glass border-border bg-secondary/50">
      <CardHeader className="border-b border-border p-5">
        <CardTitle className="text-lg text-foreground">Rent History</CardTitle>
      </CardHeader>
      <div className="space-y-3 p-4">
        {rentEntries.length > 0 ? (
          rentEntries.slice(0, 6).map((entry) => (
            <MobileListCard
              key={entry.id}
              title={entry.billingMonth}
              meta={`Due ${new Date(entry.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
              value={<MoneyValue amount={entry.amountPaid} size="sm" />}
              status={<StatusBadge status={entry.status} />}
              className="border-border bg-secondary/50 hover:bg-secondary/50"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Bill <MoneyValue amount={entry.amountDue} muted size="sm" /></span>
                <span>Balance <MoneyValue amount={rentBalance(entry)} muted size="sm" /></span>
              </div>
            </MobileListCard>
          ))
        ) : (
          <EmptyState
            title="No rent entries yet"
            description="Your rent ledger will appear after the owner generates rent."
            icon={<FileText className="h-6 w-6 text-primary" />}
            className="py-10 border border-border bg-secondary/50 rounded-xl"
          />
        )}
      </div>
    </Card>
  );
}

function PaymentOptionsCard({
  currentRent,
  currentBalance,
  payable,
  onSelectBill,
  payingRentEntryId,
  offlineMode,
  offlineReference,
  offlineNote,
  setOfflineMode,
  setOfflineReference,
  setOfflineNote,
  createPaymentOrder,
  notifyOfflinePayment
}: {
  currentRent: RentEntryDto | null;
  currentBalance: number;
  payable: RentEntryDto[];
  onSelectBill: (id: string) => void;
  payingRentEntryId: string | null;
  offlineMode: OfflinePaymentMode | null;
  offlineReference: string;
  offlineNote: string;
  setOfflineMode: (mode: OfflinePaymentMode | null) => void;
  setOfflineReference: (value: string) => void;
  setOfflineNote: (value: string) => void;
  createPaymentOrder: (rentEntryId: string) => Promise<void>;
  notifyOfflinePayment: (mode: OfflinePaymentMode) => Promise<void>;
}) {
  const canPay = Boolean(currentRent && currentBalance > 0 && currentRent.status !== "PAID");

  return (
    <Card id="pay-rent">
      <CardHeader className="border-b border-border p-5">
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <IndianRupee className="h-5 w-5 text-primary" />
          Pay Rent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {payable.length ? (
          <label className="grid gap-2 text-sm font-semibold">Rent bill
            <select value={currentRent?.id ?? ""} disabled={Boolean(payingRentEntryId)}
              onChange={(event) => onSelectBill(event.target.value)}
              className="min-h-11 rounded-lg border border-input bg-card px-3 text-sm">
              {payable.map((bill) => <option key={bill.id} value={bill.id}>{bill.billingMonth} · {formatPaisa(rentBalance(bill))} outstanding</option>)}
            </select>
          </label>
        ) : <p className="text-sm text-muted-foreground">You have no outstanding rent bills.</p>}

        <Button
          type="button"
          className="w-full justify-center bg-primary hover:bg-primary text-white font-bold transition-all shadow-md hover:shadow-violet-500/20"
          disabled={!canPay || !currentRent || Boolean(payingRentEntryId)}
          onClick={() => currentRent ? createPaymentOrder(currentRent.id) : undefined}
        >
          {payingRentEntryId === currentRent?.id ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="mr-2 h-4 w-4" />
          )}
          Pay Online
        </Button>

        <div className="grid gap-3 sm:grid-cols-3">
          {OFFLINE_PAYMENT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = offlineMode === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                aria-pressed={isSelected}
                disabled={!canPay || Boolean(payingRentEntryId)}
                onClick={() => setOfflineMode(offlineMode === option.mode ? null : option.mode)}
                className={`rounded-lg border p-3 text-left transition-all hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-50
                  ${isSelected ? 'border-primary bg-primary/[0.03] shadow-glow' : 'border-border bg-secondary/50'}
                `}
              >
                <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="mt-2 text-sm font-bold text-foreground">{option.label}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">{option.description}</p>
              </button>
            );
          })}
        </div>

        {offlineMode ? (
          <div className="rounded-lg border border-border bg-secondary/50 p-4 animate-slide-in">
            <p className="text-sm font-bold text-foreground mb-3">
              Notify owner: {OFFLINE_PAYMENT_OPTIONS.find((option) => option.mode === offlineMode)?.label}
            </p>
            <div className="grid gap-3">
              <input
                aria-label="Payment reference"
                value={offlineReference}
                onChange={(event) => setOfflineReference(event.target.value)}
                placeholder={offlineMode === "CASH" ? "Cash receipt note optional" : "Reference / transaction ID"}
                className="h-10 rounded-lg border border-border bg-secondary/50 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 outline-none"
              />
              <textarea
                aria-label="Message to owner"
                rows={2}
                value={offlineNote}
                onChange={(event) => setOfflineNote(event.target.value)}
                placeholder="Message to owner optional"
                className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 outline-none placeholder:text-muted-foreground"
              />
              <Button type="button" disabled={Boolean(payingRentEntryId)} onClick={() => void notifyOfflinePayment(offlineMode)}>
                {payingRentEntryId ? "Sending…" : "Send payment update"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PaymentHelpCard() {
  return (
    <Card className="shadow-glass border-border bg-secondary/50">
      <CardHeader className="border-b border-border p-5">
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Payment Safety
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-5 text-sm font-medium text-muted-foreground leading-relaxed">
        <p>Cash, UPI, and bank updates notify owner. Ledger changes after owner confirms payment.</p>
        <p>Online payment creates provider order when property has payment gateway enabled.</p>
      </CardContent>
    </Card>
  );
}

function QuickTenantActions() {
  return (
    <Card className="shadow-glass border-border bg-secondary/50">
      <CardHeader className="border-b border-border p-5">
        <CardTitle className="text-lg text-foreground">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
        <Button asChild variant="outline" className="justify-start border-border hover:bg-secondary/50 hover:text-primary">
          <a href="/tenant/maintenance"><Wrench className="mr-2 h-4 w-4" />Raise Issue</a>
        </Button>
        <Button asChild variant="outline" className="justify-start border-border hover:bg-secondary/50 hover:text-primary">
          <a href="/tenant/receipts"><ReceiptText className="mr-2 h-4 w-4" />View Receipts</a>
        </Button>
        <Button asChild variant="outline" className="justify-start border-border hover:bg-secondary/50 hover:text-primary">
          <a href="/tenant/announcements"><MessageSquare className="mr-2 h-4 w-4" />Notices</a>
        </Button>
        <Button asChild variant="outline" className="justify-start border-border hover:bg-secondary/50 hover:text-primary">
          <a href="/tenant/agreements"><FileText className="mr-2 h-4 w-4" />Agreement</a>
        </Button>
      </CardContent>
    </Card>
  );
}

function useTenantPaymentActions(currentRent: RentEntryDto | null, currentBalance: number, refresh: () => void) {
  const [payingRentEntryId, setPayingRentEntryId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState<OfflinePaymentMode | null>(null);
  const [offlineReference, setOfflineReference] = useState("");
  const [offlineNote, setOfflineNote] = useState("");
  const reportAttempt = useRef<{ details: string; key: string } | null>(null);

  async function createPaymentOrder(rentEntryId: string) {
    setPayingRentEntryId(rentEntryId);
    setPaymentError(null);
    setPaymentMessage(null);

    try {
      const order = await fetchApi<OnlinePaymentOrderDto>("/tenant-portal/payments/orders", {
        method: "POST",
        body: JSON.stringify({ rentEntryId })
      });
      const paymentId = await openRazorpayCheckout(order);
      setPaymentMessage(
        paymentId
          ? "Payment submitted. The receipt will appear after secure provider confirmation."
          : "Payment window closed. Check your balance before trying again."
      );
      refresh();
    } catch (error) {
      setPaymentError(
        error instanceof ApiError && error.code === "ONLINE_PAYMENTS_DISABLED"
          ? "Online payments are not enabled for this property."
          : error instanceof Error
            ? error.message
            : "Unable to create payment order."
      );
    } finally {
      setPayingRentEntryId(null);
    }
  }

  async function notifyOfflinePayment(mode: OfflinePaymentMode) {
    if (!currentRent || currentBalance <= 0 || payingRentEntryId) return;

    const details = {
      rentEntryId: currentRent.id,
      amount: currentBalance,
      mode,
      referenceNumber: offlineReference.trim() || null,
      note: offlineNote.trim() || null,
    };
    const serialized = JSON.stringify(details);
    if (reportAttempt.current?.details !== serialized) {
      reportAttempt.current = { details: serialized, key: crypto.randomUUID() };
    }

    setPayingRentEntryId(currentRent.id);
    setPaymentError(null);
    setPaymentMessage(null);

    try {
      const result = await fetchApi<{ message: string }>("/tenant-portal/payments/offline", {
        method: "POST",
        body: JSON.stringify({
          ...details,
          idempotencyKey: reportAttempt.current.key,
        })
      });
      setPaymentMessage(result.message);
      setOfflineMode(null);
      setOfflineReference("");
      setOfflineNote("");
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Unable to send payment update.");
    } finally {
      setPayingRentEntryId(null);
    }
  }

  return {
    payingRentEntryId,
    paymentError,
    paymentMessage,
    offlineMode,
    offlineReference,
    offlineNote,
    setOfflineMode,
    setOfflineReference,
    setOfflineNote,
    createPaymentOrder,
    notifyOfflinePayment
  };
}

function TenantDashboardView({
  userName,
  home,
  rentList,
  currentRent,
  currentBalance,
  payable,
  paymentRent,
  onSelectBill,
  payment
}: {
  userName: string;
  home: TenantPortalHomeDto | null;
  rentList: RentEntryDto[];
  currentRent: RentEntryDto | null;
  currentBalance: number;
  payable: RentEntryDto[];
  paymentRent: RentEntryDto | null;
  onSelectBill: (id: string) => void;
  payment: TenantPaymentController;
}) {
  const totalPaid = rentList.reduce((sum, entry) => sum + entry.amountPaid, 0);
  const earlierBalance = payable
    .filter((entry) => entry.id !== currentRent?.id)
    .reduce((sum, entry) => sum + rentBalance(entry), 0);
  const dueDate = currentRent && new Date(currentRent.dueDate).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <header className="dashboard-heading">
        <div>
          <h1>Welcome, {home?.profile.fullName ?? userName}</h1>
          {home && <p><Home size={16} aria-hidden="true" /><strong>{home.profile.propertyName}</strong><span>· Room {home.profile.roomNumber}</span></p>}
        </div>
      </header>

      <div className="dashboard-summary">
        <section className="dashboard-rent">
          <div className="dashboard-panel-heading">
            <h2>Rent balance</h2>
            {currentRent && <StatusBadge className="border-transparent bg-white text-foreground" status={currentRent.status} />}
          </div>
          {currentRent ? (
            <>
              <div className="dashboard-rent-amount"><strong>{formatPaisa(currentBalance)}</strong><span>{currentRent.billingMonth}</span></div>
              <dl className="dashboard-rent-totals">
                <div><dt>Billed</dt><dd>{formatPaisa(currentRent.amountDue)}</dd></div>
                <div><dt>Paid</dt><dd>{formatPaisa(currentRent.amountPaid)}</dd></div>
                <div><dt>Due date</dt><dd>{dueDate}</dd></div>
              </dl>
              {earlierBalance > 0 && (
                <p className="dashboard-no-ledger">
                  {formatPaisa(earlierBalance)} outstanding on earlier bills.{" "}
                  <a href="#pay-rent">View payment options</a>
                </p>
              )}
            </>
          ) : <p className="text-sm">Your first rent bill will appear here.</p>}
        </section>
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading"><h2>My stay</h2></div>
          <dl className="divide-y divide-border text-sm">
            <div className="flex justify-between gap-2 py-2"><dt>Open maintenance requests</dt><dd className="font-bold">{home?.openMaintenanceCount ?? 0}</dd></div>
            <div className="flex justify-between gap-2 py-2"><dt>Rent paid across all months</dt><dd className="text-right font-bold">{formatPaisa(totalPaid)}</dd></div>
          </dl>
          <div className="mt-3"><QuickTenantActions /></div>
        </section>
      </div>

      {payment.paymentMessage && (
        <div role="status" className="rounded-lg border border-info/20 bg-secondary/50 p-3 text-sm font-semibold text-info">
          {payment.paymentMessage}
        </div>
      )}
      {payment.paymentError && (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive-soft p-3 text-sm font-semibold text-destructive">
          {payment.paymentError}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)]">
        <PaymentOptionsCard
          currentRent={paymentRent}
          currentBalance={rentBalance(paymentRent)}
          payable={payable}
          onSelectBill={onSelectBill}
          payingRentEntryId={payment.payingRentEntryId}
          offlineMode={payment.offlineMode}
          offlineReference={payment.offlineReference}
          offlineNote={payment.offlineNote}
          setOfflineMode={payment.setOfflineMode}
          setOfflineReference={payment.setOfflineReference}
          setOfflineNote={payment.setOfflineNote}
          createPaymentOrder={payment.createPaymentOrder}
          notifyOfflinePayment={payment.notifyOfflinePayment}
        />
        <div className="grid content-start gap-4">
          <PaymentHelpCard />
          {home && <ProfileCard home={home} />}
        </div>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        {home ? <NoticesCard home={home} /> : null}
        <RentHistoryCard rentEntries={rentList} />
      </section>
    </div>
  );
}

function TenantDashboardContent() {
  const { user } = useAuth();
  const [paymentRentId, setPaymentRentId] = useState<string | null>(null);
  const tenantId = user?.tenantId;
  const { data: home, loading: homeLoading, error: homeError, refetch: refetchHome } = useApi<TenantPortalHomeDto>(
    tenantId ? "/tenant-portal/home" : null
  );
  const { data: rentEntries, loading: rentLoading, error: rentError, refetch: refetchRent } = useApi<RentEntryDto[]>(
    tenantId ? "/tenant-portal/rent" : null
  );
  const rentList = rentEntries ?? [];
  const currentRent = home?.currentRent ?? rentList[0] ?? null;
  const currentBalance = rentBalance(currentRent);
  const payable = rentList.filter((entry) => rentBalance(entry) > 0);
  const paymentRent = payable.find((entry) => entry.id === paymentRentId) ?? payable[0] ?? null;
  const refresh = () => { refetchHome(); refetchRent(); };
  const payment = useTenantPaymentActions(paymentRent, rentBalance(paymentRent), refresh);

  if (!user?.hasBooking) {
    return <NoBookingState />;
  }

  if (homeLoading || rentLoading) {
    return <TenantLoading />;
  }

  if (homeError || rentError) {
    return <EmptyState title="Could not load your stay" description={homeError ?? rentError ?? undefined}
      action={<Button onClick={refresh}>Try again</Button>} />;
  }

  return (
    <TenantDashboardView
      userName={user.fullName ?? "Tenant"}
      home={home ?? null}
      rentList={rentList}
      currentRent={currentRent}
      currentBalance={currentBalance}
      payable={payable}
      paymentRent={paymentRent}
      onSelectBill={(id) => {
        setPaymentRentId(id);
        payment.setOfflineMode(null);
        payment.setOfflineReference("");
        payment.setOfflineNote("");
      }}
      payment={payment}
    />
  );
}

export default function TenantDashboard() {
  const { authorized } = useRequireRole("TENANT");
  if (!authorized) return null;

  return (
    <TenantLayout activePath="/tenant">
      <TenantDashboardContent />
    </TenantLayout>
  );
}
