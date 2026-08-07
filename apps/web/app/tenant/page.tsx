"use client";

import { useState } from "react";
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
import { MetricCard } from "@/components/shared/MetricCard";
import { MobileListCard } from "@/components/shared/MobileListCard";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { PageHeader } from "@/components/shared/PageHeader";
import { QuickActionBar } from "@/components/shared/QuickActionBar";
import { RentLedgerStrip } from "@/components/shared/RentLedgerStrip";
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
      icon={<Clock className="h-7 w-7 text-violet-400" />}
      className="min-h-[60vh] border border-white/[0.06] bg-white/[0.01] rounded-xl"
    />
  );
}

function TenantLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <Card key={item} className="h-32 animate-pulse bg-white/[0.02] border border-white/[0.04]" />
      ))}
      <div className="col-span-full flex items-center justify-center py-10">
        <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
      </div>
    </div>
  );
}

function ProfileCard({ home }: { home: TenantPortalHomeDto }) {
  return (
    <Card className="shadow-glass border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="border-b border-white/[0.04] p-5">
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <Home className="h-5 w-5 text-violet-400" />
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
    <Card className="shadow-glass border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="border-b border-white/[0.04] p-5">
        <CardTitle className="text-lg text-foreground">Recent Notices</CardTitle>
      </CardHeader>
      <div className="space-y-3 p-4">
        {home.recentNotifications.slice(0, 4).map((notice) => (
          <MobileListCard
            key={notice.id}
            title={notice.title}
            meta={new Date(notice.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            status={!notice.readAt ? <StatusBadge status="NEW" /> : null}
            className="border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.02]"
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
    <Card className="shadow-glass border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="border-b border-white/[0.04] p-5">
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
              className="border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.02]"
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
            icon={<FileText className="h-6 w-6 text-violet-400" />}
            className="py-10 border border-white/[0.06] bg-white/[0.01] rounded-xl"
          />
        )}
      </div>
    </Card>
  );
}

function PaymentOptionsCard({
  currentRent,
  currentBalance,
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
    <Card className="shadow-glass border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="border-b border-white/[0.04] p-5">
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <IndianRupee className="h-5 w-5 text-violet-400" />
          Pay Rent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-end justify-between gap-4 rounded-lg border border-white/[0.08] bg-white/[0.01] p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pending Balance</p>
            <MoneyValue amount={currentBalance} size="lg" />
          </div>
          {currentRent ? <StatusBadge status={currentRent.status} /> : null}
        </div>

        <Button
          type="button"
          className="w-full justify-center bg-violet-500 hover:bg-violet-600 text-white font-bold transition-all shadow-md hover:shadow-violet-500/20"
          disabled={!canPay || !currentRent || payingRentEntryId === currentRent.id}
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
                disabled={!canPay}
                onClick={() => setOfflineMode(offlineMode === option.mode ? null : option.mode)}
                className={`rounded-lg border p-3 text-left transition-all hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-50
                  ${isSelected ? 'border-violet-500 bg-violet-500/[0.03] shadow-glow' : 'border-white/[0.08] bg-white/[0.01]'}
                `}
              >
                <Icon className={`h-5 w-5 ${isSelected ? 'text-violet-400' : 'text-muted-foreground'}`} />
                <p className="mt-2 text-sm font-bold text-foreground">{option.label}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">{option.description}</p>
              </button>
            );
          })}
        </div>

        {offlineMode ? (
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.01] p-4 animate-slide-in">
            <p className="text-sm font-bold text-foreground mb-3">
              Notify owner: {OFFLINE_PAYMENT_OPTIONS.find((option) => option.mode === offlineMode)?.label}
            </p>
            <div className="grid gap-3">
              <input
                value={offlineReference}
                onChange={(event) => setOfflineReference(event.target.value)}
                placeholder={offlineMode === "CASH" ? "Cash receipt note optional" : "Reference / transaction ID"}
                className="h-10 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50 outline-none"
              />
              <textarea
                rows={2}
                value={offlineNote}
                onChange={(event) => setOfflineNote(event.target.value)}
                placeholder="Message to owner optional"
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50 outline-none placeholder:text-muted-foreground"
              />
              <Button type="button" onClick={() => notifyOfflinePayment(offlineMode)} className="bg-violet-500 hover:bg-violet-600 text-white font-bold">
                Send Payment Update
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
    <Card className="shadow-glass border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="border-b border-white/[0.04] p-5">
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <ShieldCheck className="h-5 w-5 text-violet-400" />
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
    <Card className="shadow-glass border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="border-b border-white/[0.04] p-5">
        <CardTitle className="text-lg text-foreground">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
        <Button asChild variant="outline" className="justify-start border-white/[0.08] hover:bg-white/[0.04] hover:text-violet-400">
          <a href="/tenant/maintenance"><Wrench className="mr-2 h-4 w-4" />Raise Issue</a>
        </Button>
        <Button asChild variant="outline" className="justify-start border-white/[0.08] hover:bg-white/[0.04] hover:text-violet-400">
          <a href="/tenant/receipts"><ReceiptText className="mr-2 h-4 w-4" />View Receipts</a>
        </Button>
        <Button asChild variant="outline" className="justify-start border-white/[0.08] hover:bg-white/[0.04] hover:text-violet-400">
          <a href="/tenant/announcements"><MessageSquare className="mr-2 h-4 w-4" />Notices</a>
        </Button>
        <Button asChild variant="outline" className="justify-start border-white/[0.08] hover:bg-white/[0.04] hover:text-violet-400">
          <a href="/tenant/agreements"><FileText className="mr-2 h-4 w-4" />Agreement</a>
        </Button>
      </CardContent>
    </Card>
  );
}

function useTenantPaymentActions(currentRent: RentEntryDto | null, currentBalance: number) {
  const [payingRentEntryId, setPayingRentEntryId] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<OnlinePaymentOrderDto | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState<OfflinePaymentMode | null>(null);
  const [offlineReference, setOfflineReference] = useState("");
  const [offlineNote, setOfflineNote] = useState("");

  async function createPaymentOrder(rentEntryId: string) {
    setPayingRentEntryId(rentEntryId);
    setPaymentOrder(null);
    setPaymentError(null);
    setPaymentMessage(null);

    try {
      const order = await fetchApi<OnlinePaymentOrderDto>("/tenant-portal/payments/orders", {
        method: "POST",
        body: JSON.stringify({ rentEntryId })
      });
      setPaymentOrder(order);
      const paymentId = await openRazorpayCheckout(order);
      setPaymentMessage(
        paymentId
          ? "Payment submitted. The receipt will appear after secure provider confirmation."
          : "Payment window closed. No payment was recorded."
      );
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
    if (!currentRent || currentBalance <= 0) return;

    setPayingRentEntryId(currentRent.id);
    setPaymentError(null);
    setPaymentMessage(null);

    try {
      const result = await fetchApi<{ message: string }>("/tenant-portal/payments/offline", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          rentEntryId: currentRent.id,
          amount: currentBalance,
          mode,
          referenceNumber: offlineReference.trim() || null,
          note: offlineNote.trim() || null
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
    paymentOrder,
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
  payment
}: {
  userName: string;
  home: TenantPortalHomeDto | null;
  rentList: RentEntryDto[];
  currentRent: RentEntryDto | null;
  currentBalance: number;
  payment: TenantPaymentController;
}) {
  const canPayCurrentRent = Boolean(currentRent && currentBalance > 0 && currentRent.status !== "PAID");
  const totalPaid = rentList.reduce((sum, entry) => sum + entry.amountPaid, 0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title={`Welcome, ${home?.profile.fullName ?? userName}`}
        description={
          home?.profile.propertyName
            ? `${home.profile.propertyName} - Room ${home.profile.roomNumber}`
            : "Your rent, receipts, and maintenance summary."
        }
        actions={
          currentRent ? (
            <QuickActionBar>
              <Button
                type="button"
                className="justify-start sm:w-auto bg-violet-500 hover:bg-violet-600 text-white font-bold"
                disabled={!canPayCurrentRent || payment.payingRentEntryId === currentRent.id}
                onClick={() => payment.createPaymentOrder(currentRent.id)}
              >
                {payment.payingRentEntryId === currentRent.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                Pay Rent
              </Button>
            </QuickActionBar>
          ) : null
        }
      />

      {currentRent ? (
        <RentLedgerStrip
          monthLabel={`${currentRent.billingMonth} rent status`}
          className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-5 shadow-glass"
          items={[
            { id: "bill", label: "Bill", value: currentRent.amountDue, isMoney: true },
            { id: "paid", label: "Paid", value: currentRent.amountPaid, isMoney: true, color: "success" },
            { id: "balance", label: "Balance", value: currentBalance, isMoney: true, color: currentBalance > 0 ? "warning" : "success" },
            { id: "status", label: "Status", value: <StatusBadge status={currentRent.status} /> }
          ]}
        />
      ) : null}

      {payment.paymentOrder && (
        <div className="rounded-lg border border-success/20 bg-success-soft/10 p-3 text-sm font-semibold text-success shadow-glass-success">
          Secure payment order created for {formatPaisa(payment.paymentOrder.amount)}.
        </div>
      )}
      {payment.paymentMessage && (
        <div className="rounded-lg border border-success/20 bg-success-soft/10 p-3 text-sm font-semibold text-success shadow-glass-success">
          {payment.paymentMessage}
        </div>
      )}
      {payment.paymentError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive-soft/10 p-3 text-sm font-semibold text-destructive shadow-glass-error">
          {payment.paymentError}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          title="Current Balance"
          value={<MoneyValue amount={currentBalance} />}
          icon={<IndianRupee className="text-violet-400" />}
          subtitle={currentRent?.billingMonth ?? "No bill yet"}
        />
        <MetricCard
          title="Open Requests"
          value={home?.openMaintenanceCount ?? 0}
          icon={<Wrench className="text-violet-400" />}
          subtitle={(home?.openMaintenanceCount ?? 0) === 0 ? "All clear" : "Awaiting resolution"}
        />
        <MetricCard
          title="Total Paid"
          value={<MoneyValue amount={totalPaid} />}
          icon={<FileText className="text-violet-400" />}
          subtitle="Across all months"
        />
      </section>

      {home ? <ProfileCard home={home} /> : null}
      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <PaymentOptionsCard
          currentRent={currentRent}
          currentBalance={currentBalance}
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
        <div className="grid gap-6">
          <PaymentHelpCard />
          <QuickTenantActions />
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
  const tenantId = user?.tenantId;
  const { data: home, loading: homeLoading } = useApi<TenantPortalHomeDto>(
    tenantId ? "/tenant-portal/home" : null
  );
  const { data: rentEntries, loading: rentLoading } = useApi<RentEntryDto[]>(
    tenantId ? "/tenant-portal/rent" : null
  );
  const rentList = rentEntries ?? [];
  const currentRent = home?.currentRent ?? rentList[0] ?? null;
  const currentBalance = rentBalance(currentRent);
  const payment = useTenantPaymentActions(currentRent, currentBalance);

  if (!user?.hasBooking) {
    return <NoBookingState />;
  }

  if (homeLoading || rentLoading) {
    return <TenantLoading />;
  }

  return (
    <TenantDashboardView
      userName={user.fullName ?? "Tenant"}
      home={home ?? null}
      rentList={rentList}
      currentRent={currentRent}
      currentBalance={currentBalance}
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
