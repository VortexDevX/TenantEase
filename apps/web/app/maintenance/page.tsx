"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsTrigger } from "@/components/ui/tabs";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { buildQuery, fetchApi } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import { ResolveMaintenanceModal } from "@/components/maintenance/ResolveMaintenanceModal";
import { Wrench, Clock, CheckCircle2, MessageSquare, AlertTriangle, Calendar, Loader2 } from "lucide-react";
import type { MaintenanceRequestDto, MaintenanceSummaryDto, MaintenanceStatus } from "@tenantease/types";

interface MaintenanceListResponse {
  items: MaintenanceRequestDto[];
  summary: MaintenanceSummaryDto;
}

function MaintenanceContent() {
  const { activeProperty, loading: propLoading } = useProperty();
  const propertyId = activeProperty?.id;
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | "ALL">("ALL");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [handlingAction, setHandlingAction] = useState<string | null>(null);

  const queryPath = propertyId
    ? `/properties/${propertyId}/maintenance${buildQuery({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        limit: 50,
      })}`
    : null;

  const { data, loading, refetch } = useApi<MaintenanceListResponse>(queryPath);

  const items = data?.items ?? [];
  const summary = data?.summary ?? { new: 0, inProgress: 0, resolved: 0, closed: 0, total: 0 };

  const getPriorityBadge = (urgency: string) => {
    switch (urgency) {
      case "HIGH":
      case "EMERGENCY":
        return <Badge variant="destructive">High Priority</Badge>;
      case "MEDIUM":
        return <Badge variant="warning">Standard</Badge>;
      default:
        return <Badge variant="secondary">Low Priority</Badge>;
    }
  };

  const getCategoryLabel = (cat: string) => {
    return cat.charAt(0) + cat.slice(1).toLowerCase().replace(/_/g, " ");
  };

  const handleAccept = async (id: string) => {
    setHandlingAction(id);
    try {
      await fetchApi(`/maintenance/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      refetch();
    } catch (err) {
      alert("Failed to accept task");
    } finally {
      setHandlingAction(null);
    }
  };

  const isLoading = propLoading || loading;

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-10">
      {resolvingId && (
        <ResolveMaintenanceModal
          requestId={resolvingId}
          onClose={() => setResolvingId(null)}
          onSuccess={() => {
            setResolvingId(null);
            refetch();
          }}
        />
      )}
      
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            Maintenance
            {summary.new > 0 && (
              <span className="bg-destructive text-white text-xs px-2 py-0.5 rounded-full font-bold">{summary.new} New</span>
            )}
          </h1>
          <p className="text-muted-foreground font-medium text-sm mt-1">
            {isLoading ? "Loading..." : `${summary.total} total request${summary.total !== 1 ? "s" : ""}`}
          </p>
        </div>
      </section>

      {/* Board Tabs */}
      <section className="bg-card p-2 rounded-xl border border-border inline-flex self-start">
         <Tabs>
           <TabsTrigger
             active={statusFilter === "ALL"}
             onClick={() => setStatusFilter("ALL")}
             className="px-6 relative"
           >
             All ({summary.total})
           </TabsTrigger>
           <TabsTrigger
             active={statusFilter === "NEW"}
             onClick={() => setStatusFilter("NEW")}
             className="px-6 relative"
           >
             New ({summary.new})
             {summary.new > 0 && (
               <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full"></span>
             )}
           </TabsTrigger>
           <TabsTrigger
             active={statusFilter === "IN_PROGRESS"}
             onClick={() => setStatusFilter("IN_PROGRESS")}
             className="px-6"
           >
             In Progress ({summary.inProgress})
           </TabsTrigger>
           <TabsTrigger
             active={statusFilter === "RESOLVED"}
             onClick={() => setStatusFilter("RESOLVED")}
             className="px-6"
           >
             Resolved ({summary.resolved})
           </TabsTrigger>
         </Tabs>
      </section>

      {/* Issues List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-2xl bg-secondary/20">
          <Wrench size={32} className="text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium text-center">No maintenance requests in this view.</p>
        </div>
      ) : (
        <section className="flex flex-col gap-4">
           {items.map((issue, idx) => (
             <Card
               key={issue.id}
               className="group hover:-translate-y-1 transition-all duration-300 ease-out animate-slide-up shadow-sm hover:shadow-float border-border/80"
               style={{ animationDelay: `${idx * 50}ms` }}
             >
                <CardContent className="p-0">
                   <div className="flex flex-col md:flex-row p-5 gap-5">
                      {/* Priority indicator line */}
                      <div className={`hidden md:block w-1.5 rounded-full ${
                        issue.urgency === "HIGH" || issue.urgency === "EMERGENCY"
                          ? "bg-destructive"
                          : issue.urgency === "MEDIUM"
                          ? "bg-warning"
                          : "bg-success"
                      }`}></div>

                      {/* Content */}
                      <div className="flex-1 flex flex-col gap-2">
                         <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-bold text-lg text-foreground leading-tight tracking-tight">{issue.description}</h3>
                            {getPriorityBadge(issue.urgency)}
                         </div>

                         <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground mt-1">
                            <span className="flex items-center gap-1.5 text-foreground">
                              <span className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center text-xs text-foreground font-bold border border-border">
                                {issue.tenantName.charAt(0)}
                              </span>
                              {issue.tenantName} (Room {issue.roomNumber})
                            </span>
                            <span className="flex items-center gap-1.5 opacity-80">
                              <Calendar size={14} /> {timeAgo(issue.createdAt)}
                            </span>
                            <Badge variant="secondary" className="text-xs">{getCategoryLabel(issue.category)}</Badge>
                         </div>

                         {issue.assignedWorkerName && (
                           <p className="text-xs text-muted-foreground mt-1">
                             Assigned to: <span className="font-semibold text-foreground">{issue.assignedWorkerName}</span>
                           </p>
                         )}
                      </div>

                      {/* Actions */}
                      <div className="flex md:flex-col items-center justify-end gap-3 shrink-0 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-border md:pl-5">
                          {issue.status === "NEW" && (
                             <Button 
                               size="sm" 
                               onClick={() => handleAccept(issue.id)}
                               disabled={handlingAction === issue.id}
                               className="w-full md:w-auto text-xs px-5 h-9 shrink-0"
                             >
                               {handlingAction === issue.id ? <Loader2 className="w-4 h-4 animate-spin"/> : "Accept Task"}
                             </Button>
                          )}
                           {issue.status === "IN_PROGRESS" && (
                             <Button 
                               size="sm" 
                               variant="outline" 
                               onClick={() => setResolvingId(issue.id)}
                               className="w-full md:w-auto text-xs px-5 h-9 shrink-0 border-primary text-primary hover:bg-primary/5"
                             >
                               Mark Done
                             </Button>
                          )}
                           {(issue.status === "RESOLVED" || issue.status === "CLOSED") && (
                             <Button size="sm" variant="ghost" disabled className="w-full md:w-auto text-xs px-5 h-9 shrink-0 flex items-center opacity-70">
                               <CheckCircle2 size={16} className="mr-1"/> Closed
                             </Button>
                          )}

                          <button className="flex items-center justify-center gap-2 w-full md:w-auto text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-2 px-3 rounded-lg hover:bg-secondary">
                             <MessageSquare size={14}/> Message Tenant
                          </button>
                      </div>
                   </div>
                </CardContent>
             </Card>
           ))}
        </section>
      )}
    </div>
  );
}

import { useRequireRole } from "@/contexts/AuthContext";

export default function MaintenanceBoard() {
  const { authorized } = useRequireRole("OWNER");
  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/maintenance">
      <MaintenanceContent />
    </DashboardLayout>
  );
}
