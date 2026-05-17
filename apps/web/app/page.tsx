"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { formatPaisa, formatPaisaShort, timeAgo } from "@/lib/format";
import { BedDouble, DoorClosed, IndianRupee, AlertCircle, ArrowUpRight, Wrench, Clock, Users, Loader2 } from "lucide-react";
import Link from "next/link";
import type { TenantDto, RentEntryDto } from "@tenantease/types";

interface RentEntryWithName extends RentEntryDto {
  tenantName: string;
}

function DashboardContent() {
  const { activeProperty, loading: propLoading } = useProperty();
  const propertyId = activeProperty?.id;

  const { data: tenants, loading: tenantsLoading } = useApi<TenantDto[]>(
    propertyId ? `/properties/${propertyId}/tenants?limit=100` : null
  );

  const { data: rentEntries, loading: rentLoading } = useApi<RentEntryWithName[]>(
    propertyId ? `/properties/${propertyId}/rent` : null
  );

  const loading = propLoading || tenantsLoading || rentLoading;

  // Compute KPIs from real data
  const occupiedBeds = activeProperty?.occupiedBeds ?? 0;
  const vacantBeds = activeProperty?.vacantBeds ?? 0;

  // Rent collection stats from rent entries for current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthEntries = rentEntries?.filter((e) => e.billingMonth === currentMonth) ?? [];
  const totalDue = currentMonthEntries.reduce((s, e) => s + e.amountDue, 0);
  const totalPaid = currentMonthEntries.reduce((s, e) => s + e.amountPaid, 0);
  const collectionPct = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

  // Overdue entries
  const overdueEntries = rentEntries?.filter((e) => e.status === "OVERDUE") ?? [];
  const overdueTotal = overdueEntries.reduce((s, e) => s + (e.amountDue - e.amountPaid), 0);

  // Active tenants on notice
  const activeTenants = tenants?.filter((t) => t.status === "ACTIVE") ?? [];
  const noticeTenants = tenants?.filter((t) => t.status === "NOTICE") ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      
      {/* Welcome Section */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-slide-up stagger-1">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Overview</h1>
          <p className="text-muted-foreground font-medium">
            {activeProperty
              ? `${activeProperty.name} — ${activeProperty.city}, ${activeProperty.state}`
              : "No property selected"}
          </p>
        </div>
        <div className="flex gap-3 shrink-0 w-full sm:w-auto">
          <Button asChild variant="outline" className="w-full sm:w-auto">
             <Link href="/tenants">+ Add Tenant</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
             <Link href="/payments/new">Record Rent</Link>
          </Button>
        </div>
      </section>

      {/* Actionable Alerts */}
      {overdueEntries.length > 0 && (
        <section className="animate-slide-up stagger-2">
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex gap-4 items-start relative overflow-hidden">
             <div className="bg-destructive/10 p-2 rounded-full text-destructive shrink-0">
               <AlertCircle size={20} className="text-destructive"/>
             </div>
             <div className="flex flex-col gap-1 items-start">
                <h4 className="font-semibold text-destructive">
                  {overdueEntries.length} Tenant{overdueEntries.length > 1 ? "s'" : "'s"} Rent is Overdue
                </h4>
                <p className="text-sm text-destructive/80 font-medium">
                  Total outstanding amount: {formatPaisa(overdueTotal)}.
                </p>
                <Button variant="outline" size="sm" className="mt-2 h-8 text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10 hover:text-destructive">
                  Review Defaults
                </Button>
             </div>
          </div>
        </section>
      )}

      {/* KPI Row */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-slide-up stagger-3">
        <Card className="border-border">
          <CardHeader className="p-4 pb-2 flex-row justify-between items-center space-y-0">
             <CardDescription className="font-semibold uppercase tracking-wider text-xs">Occupied Beds</CardDescription>
             <div className="bg-success/10 p-1.5 rounded-md text-success"><BedDouble size={16}/></div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-3xl font-bold">{occupiedBeds}</span>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              {activeTenants.length} active tenant{activeTenants.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

         <Card className="border-border">
          <CardHeader className="p-4 pb-2 flex-row justify-between items-center space-y-0">
             <CardDescription className="font-semibold uppercase tracking-wider text-xs">Vacant Beds</CardDescription>
             <div className="bg-destructive/10 p-1.5 rounded-md text-destructive"><DoorClosed size={16}/></div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-3xl font-bold">{vacantBeds}</span>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              {noticeTenants.length} upcoming vacanc{noticeTenants.length !== 1 ? "ies" : "y"}
            </p>
          </CardContent>
        </Card>

         <Card className="border-border col-span-2 md:col-span-1">
          <CardHeader className="p-4 pb-2 flex-row justify-between items-center space-y-0">
             <CardDescription className="font-semibold uppercase tracking-wider text-xs">Rent Collection</CardDescription>
             <div className="bg-primary/10 p-1.5 rounded-md text-primary-strong"><IndianRupee size={16}/></div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-3xl font-bold">{collectionPct}%</span>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              {formatPaisaShort(totalPaid)} collected / {formatPaisaShort(totalDue)} expected
            </p>
             <div className="w-full bg-border h-1.5 rounded-full mt-3 overflow-hidden">
               <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${collectionPct}%` }}></div>
             </div>
          </CardContent>
        </Card>
      </section>

      {/* Activity Log Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up stagger-4">
         
         {/* Recent Payments (from rent entries) */}
         <Card>
           <CardHeader className="border-b border-border p-5">
              <div className="flex items-center justify-between">
                 <CardTitle className="text-lg">Recent Payments</CardTitle>
              </div>
           </CardHeader>
           <div className="p-0">
              {rentEntries && rentEntries.filter((e) => e.amountPaid > 0).length > 0 ? (
                rentEntries
                  .filter((e) => e.amountPaid > 0)
                  .slice(0, 5)
                  .map((entry, i) => (
                    <div key={entry.id} className="flex items-start gap-4 p-4 border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                      <div className="p-2 rounded-full shrink-0 bg-success/10 text-success">
                        <IndianRupee size={16}/>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">
                          {entry.tenantName} paid {formatPaisa(entry.amountPaid)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock size={10} /> {entry.billingMonth}
                        </span>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="p-6 text-center text-muted-foreground text-sm">No recent payments found.</div>
              )}
           </div>
         </Card>

          {/* Outstanding Dues */}
          <Card>
           <CardHeader className="border-b border-border p-5">
              <div className="flex items-center justify-between">
                 <CardTitle className="text-lg">Outstanding Dues</CardTitle>
              </div>
           </CardHeader>
           <div className="p-0">
              {overdueEntries.length > 0 ? (
                overdueEntries.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-foreground">{entry.tenantName}</span>
                      <span className="text-xs text-destructive font-medium">{entry.billingMonth} overdue</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                       <span className="text-sm font-bold text-foreground">{formatPaisa(entry.amountDue - entry.amountPaid)}</span>
                       <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/20 text-primary-strong">Remind</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-muted-foreground text-sm">No overdue entries. All clear.</div>
              )}
           </div>
         </Card>

      </section>
    </div>
  );
}

import { useRequireRole } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { authorized } = useRequireRole("OWNER");
  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/">
      <DashboardContent />
    </DashboardLayout>
  );
}
