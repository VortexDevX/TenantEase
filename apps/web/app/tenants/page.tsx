"use client";

import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsTrigger } from "@/components/ui/tabs";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { formatPaisa } from "@/lib/format";
import { AddTenantModal } from "@/components/tenants/AddTenantModal";
import { CsvImportModal } from "@/components/tenants/CsvImportModal";
import { Search, Plus, PhoneCall, IndianRupee, MoreVertical, Loader2, UploadCloud } from "lucide-react";
import type { TenantDto, TenantStatus } from "@tenantease/types";
import Link from "next/link";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function TenantListContent() {
  const { activeProperty, loading: propLoading } = useProperty();
  const propertyId = activeProperty?.id;
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const { data: tenants, loading, refetch } = useApi<TenantDto[]>(
    propertyId ? `/properties/${propertyId}/tenants?limit=100` : null
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TenantStatus | "ALL">("ALL");

  const filtered = useMemo(() => {
    if (!tenants) return [];
    let list = tenants;
    if (statusFilter !== "ALL") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.fullName.toLowerCase().includes(q) ||
          t.phone.includes(q)
      );
    }
    return list;
  }, [tenants, search, statusFilter]);

  const getStatusBadge = (status: TenantStatus) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="success">Active</Badge>;
      case "NOTICE":
        return <Badge variant="warning">Notice Period</Badge>;
      case "VACATED":
        return <Badge variant="secondary">Vacated</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const isLoading = propLoading || loading;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      
      {showModal && propertyId && (
        <AddTenantModal
          propertyId={propertyId}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            refetch();
          }}
        />
      )}

      {showImportModal && propertyId && (
        <CsvImportModal
          propertyId={propertyId}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            refetch();
          }}
        />
      )}

      {/* Header & Actions */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Tenants</h1>
          <p className="text-muted-foreground font-medium text-sm mt-1">
            {isLoading ? "Loading..." : `Manage ${tenants?.length ?? 0} tenant${(tenants?.length ?? 0) !== 1 ? "s" : ""}.`}
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button onClick={() => setShowImportModal(true)} disabled={!propertyId} variant="outline" className="shrink-0 flex-1 sm:flex-auto shadow-sm">
             <UploadCloud className="mr-2" size={18} /> Import CSV
          </Button>
          <Button onClick={() => setShowModal(true)} disabled={!propertyId} className="shrink-0 flex-1 sm:flex-auto shadow-float">
             <Plus className="mr-2" size={18} /> Add Tenant
          </Button>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="flex flex-col gap-4 bg-card p-4 rounded-xl border border-border shadow-sm sticky top-0 md:relative z-10">
         <div className="relative w-full">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
           <Input
             placeholder="Search by name or phone..."
             className="pl-10 h-12 bg-background/50 focus:bg-background transition-colors"
             value={search}
             onChange={(e) => setSearch(e.target.value)}
           />
         </div>
         
         <Tabs>
           <TabsTrigger active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")}>All</TabsTrigger>
           <TabsTrigger active={statusFilter === "ACTIVE"} onClick={() => setStatusFilter("ACTIVE")}>Active</TabsTrigger>
           <TabsTrigger active={statusFilter === "NOTICE"} onClick={() => setStatusFilter("NOTICE")}>Notice</TabsTrigger>
           <TabsTrigger active={statusFilter === "VACATED"} onClick={() => setStatusFilter("VACATED")}>Vacated</TabsTrigger>
         </Tabs>
      </section>

      {/* List Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-2xl bg-secondary/20">
          <p className="text-muted-foreground font-medium text-center">No tenants found matching your criteria.</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
           {filtered.map((t, idx) => (
             <Card key={t.id} className="overflow-hidden animate-slide-up" style={{ animationDelay: `${idx * 40}ms` }}>
                <CardContent className="p-0">
                   <div className="p-5 flex gap-4 items-start relative">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary-strong flex justify-center items-center font-bold text-lg shrink-0">
                        {getInitials(t.fullName)}
                      </div>

                      {/* Info */}
                      <div className="flex flex-col flex-1 min-w-0">
                         <div className="flex justify-between items-start gap-2">
                            <h3 className="font-bold text-base text-foreground truncate">{t.fullName}</h3>
                            <button className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-2 -mt-1"><MoreVertical size={16}/></button>
                         </div>
                         <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">{t.phone}</span>
                         </div>
                         <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-semibold text-foreground">{formatPaisa(t.monthlyRent)}/mo</span>
                         </div>
                         <div className="mt-3">
                           {getStatusBadge(t.status)}
                         </div>
                      </div>
                   </div>
                   
                   {/* Actions Footer */}
                   <div className="grid grid-cols-2 border-t border-border bg-secondary/30">
                      <a href={`tel:${t.phone}`} className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border-r border-border">
                        <PhoneCall size={16} /> Call
                      </a>
                      <Link href={`/payments/new?tenantId=${t.id}`} className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-primary-strong hover:bg-primary/5 transition-colors">
                        <IndianRupee size={16} /> Record Rent
                      </Link>
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

export default function TenantList() {
  const { authorized } = useRequireRole("OWNER");
  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/tenants">
      <TenantListContent />
    </DashboardLayout>
  );
}
