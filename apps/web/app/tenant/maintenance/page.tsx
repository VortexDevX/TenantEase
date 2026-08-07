"use client";

import { useState } from "react";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { useRequireRole, useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/lib/useApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Wrench, Plus, Clock } from "lucide-react";
import { CreateMaintenanceRequestModal } from "@/components/maintenance/CreateMaintenanceRequestModal";
import type { MaintenanceRequestDto } from "@tenantease/types";

// Ledger Calm Shared Components
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge, StatusBadgeType } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";

function TenantMaintenanceContent() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const { data: maintenanceReqs, loading, refetch } = useApi<MaintenanceRequestDto[]>(
    tenantId ? "/tenant-portal/maintenance" : null
  );

  const [isCreating, setIsCreating] = useState(false);

  if (!user?.hasBooking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center animate-fade-in">
        <div className="w-20 h-20 border border-white/[0.06] bg-white/[0.02] shadow-glass rounded-2xl flex items-center justify-center">
          <Clock className="w-10 h-10 text-violet-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">No Active Booking</h2>
        <p className="text-muted-foreground max-w-sm font-semibold">
          You don't have an active booking to log maintenance requests for.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-10">
      {isCreating && user?.tenantId && (
         <CreateMaintenanceRequestModal
            onClose={() => setIsCreating(false)}
            onSuccess={() => {
               setIsCreating(false);
               refetch();
            }}
         />
      )}

      <PageHeader
        title="Maintenance"
        description="Track and log issues in your room or property."
        actions={
          <Button onClick={() => setIsCreating(true)} className="bg-violet-500 hover:bg-violet-600 text-white font-bold rounded-xl shadow-md hover:shadow-violet-500/20">
            <Plus className="w-4 h-4 mr-2" /> New Request
          </Button>
        }
      />

      <div className="grid gap-4 mt-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-violet-400" /></div>
        ) : maintenanceReqs?.length ? (
          maintenanceReqs.map((req) => (
            <Card key={req.id} className="shadow-glass border-white/[0.06] bg-white/[0.02] hover:border-violet-500/30 transition-all duration-300">
              <CardContent className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">#{req.requestNumber}</span>
                    <h3 className="font-bold text-lg text-foreground">{req.category} Issue</h3>
                  </div>
                  <StatusBadge status={req.status as StatusBadgeType} />
                </div>

                <p className="text-sm font-semibold text-muted-foreground leading-relaxed">{req.description}</p>

                {req.assignedWorkerName && (
                  <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg text-sm text-foreground">
                    <span className="font-bold text-violet-400">Assigned to:</span> {req.assignedWorkerName} {req.assignedWorkerPhone ? `(${req.assignedWorkerPhone})` : ''}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <EmptyState
            title="No Maintenance Requests"
            description="You haven't reported any issues. Everything looking good?"
            icon={<Wrench className="text-violet-400" />}
            action={
              <Button variant="outline" className="mt-2 border-white/[0.08] hover:bg-white/[0.04] text-violet-400 hover:text-violet-300" onClick={() => setIsCreating(true)}>
                Report an Issue
              </Button>
            }
            className="py-16 border border-white/[0.06] bg-white/[0.01] rounded-xl shadow-glass"
          />
        )}
      </div>
    </div>
  );
}

export default function TenantMaintenancePage() {
  const { authorized } = useRequireRole("TENANT");
  if (!authorized) return null;

  return (
    <TenantLayout activePath="/tenant/maintenance">
      <TenantMaintenanceContent />
    </TenantLayout>
  );
}
