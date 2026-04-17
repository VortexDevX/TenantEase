"use client";

import { TenantLayout } from "@/components/layout/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRequireRole, useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/lib/useApi";
import { formatPaisa, timeAgo } from "@/lib/format";
import { IndianRupee, Wrench, Clock, FileText, Loader2 } from "lucide-react";
import type { RentEntryDto, MaintenanceRequestDto } from "@tenantease/types";

function TenantDashboardContent() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const { data: rentEntries, loading: rentLoading } = useApi<RentEntryDto[]>(
    tenantId ? "/tenant-portal/rent" : null
  );

  const { data: maintenanceReqs, loading: maintLoading } = useApi<MaintenanceRequestDto[]>(
    tenantId ? "/tenant-portal/maintenance" : null
  );

  const loading = rentLoading || maintLoading;

  if (!user?.hasBooking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center animate-fade-in">
        <div className="w-20 h-20 bg-secondary rounded-2xl flex items-center justify-center">
          <Clock className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">No Active Booking</h2>
        <p className="text-muted-foreground max-w-sm">
          Your account is set up, but you don't have an active rental booking yet.
          Please contact your property owner to get started.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentRent = rentEntries?.[0];
  const pendingMaintenance = maintenanceReqs?.filter(
    (r) => r.status === "NEW" || r.status === "IN_PROGRESS"
  ) ?? [];

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">
          Welcome, {user.fullName ?? "Tenant"}
        </h1>
        <p className="text-muted-foreground font-medium">
          Here is your rental summary.
        </p>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2 flex-row justify-between items-center space-y-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Rent</span>
            <div className="bg-primary/10 p-1.5 rounded-md text-primary"><IndianRupee size={16} /></div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-3xl font-bold">{currentRent ? formatPaisa(currentRent.amountDue) : "--"}</span>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              {currentRent?.billingMonth ?? "No bills yet"}
              {currentRent && (
                <Badge variant={currentRent.status === "PAID" ? "success" : currentRent.status === "OVERDUE" ? "destructive" : "warning"} className="ml-2">
                  {currentRent.status}
                </Badge>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2 flex-row justify-between items-center space-y-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Requests</span>
            <div className="bg-warning/10 p-1.5 rounded-md text-warning"><Wrench size={16} /></div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-3xl font-bold">{pendingMaintenance.length}</span>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              {pendingMaintenance.length === 0 ? "All clear" : "awaiting resolution"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2 flex-row justify-between items-center space-y-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Paid</span>
            <div className="bg-success/10 p-1.5 rounded-md text-success"><FileText size={16} /></div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-3xl font-bold">
              {formatPaisa(rentEntries?.reduce((s, e) => s + e.amountPaid, 0) ?? 0)}
            </span>
            <p className="text-xs text-muted-foreground font-medium mt-1">across all months</p>
          </CardContent>
        </Card>
      </section>

      {/* Rent History */}
      <Card>
        <CardHeader className="border-b border-border p-5">
          <CardTitle className="text-lg">Rent History</CardTitle>
        </CardHeader>
        <div className="p-0">
          {rentEntries && rentEntries.length > 0 ? (
            rentEntries.slice(0, 6).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">{entry.billingMonth}</span>
                  <span className="text-xs text-muted-foreground">Due: {formatPaisa(entry.amountDue)}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-bold text-foreground">{formatPaisa(entry.amountPaid)}</span>
                  <Badge variant={entry.status === "PAID" ? "success" : entry.status === "OVERDUE" ? "destructive" : "secondary"}>
                    {entry.status}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-muted-foreground text-sm">No rent entries yet.</div>
          )}
        </div>
      </Card>
    </div>
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
