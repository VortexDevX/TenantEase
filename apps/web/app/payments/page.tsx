"use client";

import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRoles } from "@/contexts/AuthContext";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { fetchApi } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CircleCheckBig, Loader2, Plus, ReceiptIndianRupee, Send, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { ReminderConfigDto, ReminderLogDto, RentEntryDto } from "@tenantease/types";

// Ledger Calm Shared Components
import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { TenantRentRow } from "@/components/shared/TenantRentRow";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadgeType } from "@/components/shared/StatusBadge";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RentLedgerEntry = RentEntryDto & {
  tenantName?: string;
};

export default function PaymentsPage() {
  const { authorized } = useRequireRoles(["OWNER", "STAFF"]);
  const { activeProperty } = useProperty();
  const propertyId = activeProperty?.id;
  const [generating, setGenerating] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [reminderConfig, setReminderConfig] = useState<ReminderConfigDto | null>(null);
  const [reminderLogs, setReminderLogs] = useState<ReminderLogDto[]>([]);
  const { data: ledger, loading, refetch } = useApi<RentLedgerEntry[]>(
    propertyId ? `/properties/${propertyId}/rent` : null
  );

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthEntries = useMemo(
    () => (ledger ?? []).filter((entry) => entry.billingMonth === currentMonth),
    [currentMonth, ledger]
  );
  const expectedRent = currentMonthEntries.reduce((sum, entry) => sum + entry.amountDue, 0);
  const collectedRent = currentMonthEntries.reduce((sum, entry) => sum + entry.amountPaid, 0);
  const overdueEntries = (ledger ?? []).filter((entry) => entry.status === "OVERDUE");
  const partialEntries = (ledger ?? []).filter((entry) => entry.status === "PARTIAL");
  const collectionPct = expectedRent > 0 ? Math.round((collectedRent / expectedRent) * 100) : 0;

  useEffect(() => {
    if (!propertyId) return;
    fetchApi<ReminderConfigDto>(`/properties/${propertyId}/reminders/config`).then(setReminderConfig).catch(() => setReminderConfig(null));
    fetchApi<ReminderLogDto[]>(`/properties/${propertyId}/reminders/logs`).then(setReminderLogs).catch(() => setReminderLogs([]));
  }, [propertyId]);

  async function handleGenerateRentRoll() {
    if (!propertyId) return;
    setGenerating(true);
    try {
      await fetchApi(`/properties/${propertyId}/rent/generate`, { method: "POST" });
      refetch();
    } catch (err: any) {
      alert(err.message || "Failed to generate rent roll");
    } finally {
      setGenerating(false);
    }
  }

  async function saveReminderConfig() {
    if (!propertyId || !reminderConfig) return;
    setSavingConfig(true);
    try {
      const saved = await fetchApi<ReminderConfigDto>(`/properties/${propertyId}/reminders/config`, {
        method: "PUT",
        body: JSON.stringify(reminderConfig),
      });
      setReminderConfig(saved);
    } finally {
      setSavingConfig(false);
    }
  }

  async function sendOverdueReminders() {
    if (!propertyId) return;
    setSendingReminders(true);
    try {
      await fetchApi(`/properties/${propertyId}/reminders/send`, {
        method: "POST",
        body: JSON.stringify({ mode: "OVERDUE" }),
      });
      const logs = await fetchApi<ReminderLogDto[]>(`/properties/${propertyId}/reminders/logs`);
      setReminderLogs(logs);
      refetch();
    } finally {
      setSendingReminders(false);
    }
  }

  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/payments">
      <div className="flex flex-col gap-6 animate-fade-in pb-10">

        <PageHeader
          title="Payments & Ledgers"
          description="Review expected rent, collected amounts, and outstanding balances for the active property."
          actions={
            <>
              <Button
                onClick={handleGenerateRentRoll}
                disabled={!propertyId || generating}
                variant="outline"
                className="shadow-sm"
              >
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                Generate Rent Roll
              </Button>
              <Button asChild className="rounded-xl shadow-soft">
                <Link href="/payments/new">
                  <Plus className="mr-2 h-4 w-4" /> Record Payment
                </Link>
              </Button>
            </>
          }
        />

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard
            title="Expected This Month"
            value={<MoneyValue amount={expectedRent} />}
          />
          <MetricCard
            title="Collected"
            value={<MoneyValue amount={collectedRent} />}
          />
          <MetricCard
            title="Overdue Entries"
            value={overdueEntries.length}
          />
          <MetricCard
            title="Collection Rate"
            value={`${collectionPct}%`}
          />
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-destructive/20 bg-destructive-soft/10 backdrop-blur-md shadow-soft relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1 bg-destructive" />
            <div className="flex items-center gap-3.5 p-5 pl-6">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-semibold text-foreground">Overdue attention</p>
                <p className="text-sm text-muted-foreground font-medium">{overdueEntries.length} overdue entries need follow-up right now.</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-warning/20 bg-warning-soft/10 backdrop-blur-md shadow-soft relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1 bg-warning" />
            <div className="flex items-center gap-3.5 p-5 pl-6">
              <CircleCheckBig className="h-5 w-5 text-warning" />
              <div>
                <p className="font-semibold text-foreground">Partial payments</p>
                <p className="text-sm text-muted-foreground font-medium">{partialEntries.length} tenants have partially settled this month.</p>
              </div>
            </div>
          </div>
        </div>

        {reminderConfig && (
          <Card className="shadow-soft">
            <div className="flex flex-col gap-3 border-b border-white/[0.04] bg-white/[0.02] p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold">Rent Reminders</h2>
                <p className="text-sm text-muted-foreground">Configure timing, then send logged in-app/SMS reminders to overdue tenants.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={saveReminderConfig} disabled={savingConfig}>
                  {savingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Config
                </Button>
                <Button onClick={sendOverdueReminders} disabled={!propertyId || sendingReminders}>
                  {sendingReminders ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send Overdue
                </Button>
              </div>
            </div>
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr_1.2fr]">
              <div>
                <label htmlFor="reminder-pre-due-days" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pre-Due Days</label>
                <Input id="reminder-pre-due-days" type="number" min={0} max={30} value={reminderConfig.preDueDays} onChange={(e) => setReminderConfig({ ...reminderConfig, preDueDays: Number(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="reminder-frequency" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overdue Frequency</label>
                <select
                  id="reminder-frequency"
                  value={reminderConfig.overdueFrequency}
                  onChange={(e) => setReminderConfig({ ...reminderConfig, overdueFrequency: e.target.value as "DAILY" | "WEEKLY" })}
                  className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-medium text-foreground focus:border-primary/50 outline-none"
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm font-medium">
                {(["inAppEnabled", "smsEnabled", "whatsappEnabled", "emailEnabled"] as const).map((key) => (
                  <label key={key} className="flex h-11 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 cursor-pointer">
                    <input type="checkbox" checked={reminderConfig[key]} onChange={(e) => setReminderConfig({ ...reminderConfig, [key]: e.target.checked })} />
                    {key.replace("Enabled", "").replace("inApp", "In-app")}
                  </label>
                ))}
              </div>
              <div className="lg:col-span-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Reminder Logs</p>
                <div className="max-h-40 overflow-auto rounded-lg border border-white/[0.06]">
                  {reminderLogs.length > 0 ? reminderLogs.slice(0, 6).map((log) => (
                    <div key={log.id} className="flex items-center justify-between gap-3 border-b border-white/[0.04] p-3 text-sm last:border-0">
                      <span className="font-medium text-foreground">{log.tenantName}</span>
                      <span className="text-muted-foreground">{log.channel} · {log.status}</span>
                    </div>
                  )) : (
                    <div className="p-4 text-sm text-muted-foreground">No reminders sent yet.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-float">
          <div className="flex items-center justify-between border-b border-white/[0.04] bg-white/[0.02] p-4">
            <h2 className="text-lg font-bold">Rent Ledger</h2>
            <Button variant="outline" size="sm" onClick={refetch}>Refresh</Button>
          </div>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : ledger && ledger.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Billing Month</TableHead>
                    <TableHead className="text-right">Amount Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((entry) => (
                    <TenantRentRow
                      key={entry.id}
                      tenantName={entry.tenantName ?? entry.tenantId}
                      roomName={entry.billingMonth}
                      amount={entry.amountDue}
                      status={entry.status as StatusBadgeType}
                      dueDate={new Date(entry.dueDate)}
                      actions={
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/payments/new?tenantId=${entry.tenantId}`}>Record Payment</Link>
                        </Button>
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="No rent ledger yet"
                description="Generate the current month rent roll first. Once rent entries exist, this page will show due, paid, and outstanding balances."
                icon={<ReceiptIndianRupee />}
                className="py-16"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
