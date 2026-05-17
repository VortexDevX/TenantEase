"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPaisa } from "@/lib/format";
import { Loader2, TrendingUp, TrendingDown, Users, BedDouble, AlertTriangle } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ReportsPage() {
  const { authorized } = useRequireRole("OWNER");
  const { activeProperty } = useProperty();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const url = activeProperty
    ? `/properties/${activeProperty.id}/reports/monthly?month=${month}&year=${year}`
    : null;
  const { data: report, loading } = useApi<any>(url);

  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/reports">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Reports & Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monthly financial overview and performance metrics.
            </p>
          </div>

          {/* Month/Year Selector */}
          <div className="flex gap-3">
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !report ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No report data available. Select a property and period.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Period Header */}
            <div className="text-lg font-semibold text-foreground">{report.period}</div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expected</div>
                  <div className="text-2xl font-bold text-foreground mt-1">{formatPaisa(report.income?.netExpected ?? 0)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collected</div>
                  <div className="text-2xl font-bold text-green-600 mt-1">{formatPaisa(report.income?.totalCollected ?? 0)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outstanding</div>
                  <div className="text-2xl font-bold text-orange-500 mt-1">{formatPaisa(report.income?.totalOutstanding ?? 0)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collection Rate</div>
                  <div className="text-2xl font-bold text-primary mt-1">{report.income?.collectionRate ?? 0}%</div>
                </CardContent>
              </Card>
            </div>

            {/* Payments & Occupancy Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payments Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    Payments by Mode
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: "Cash", value: report.payments?.cash ?? 0, color: "bg-emerald-500" },
                      { label: "UPI", value: report.payments?.upi ?? 0, color: "bg-blue-500" },
                      { label: "Bank Transfer", value: report.payments?.bankTransfer ?? 0, color: "bg-purple-500" },
                      { label: "Online", value: report.payments?.online ?? 0, color: "bg-orange-500" },
                    ].map((item) => {
                      const total = report.payments?.total || 1;
                      const pct = Math.round((item.value / total) * 100) || 0;
                      return (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium">{formatPaisa(item.value)}</span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Occupancy */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BedDouble className="w-4 h-4 text-blue-500" />
                    Occupancy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-center">
                      <div className="relative w-32 h-32">
                        <svg className="w-full h-full" viewBox="0 0 36 36">
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none" stroke="hsl(var(--secondary))" strokeWidth="3"
                          />
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
                            strokeDasharray={`${report.occupancy?.occupancyRate ?? 0}, 100`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold text-foreground">{report.occupancy?.occupancyRate ?? 0}%</span>
                          <span className="text-[10px] text-muted-foreground uppercase">Occupied</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold text-foreground">{report.occupancy?.totalRooms ?? 0}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Rooms</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-600">{report.occupancy?.occupiedBeds ?? 0}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Occupied</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-orange-500">{report.occupancy?.vacantBeds ?? 0}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Vacant</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Defaulters */}
            {report.defaulters && report.defaulters.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    Defaulters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="text-left py-2 pr-4">Tenant</th>
                          <th className="text-left py-2 px-4">Room</th>
                          <th className="text-right py-2 px-4">Amount Due</th>
                          <th className="text-right py-2 pl-4">Days Overdue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.defaulters.map((d: any, i: number) => (
                          <tr key={i} className="border-b border-border/40">
                            <td className="py-2.5 pr-4 font-medium">{d.name}</td>
                            <td className="py-2.5 px-4"><Badge variant="outline">{d.room}</Badge></td>
                            <td className="py-2.5 px-4 text-right font-semibold text-destructive">{formatPaisa(d.amountDue)}</td>
                            <td className="py-2.5 pl-4 text-right">
                              <Badge variant={d.daysOverdue > 15 ? "destructive" : "secondary"}>
                                {d.daysOverdue} days
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Paid vs Unpaid */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-5 pb-4 flex flex-col items-center">
                  <Users className="w-5 h-5 text-green-500 mb-2" />
                  <span className="text-2xl font-bold text-green-600">{report.income?.tenantsPaid ?? 0}</span>
                  <span className="text-xs text-muted-foreground uppercase mt-1">Tenants Paid</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4 flex flex-col items-center">
                  <Users className="w-5 h-5 text-orange-500 mb-2" />
                  <span className="text-2xl font-bold text-orange-500">{report.income?.tenantsUnpaid ?? 0}</span>
                  <span className="text-xs text-muted-foreground uppercase mt-1">Tenants Unpaid</span>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
