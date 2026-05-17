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
import { AlertCircle, CircleCheckBig, Loader2, Plus, ReceiptIndianRupee, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { RentEntryDto } from "@tenantease/types";

type RentLedgerEntry = RentEntryDto & {
  tenantName?: string;
};

export default function PaymentsPage() {
  const { authorized } = useRequireRole("OWNER");
  const { activeProperty } = useProperty();
  const propertyId = activeProperty?.id;
  const [generating, setGenerating] = useState(false);
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
