"use client";

import { useState } from "react";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { useRequireRole, useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/lib/useApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Wrench, Plus, Clock, MessageSquare } from "lucide-react";
import { CreateMaintenanceRequestModal } from "@/components/maintenance/CreateMaintenanceRequestModal";
import type { MaintenanceRequestDto } from "@tenantease/types";

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
        <div className="w-20 h-20 bg-secondary rounded-2xl flex items-center justify-center">
          <Clock className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">No Active Booking</h2>
        <p className="text-muted-foreground max-w-sm">
          You don't have an active booking to log maintenance requests for.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {isCreating && user?.tenantId && user?.propertyId && (
         <CreateMaintenanceRequestModal 
            propertyId={user.propertyId}
            tenantId={user.tenantId}
            onClose={() => setIsCreating(false)}
            onSuccess={() => {
               setIsCreating(false);
               refetch();
            }}
         />
      )}
      <div className="flex justify-between items-end">
        <section>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Wrench className="w-8 h-8 text-primary" /> Maintenance
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            Track and log issues in your room or property.
          </p>
        </section>
        <Button onClick={() => setIsCreating(true)} className="rounded-xl shadow-soft">
          <Plus className="w-4 h-4 mr-2" /> New Request
        </Button>
      </div>

      <div className="grid gap-4 mt-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : maintenanceReqs?.length ? (
          maintenanceReqs.map((req) => (
            <Card key={req.id} className="shadow-float border-border/80 hover:border-primary/30 transition-colors">
              <CardContent className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">#{req.requestNumber}</span>
                    <h3 className="font-bold text-lg text-foreground">{req.category} Issue</h3>
                  </div>
                  <Badge variant={req.status === "RESOLVED" || req.status === "CLOSED" ? "success" : "warning"}>
                    {req.status}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground">{req.description}</p>
                
                {req.assignedWorkerName && (
                  <div className="bg-secondary/50 p-3 rounded-lg text-sm border border-border">
                    <span className="font-semibold">Assigned to:</span> {req.assignedWorkerName} {req.assignedWorkerPhone ? `(${req.assignedWorkerPhone})` : ''}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-dashed shadow-none bg-transparent">
            <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-3">
              <Wrench className="w-10 h-10 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-bold">No Maintenance Requests</h3>
              <p className="text-muted-foreground text-sm max-w-[250px]">
                You haven't reported any issues. Everything looking good?
              </p>
              <Button variant="outline" className="mt-2" onClick={() => setIsCreating(true)}>
                Report an Issue
              </Button>
            </CardContent>
          </Card>
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
