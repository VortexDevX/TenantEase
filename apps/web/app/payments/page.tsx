"use client";

import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { fetchApi } from "@/lib/api-client";
import { formatPaisa } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CircleCheckBig, Loader2, Plus, ReceiptIndianRupee, Send, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { ReminderConfigDto, ReminderLogDto, RentEntryDto } from "@tenantease/types";

type RentLedgerEntry = RentEntryDto & {
  tenantName?: string;
};

export default function PaymentsPage() {
  const { authorized } = useRequireRole("OWNER");
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <section>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
              <ReceiptIndianRupee className="h-8 w-8 text-primary" /> Payments & Ledgers
            </h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Review expected rent, collected amounts, and outstanding balances for the active property.
            </p>
          </section>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleGenerateRentRoll}
              disabled={!propertyId || generating}
              variant="outline"
              className="shadow-sm"
            >
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
              Generate Rent Roll
            </Button>
            <Link href="/payments/new">
              <Button className="rounded-xl shadow-soft">
                <Plus className="mr-2 h-4 w-4" /> Record Payment
              </Button>
            </Link>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <Card className="border-border shadow-soft">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Expected This Month</p>
              <p className="mt-3 text-3xl font-bold text-foreground">{formatPaisa(expectedRent)}</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-soft">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Collected</p>
              <p className="mt-3 text-3xl font-bold text-foreground">{formatPaisa(collectedRent)}</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-soft">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Overdue Entries</p>
              <p className="mt-3 text-3xl font-bold text-foreground">{overdueEntries.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-soft">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Collection Rate</p>
              <p className="mt-3 text-3xl font-bold text-foreground">{collectionPct}%</p>
            </CardContent>
          </Card>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/80">
            <CardContent className="flex items-center gap-3 p-5">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-semibold text-foreground">Overdue attention</p>
                <p className="text-sm text-muted-foreground">{overdueEntries.length} overdue entries need follow-up right now.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/80">
            <CardContent className="flex items-center gap-3 p-5">
              <CircleCheckBig className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="font-semibold text-foreground">Partial payments</p>
                <p className="text-sm text-muted-foreground">{partialEntries.length} tenants have partially settled this month.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {reminderConfig && (
          <Card className="border-border shadow-soft">
            <div className="flex flex-col gap-3 border-b border-border bg-secondary/30 p-4 lg:flex-row lg:items-center lg:justify-between">
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
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pre-Due Days</label>
                <Input type="number" min={0} max={30} value={reminderConfig.preDueDays} onChange={(e) => setReminderConfig({ ...reminderConfig, preDueDays: Number(e.target.value) })} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overdue Frequency</label>
                <select
                  value={reminderConfig.overdueFrequency}
                  onChange={(e) => setReminderConfig({ ...reminderConfig, overdueFrequency: e.target.value as "DAILY" | "WEEKLY" })}
                  className="h-12 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium"
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm font-medium">
                {(["inAppEnabled", "smsEnabled", "whatsappEnabled", "emailEnabled"] as const).map((key) => (
                  <label key={key} className="flex h-12 items-center gap-2 rounded-lg border border-border px-3">
                    <input type="checkbox" checked={reminderConfig[key]} onChange={(e) => setReminderConfig({ ...reminderConfig, [key]: e.target.checked })} />
                    {key.replace("Enabled", "").replace("inApp", "In-app")}
                  </label>
                ))}
              </div>
              <div className="lg:col-span-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Reminder Logs</p>
                <div className="max-h-40 overflow-auto rounded-lg border border-border">
                  {reminderLogs.length > 0 ? reminderLogs.slice(0, 6).map((log) => (
                    <div key={log.id} className="flex items-center justify-between gap-3 border-b border-border p-3 text-sm last:border-0">
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

        <Card className="border-border shadow-float">
          <div className="flex items-center justify-between border-b border-border bg-secondary/30 p-4">
            <h2 className="text-lg font-bold">Rent Ledger</h2>
            <Button variant="outline" size="sm" onClick={refetch}>Refresh</Button>
          </div>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : ledger && ledger.length > 0 ? (
              <div className="divide-y divide-border">
                {ledger.slice(0, 12).map((entry) => {
                  const balance = entry.amountDue - entry.amountPaid;
                  return (
                    <div key={entry.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">{entry.tenantName ?? entry.tenantId}</span>
                          <Badge
                            variant={
                              entry.status === "PAID"
                                ? "success"
                                : entry.status === "OVERDUE"
                                ? "destructive"
                                : entry.status === "PARTIAL"
                                ? "warning"
                                : "secondary"
                            }
                          >
                            {entry.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {entry.billingMonth} · due {new Date(entry.dueDate).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="grid flex-1 grid-cols-3 gap-4 lg:max-w-md">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Due</p>
                          <p className="mt-1 font-semibold text-foreground">{formatPaisa(entry.amountDue)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Paid</p>
                          <p className="mt-1 font-semibold text-foreground">{formatPaisa(entry.amountPaid)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Balance</p>
                          <p className="mt-1 font-semibold text-foreground">{formatPaisa(balance)}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link href={`/payments/new?tenantId=${entry.tenantId}`}>
                          <Button variant="outline" size="sm">Record Payment</Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-16 text-center">
                <ReceiptIndianRupee className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                <h3 className="text-lg font-bold text-foreground">No rent ledger yet</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Generate the current month rent roll first. Once rent entries exist, this page will show due, paid, and outstanding balances.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
