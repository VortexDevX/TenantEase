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
import { fetchApi, fetchApiBlob } from "@/lib/api-client";
import { formatPaisa } from "@/lib/format";
import { AddTenantModal } from "@/components/tenants/AddTenantModal";
import { CsvImportModal } from "@/components/tenants/CsvImportModal";
import { Search, Plus, PhoneCall, IndianRupee, MoreVertical, Loader2, UploadCloud, ArrowRightLeft, DoorOpen, FileText, Trash2, X } from "lucide-react";
import type { RoomDto, TenantDocumentDto, TenantDto, TenantStatus } from "@tenantease/types";
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
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState("");
  const [documentSuccess, setDocumentSuccess] = useState("");
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const { data: tenants, loading, refetch } = useApi<TenantDto[]>(
    propertyId ? `/properties/${propertyId}/tenants?limit=100` : null
  );
  const { data: rooms } = useApi<RoomDto[]>(propertyId ? `/properties/${propertyId}/rooms` : null);
  const { data: documents, loading: documentsLoading, refetch: refetchDocuments } = useApi<TenantDocumentDto[]>(
    selectedTenantId ? `/tenants/${selectedTenantId}/documents` : null
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

  async function transferTenant(tenant: TenantDto) {
    const roomNumber = window.prompt("Move tenant to room number:");
    if (!roomNumber) return;
    const room = rooms?.find((item) => item.roomNumber.toLowerCase() === roomNumber.toLowerCase());
    if (!room) {
      alert("Room not found.");
      return;
    }
    const rentText = window.prompt("New monthly rent in rupees. Leave blank to keep current rent:");
    await fetchApi(`/tenants/${tenant.id}/transfer`, {
      method: "POST",
      body: JSON.stringify({
        roomId: room.id,
        monthlyRent: rentText ? Math.round(Number(rentText) * 100) : undefined,
        effectiveDate: new Date().toISOString(),
      }),
    });
    refetch();
  }

  async function vacateTenant(tenant: TenantDto) {
    if (!confirm(`Mark ${tenant.fullName} as vacated?`)) return;
    const damageText = window.prompt("Damage deduction in rupees:", "0");
    await fetchApi(`/tenants/${tenant.id}/vacate`, {
      method: "POST",
      body: JSON.stringify({
        vacatedAt: new Date().toISOString(),
        damageDeduction: Math.round(Number(damageText || 0) * 100),
        refundStatus: "pending",
      }),
    });
    refetch();
  }

  async function uploadTenantDocument(tenantId: string, file: File | null) {
    if (!file) return;
    setDocumentError("");
    setDocumentSuccess("");
    setUploadingDocument(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await fetchApi(`/tenants/${tenantId}/documents/upload`, {
        method: "POST",
        body: formData,
      });
      setDocumentSuccess("Document uploaded.");
      refetchDocuments();
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "Document upload failed.");
    } finally {
      setUploadingDocument(false);
    }
  }

  async function downloadTenantDocument(document: TenantDocumentDto) {
    setDocumentError("");
    try {
      const blob = await fetchApiBlob(document.url);
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "Document download failed.");
    }
  }

  async function deleteTenantDocument(tenantId: string, document: TenantDocumentDto) {
    if (!confirm(`Delete ${document.fileName}?`)) return;
    setDocumentError("");
    setDocumentSuccess("");
    try {
      await fetchApi(`/tenants/${tenantId}/documents/${document.id}`, { method: "DELETE" });
      setDocumentSuccess("Document deleted.");
      refetchDocuments();
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "Document delete failed.");
    }
  }

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
                   <div className="grid grid-cols-5 border-t border-border bg-secondary/30">
                      <a href={`tel:${t.phone}`} className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border-r border-border">
                        <PhoneCall size={16} /> Call
                      </a>
                      <Link href={`/payments/new?tenantId=${t.id}`} className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-primary-strong hover:bg-primary/5 transition-colors border-r border-border">
                        <IndianRupee size={16} /> Rent
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTenantId(selectedTenantId === t.id ? null : t.id);
                          setDocumentError("");
                          setDocumentSuccess("");
                        }}
                        className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border-r border-border"
                      >
                        <FileText size={16} /> KYC
                      </button>
                      <button type="button" onClick={() => transferTenant(t)} disabled={t.status === "VACATED"} className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border-r border-border disabled:opacity-40">
                        <ArrowRightLeft size={16} /> Move
                      </button>
                      <button type="button" onClick={() => vacateTenant(t)} disabled={t.status === "VACATED"} className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-destructive hover:bg-destructive/5 transition-colors border-l border-border disabled:opacity-40">
                        <DoorOpen size={16} /> Vacate
                      </button>
                   </div>
                   {selectedTenantId === t.id && (
                    <div className="border-t border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-foreground">KYC documents</p>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">Upload PDF, JPEG, or PNG files.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedTenantId(null)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          aria-label="Close KYC panel"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {(documentError || documentSuccess) && (
                        <div className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold ${documentError ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-success/20 bg-success/10 text-success"}`}>
                          {documentError || documentSuccess}
                        </div>
                      )}

                      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">
                        {uploadingDocument ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                        {uploadingDocument ? "Uploading..." : "Upload document"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,application/pdf"
                          className="sr-only"
                          disabled={uploadingDocument}
                          onChange={(event) => {
                            void uploadTenantDocument(t.id, event.target.files?.[0] ?? null);
                            event.target.value = "";
                          }}
                        />
                      </label>

                      <div className="mt-3 flex flex-col gap-2">
                        {documentsLoading ? (
                          <div className="flex h-16 items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          </div>
                        ) : documents && documents.length > 0 ? (
                          documents.map((document) => (
                            <div key={document.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/20 p-3">
                              <button
                                type="button"
                                onClick={() => downloadTenantDocument(document)}
                                className="min-w-0 text-left"
                              >
                                <p className="truncate text-sm font-semibold text-foreground">{document.fileName}</p>
                                <p className="mt-0.5 text-xs font-medium text-muted-foreground">{new Date(document.createdAt).toLocaleDateString()}</p>
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteTenantDocument(t.id, document)}
                                className="rounded-md p-2 text-destructive hover:bg-destructive/10"
                                aria-label={`Delete ${document.fileName}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-lg bg-secondary/20 px-3 py-4 text-center text-xs font-medium text-muted-foreground">No documents uploaded yet.</p>
                        )}
                      </div>
                    </div>
                   )}
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
