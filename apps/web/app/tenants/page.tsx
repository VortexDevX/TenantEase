"use client";

import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsTrigger } from "@/components/ui/tabs";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { fetchApi, fetchApiBlob } from "@/lib/api-client";
import { rupeesToPaisa } from "@/lib/money";
import { AddTenantModal } from "@/components/tenants/AddTenantModal";
import { CsvImportModal } from "@/components/tenants/CsvImportModal";
import { Search, Plus, PhoneCall, IndianRupee, MoreVertical, Loader2, UploadCloud, ArrowRightLeft, DoorOpen, FileText, Trash2, X, Users, CalendarClock } from "lucide-react";
import type { RoomDto, TenantDocumentDto, TenantDto, TenantStatus } from "@tenantease/types";
import Link from "next/link";

// Ledger Calm Shared Components
import { PageHeader } from "@/components/shared/PageHeader";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { StatusBadge, StatusBadgeType } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";

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
  const [documentCategory, setDocumentCategory] = useState<"KYC" | "PHOTO" | "OTHER">("KYC");

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
    const monthlyRent = rentText ? rupeesToPaisa(rentText) : undefined;
    if (monthlyRent !== undefined && (!Number.isFinite(monthlyRent) || monthlyRent < 1)) {
      alert("Monthly rent must be a rupee amount greater than 0.");
      return;
    }
    await fetchApi(`/tenants/${tenant.id}/transfer`, {
      method: "POST",
      body: JSON.stringify({
        roomId: room.id,
        monthlyRent,
        effectiveDate: new Date().toISOString(),
      }),
    });
    refetch();
  }

  async function vacateTenant(tenant: TenantDto) {
    if (!confirm(`Mark ${tenant.fullName} as vacated?`)) return;
    const damageText = window.prompt("Damage deduction in rupees:", "0");
    const damageDeduction = rupeesToPaisa(damageText || "0");
    if (!Number.isFinite(damageDeduction) || damageDeduction < 0) {
      alert("Damage deduction must be a rupee amount of 0 or more.");
      return;
    }
    await fetchApi(`/tenants/${tenant.id}/vacate`, {
      method: "POST",
      body: JSON.stringify({
        vacatedAt: new Date().toISOString(),
        damageDeduction,
        refundStatus: "pending",
      }),
    });
    refetch();
  }

  async function placeOnNotice(tenant: TenantDto) {
    const date = window.prompt("Expected vacate date (YYYY-MM-DD):");
    if (!date) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      alert("Use YYYY-MM-DD format.");
      return;
    }
    await fetchApi(`/tenants/${tenant.id}/notice`, {
      method: "POST",
      body: JSON.stringify({ expectedVacateDate: date })
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
      formData.append("category", documentCategory);
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
      <PageHeader
        title="Tenants"
        description={isLoading ? "Loading..." : `Manage ${tenants?.length ?? 0} tenant${(tenants?.length ?? 0) !== 1 ? "s" : ""}.`}
        actions={
          <div className="flex gap-3 w-full sm:w-auto">
            <Button onClick={() => setShowImportModal(true)} disabled={!propertyId} variant="outline" className="shrink-0 flex-1 sm:flex-auto shadow-sm">
               <UploadCloud className="mr-2" size={18} /> Import CSV
            </Button>
            <Button onClick={() => setShowModal(true)} disabled={!propertyId} className="shrink-0 flex-1 sm:flex-auto shadow-float">
               <Plus className="mr-2" size={18} /> Add Tenant
            </Button>
          </div>
        }
      />

      {/* Search & Filters */}
      <section className="flex flex-col gap-4 bg-card/60 backdrop-blur-xl p-4 rounded-xl border border-white/[0.06] shadow-glass sticky top-0 md:relative z-10">
         <div className="relative w-full">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
           <Input
             placeholder="Search by name or phone..."
             className="pl-10 h-12 bg-white/[0.04] border-white/[0.08] focus:bg-white/[0.06] transition-colors"
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
        <EmptyState
          title="No tenants found"
          description="No tenants match your current filters or search criteria."
          icon={<Users />}
          className="py-16"
        />
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
           {filtered.map((t, idx) => (
             <Card key={t.id} className="overflow-hidden animate-slide-up shadow-card" style={{ animationDelay: `${idx * 40}ms` }}>
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
                            <MoneyValue amount={t.monthlyRent} className="text-sm font-semibold text-foreground inline" />
                            <span className="text-sm font-semibold text-foreground">/mo</span>
                         </div>
                         {t.emergencyContactPhone || t.aadhaarLast4 ? (
                           <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-muted-foreground">
                             {t.emergencyContactPhone ? <span>Emergency: {t.emergencyContactPhone}</span> : null}
                             {t.aadhaarLast4 ? <span>Aadhaar: ****{t.aadhaarLast4}</span> : null}
                           </div>
                         ) : null}
                         <div className="mt-3">
                           <StatusBadge status={t.status as StatusBadgeType} />
                         </div>
                      </div>
                   </div>
                   
                   {/* Actions Footer */}
                   <div className="grid grid-cols-3 sm:grid-cols-6 border-t border-white/[0.04] bg-white/[0.01]">
                      <a href={`tel:${t.phone}`} className="flex items-center justify-center gap-2 py-3 text-xs font-semibold text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-colors border-r border-white/[0.04]">
                        <PhoneCall size={14} /> Call
                      </a>
                      <Link href={`/payments/new?tenantId=${t.id}`} className="flex items-center justify-center gap-2 py-3 text-xs font-semibold text-primary-strong hover:bg-primary/5 transition-colors border-r border-white/[0.04]">
                        <IndianRupee size={14} /> Rent
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTenantId(selectedTenantId === t.id ? null : t.id);
                          setDocumentError("");
                          setDocumentSuccess("");
                        }}
                        className="flex items-center justify-center gap-2 py-3 text-xs font-semibold text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-colors border-r border-white/[0.04]"
                      >
                        <FileText size={14} /> KYC
                      </button>
                      <button type="button" onClick={() => transferTenant(t)} disabled={t.status === "VACATED"} className="flex items-center justify-center gap-2 py-3 text-xs font-semibold text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-colors border-r border-white/[0.04] disabled:opacity-40">
                        <ArrowRightLeft size={14} /> Move
                      </button>
                      <button type="button" onClick={() => placeOnNotice(t)} disabled={t.status !== "ACTIVE"} className="flex items-center justify-center gap-2 py-3 text-xs font-semibold text-warning hover:bg-warning/5 transition-colors border-r border-white/[0.04] disabled:opacity-40">
                        <CalendarClock size={14} /> Notice
                      </button>
                      <button type="button" onClick={() => vacateTenant(t)} disabled={t.status === "VACATED"} className="flex items-center justify-center gap-2 py-3 text-xs font-semibold text-destructive hover:bg-destructive/5 transition-colors border-l border-white/[0.04] disabled:opacity-40">
                        <DoorOpen size={14} /> Vacate
                      </button>
                   </div>
                   {selectedTenantId === t.id && (
                    <div className="border-t border-white/[0.04] bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-foreground">KYC documents</p>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">Upload PDF, JPEG, or PNG files.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedTenantId(null)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
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

                      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-white/[0.04]">
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
                      <select
                        value={documentCategory}
                        onChange={(event) => setDocumentCategory(event.target.value as "KYC" | "PHOTO" | "OTHER")}
                        className="mt-2 h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-semibold text-foreground focus:border-primary/50 outline-none"
                        aria-label="Document category"
                      >
                        <option value="KYC">KYC</option>
                        <option value="PHOTO">Photo</option>
                        <option value="OTHER">Other</option>
                      </select>

                      <div className="mt-3 flex flex-col gap-2">
                        {documentsLoading ? (
                           <div className="flex h-16 items-center justify-center">
                             <Loader2 className="h-5 w-5 animate-spin text-primary" />
                           </div>
                        ) : documents && documents.length > 0 ? (
                          documents.map((document) => (
                            <div key={document.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                              <button
                                type="button"
                                onClick={() => downloadTenantDocument(document)}
                                className="min-w-0 text-left"
                              >
                                <p className="truncate text-sm font-semibold text-foreground">{document.fileName}</p>
                                <p className="mt-0.5 text-xs font-medium text-muted-foreground">{document.category} · {new Date(document.createdAt).toLocaleDateString()}</p>
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
                          <p className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-4 text-center text-xs font-medium text-muted-foreground">No documents uploaded yet.</p>
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

import { useRequireRoles } from "@/contexts/AuthContext";

export default function TenantList() {
  const { authorized } = useRequireRoles(["OWNER", "STAFF"]);
  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/tenants">
      <TenantListContent />
    </DashboardLayout>
  );
}
