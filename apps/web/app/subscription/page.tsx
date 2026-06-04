"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchApi } from "@/lib/api-client";
import type { InvoiceDto, SubscriptionDto, SubscriptionPlanDto } from "@tenantease/types";
import { CheckCircle2, Crown, Loader2, ReceiptText, WalletCards } from "lucide-react";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value / 100);
}

export default function SubscriptionPage() {
  const { authorized } = useRequireRole("OWNER");
  const [subscription, setSubscription] = useState<SubscriptionDto | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanDto[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authorized) return;

    setLoading(true);
    setError(null);
    Promise.all([
      fetchApi<SubscriptionDto>("/subscription"),
      fetchApi<SubscriptionPlanDto[]>("/subscription/plans"),
      fetchApi<InvoiceDto[]>("/subscription/invoices")
    ])
      .then(([subscriptionData, planData, invoiceData]) => {
        setSubscription(subscriptionData);
        setPlans(planData);
        setInvoices(invoiceData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load subscription"))
      .finally(() => setLoading(false));
  }, [authorized]);

  const usagePercent = useMemo(() => {
    if (!subscription || subscription.maxProperties <= 0) return 0;
    return Math.min(100, Math.round((subscription.usage.properties / subscription.maxProperties) * 100));
  }, [subscription]);

  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/subscription">
      <div className="flex flex-col gap-6 pb-10">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <section>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
              <Crown className="h-8 w-8 text-primary" />
              Plan & Billing
            </h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Property limits, enabled channels, and invoices for this owner account.
            </p>
          </section>
          {subscription ? (
            <Badge variant={subscription.status === "ACTIVE" ? "success" : "warning"}>
              {subscription.status}
            </Badge>
          ) : null}
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-5 text-sm font-semibold text-destructive">{error}</CardContent>
          </Card>
        ) : subscription ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-border/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <WalletCards className="h-5 w-5 text-primary" />
                    {subscription.plan} plan
                  </CardTitle>
                  <CardDescription>
                    Current account capacity and billing feature flags.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                      <span>Properties</span>
                      <span>
                        {subscription.usage.properties} / {subscription.maxProperties}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary transition-all" style={{ width: `${usagePercent}%` }} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Staff accounts", subscription.maxStaffAccounts.toString()],
                      ["SMS reminders", subscription.smsEnabled ? "Enabled" : "Off"],
                      ["WhatsApp", subscription.whatsappEnabled ? "Enabled" : "Off"],
                      ["Online payments", subscription.onlinePaymentsEnabled ? "Enabled" : "Off"]
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-border bg-secondary/20 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                        <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <ReceiptText className="h-5 w-5 text-primary" />
                    Invoices
                  </CardTitle>
                  <CardDescription>Generated subscription invoices.</CardDescription>
                </CardHeader>
                <CardContent>
                  {invoices.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-5 text-sm font-medium text-muted-foreground">
                      No invoices yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {invoices.map((invoice) => (
                        <div key={invoice.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div>
                            <p className="text-sm font-bold text-foreground">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(invoice.periodStart).toLocaleDateString()} - {new Date(invoice.periodEnd).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{formatMoney(invoice.amount)}</p>
                            <Badge variant={invoice.status === "PAID" ? "success" : "secondary"}>{invoice.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan) => {
                const isCurrent = plan.plan === subscription.plan;
                return (
                  <Card key={plan.plan} className={`border-border/80 ${isCurrent ? "ring-2 ring-primary/30" : ""}`}>
                    <CardHeader className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-lg">{plan.label}</CardTitle>
                        {isCurrent ? <Badge variant="success">Current</Badge> : plan.recommended ? <Badge>Best fit</Badge> : null}
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{formatMoney(plan.priceMonthly)}</p>
                        <p className="text-xs font-medium text-muted-foreground">per month</p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2 text-sm">
                        {[
                          `${plan.maxProperties === 999 ? "Unlimited" : plan.maxProperties} properties`,
                          `${plan.maxStaffAccounts} staff accounts`,
                          plan.smsEnabled ? "SMS channel" : "In-app reminders",
                          plan.onlinePaymentsEnabled ? "Online payments" : "Manual payments"
                        ].map((item) => (
                          <div key={item} className="flex items-center gap-2 font-medium text-foreground">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            {item}
                          </div>
                        ))}
                      </div>
                      <Button className="w-full" disabled variant={isCurrent ? "secondary" : "outline"}>
                        {isCurrent ? "Active plan" : "Razorpay pending"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
