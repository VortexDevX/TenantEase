"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BedDouble,
  Download,
  IndianRupee,
  Loader2,
  TrendingUp,
  Users
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRoles } from "@/contexts/AuthContext";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { fetchApiBlob } from "@/lib/api-client";
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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type MonthlyReport = {
  period: string;
  income: {
    netExpected: number;
    totalCollected: number;
    totalOutstanding: number;
    collectionRate: number;
    tenantsPaid: number;
    tenantsUnpaid: number;
  };
  payments: {
    cash: number;
    upi: number;
    bankTransfer: number;
    online: number;
    total: number;
  };
  occupancy: {
    totalRooms: number;
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    occupancyRate: number;
  };
  defaulters: Array<{
    name: string;
    room: string;
    amountDue: number;
    daysOverdue: number;
  }>;
};

type AnnualReport = {
  financialYear: string;
  monthly: Array<{
    billingMonth: string;
    expected: number;
    collected: number;
    outstanding: number;
  }>;
  totals: {
    expected: number;
    collected: number;
    outstanding: number;
  };
};

type PaymentBreakdownItem = {
  label: string;
  amount: number;
  tone: string;
};

function periodYears(currentYear: number) {
  return [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
}

function reportUrl(propertyId: string | undefined, month: number, year: number) {
  return propertyId ? `/properties/${propertyId}/reports/monthly?month=${month}&year=${year}` : null;
}

function annualUrl(propertyId: string | undefined, year: number) {
  return propertyId ? `/properties/${propertyId}/reports/annual?fy=${year}` : null;
}

function PeriodControls({
  month,
  setMonth,
  year,
  setYear,
  onExport,
  exportDisabled
}: {
  month: number;
  setMonth: (month: number) => void;
  year: number;
  setYear: (year: number) => void;
  onExport: () => void;
  exportDisabled: boolean;
}) {
  return (
    <QuickActionBar>
      <select
        value={month}
        onChange={(event) => setMonth(parseInt(event.target.value, 10))}
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground"
      >
        {MONTHS.map((label, index) => (
          <option key={label} value={index + 1}>{label}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={(event) => setYear(parseInt(event.target.value, 10))}
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground"
      >
        {periodYears(new Date().getFullYear()).map((value) => (
          <option key={value} value={value}>{value}</option>
        ))}
      </select>
      <Button type="button" variant="outline" onClick={onExport} disabled={exportDisabled}>
        <Download className="mr-2 h-4 w-4" />
        Export CSV
      </Button>
    </QuickActionBar>
  );
}

function ReportLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function SummaryMetrics({ report }: { report: MonthlyReport }) {
  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard
        title="Expected"
        value={<MoneyValue amount={report.income.netExpected} />}
        icon={<IndianRupee className="text-primary" />}
      />
      <MetricCard
        title="Collected"
        value={<MoneyValue amount={report.income.totalCollected} className="text-success" />}
        icon={<TrendingUp className="text-primary" />}
      />
      <MetricCard
        title="Outstanding"
        value={<MoneyValue amount={report.income.totalOutstanding} className="text-warning" />}
        icon={<AlertTriangle className="text-primary" />}
      />
      <MetricCard
        title="Collection"
        value={`${report.income.collectionRate}%`}
        icon={<Users className="text-primary" />}
        subtitle={`${report.income.tenantsPaid} paid, ${report.income.tenantsUnpaid} unpaid`}
      />
    </section>
  );
}

function paymentBreakdown(report: MonthlyReport): PaymentBreakdownItem[] {
  return [
    { label: "Cash", amount: report.payments.cash, tone: "bg-success" },
    { label: "UPI", amount: report.payments.upi, tone: "bg-primary" },
    { label: "Bank Transfer", amount: report.payments.bankTransfer, tone: "bg-info" },
    { label: "Online", amount: report.payments.online, tone: "bg-warning" }
  ];
}

function PaymentsBreakdown({ report }: { report: MonthlyReport }) {
  const total = Math.max(report.payments.total, 1);

  return (
    <Card className="shadow-card">
      <CardHeader className="border-b border-border p-5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Payments by Mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {paymentBreakdown(report).map((item) => {
          const percent = Math.round((item.amount / total) * 100);
          return (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-muted-foreground">{item.label}</span>
                <MoneyValue amount={item.amount} size="sm" />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className={`h-full rounded-full ${item.tone}`} style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function OccupancyCard({ report }: { report: MonthlyReport }) {
  return (
    <Card className="shadow-card">
      <CardHeader className="border-b border-border p-5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BedDouble className="h-5 w-5 text-primary" />
          Occupancy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <RentLedgerStrip
          monthLabel="Bed movement"
          items={[
            { id: "rooms", label: "Rooms", value: report.occupancy.totalRooms },
            { id: "beds", label: "Beds", value: report.occupancy.totalBeds },
            { id: "occupied", label: "Occupied", value: report.occupancy.occupiedBeds, color: "success" },
            { id: "vacant", label: "Vacant", value: report.occupancy.vacantBeds, color: "warning" }
          ]}
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="text-muted-foreground">Occupancy rate</span>
            <span className="text-foreground">{report.occupancy.occupancyRate}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${report.occupancy.occupancyRate}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DefaultersCard({ report }: { report: MonthlyReport }) {
  if (report.defaulters.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="border-b border-border p-5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Defaulters
        </CardTitle>
      </CardHeader>
      <div className="space-y-3 p-4">
        {report.defaulters.map((defaulter) => (
          <MobileListCard
            key={`${defaulter.name}-${defaulter.room}`}
            title={defaulter.name}
            meta={`Room ${defaulter.room}`}
            value={<MoneyValue amount={defaulter.amountDue} size="sm" />}
            status={<StatusBadge status={defaulter.daysOverdue > 15 ? "OVERDUE" : "PENDING"} />}
          >
            <span className="text-xs font-medium text-muted-foreground">
              {defaulter.daysOverdue} day{defaulter.daysOverdue === 1 ? "" : "s"} overdue
            </span>
          </MobileListCard>
        ))}
      </div>
    </Card>
  );
}

function AnnualSummary({ annual }: { annual: AnnualReport | null | undefined }) {
  if (!annual) {
    return null;
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="border-b border-border p-5">
        <CardTitle className="text-lg">{annual.financialYear} Summary</CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <RentLedgerStrip
          monthLabel="Annual ledger"
          items={[
            { id: "expected", label: "Expected", value: annual.totals.expected, isMoney: true },
            { id: "collected", label: "Collected", value: annual.totals.collected, isMoney: true, color: "success" },
            { id: "outstanding", label: "Outstanding", value: annual.totals.outstanding, isMoney: true, color: "warning" },
            { id: "months", label: "Months", value: annual.monthly.length }
          ]}
        />
      </CardContent>
    </Card>
  );
}

function ReportBody({ report, annual }: { report: MonthlyReport; annual: AnnualReport | null | undefined }) {
  return (
    <>
      <RentLedgerStrip
        monthLabel={`${report.period} ledger`}
        className="rounded-lg border border-border bg-card p-5 shadow-card"
        items={[
          { id: "expected", label: "Expected", value: report.income.netExpected, isMoney: true },
          { id: "collected", label: "Collected", value: report.income.totalCollected, isMoney: true, color: "success" },
          { id: "outstanding", label: "Outstanding", value: report.income.totalOutstanding, isMoney: true, color: "warning" },
          { id: "rate", label: "Collection", value: `${report.income.collectionRate}%`, color: report.income.collectionRate >= 85 ? "success" : "warning" }
        ]}
      />
      <SummaryMetrics report={report} />
      <section className="grid gap-6 lg:grid-cols-2">
        <PaymentsBreakdown report={report} />
        <OccupancyCard report={report} />
      </section>
      <DefaultersCard report={report} />
      <AnnualSummary annual={annual} />
    </>
  );
}

export default function ReportsPage() {
  const { authorized } = useRequireRoles(["OWNER", "STAFF"]);
  const { activeProperty } = useProperty();
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { data: report, loading } = useApi<MonthlyReport>(reportUrl(activeProperty?.id, month, year));
  const { data: annual } = useApi<AnnualReport>(annualUrl(activeProperty?.id, year));

  async function exportMonthly() {
    if (!activeProperty || !report) return;

    const blob = await fetchApiBlob(`/properties/${activeProperty.id}/reports/monthly/export?month=${month}&year=${year}`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tenantease-${year}-${String(month).padStart(2, "0")}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/reports">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Reports"
          description={activeProperty ? `${activeProperty.name} monthly and annual performance.` : "Select a property to view financial reports."}
          actions={
            <PeriodControls
              month={month}
              setMonth={setMonth}
              year={year}
              setYear={setYear}
              onExport={exportMonthly}
              exportDisabled={!activeProperty || !report}
            />
          }
        />

        {loading ? <ReportLoading /> : null}
        {!loading && !report ? (
          <EmptyState
            title="No report data"
            description="Generate rent or select another period to see reporting."
            icon={<IndianRupee className="h-6 w-6" />}
          />
        ) : null}
        {!loading && report ? <ReportBody report={report} annual={annual} /> : null}
      </div>
    </DashboardLayout>
  );
}
