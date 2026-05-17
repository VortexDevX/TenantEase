"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPaisa } from "@/lib/format";
import { Loader2, FileText, Plus, Download } from "lucide-react";
import type { TenantDto } from "@tenantease/types";

export default function AgreementsPage() {
  const { authorized } = useRequireRole("OWNER");
  const { activeProperty } = useProperty();

  const [selectedTenant, setSelectedTenant] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [duration, setDuration] = useState("11 months");
  const [templateType, setTemplateType] = useState("pg");
  const [stateName, setStateName] = useState("");
  const [customClauses, setCustomClauses] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: tenants, loading: tenantsLoading } = useApi<TenantDto[]>(
    activeProperty ? `/properties/${activeProperty.id}/tenants` : null
  );

  const { data: agreements, loading: agreementsLoading, refetch } = useApi<any[]>(
    selectedTenant ? `/tenants/${selectedTenant}/agreements` : null
  );

  const handleGenerate = async () => {
    if (!selectedTenant) return;
    setSubmitting(true);
    setResult(null);

    try {
      const token = localStorage.getItem("te_access_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tenants/${selectedTenant}/agreements`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            templateType,
            state: stateName || undefined,
            startDate,
            endDate: endDate || undefined,
            duration: duration || undefined,
            customClauses: customClauses
              .split("\n")
              .map((c) => c.trim())
              .filter(Boolean),
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        setShowForm(false);
        refetch();
      } else {
        setResult({ error: json.error?.message || "Generation failed" });
      }
    } catch {
      setResult({ error: "Network error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = (agreementId: string) => {
    const token = localStorage.getItem("te_access_token");
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL}/agreements/${agreementId}/download`,
      "_blank"
    );
  };

  if (!authorized) return null;

  const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <DashboardLayout activePath="/agreements">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Rental Agreements
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate and manage rental agreements for tenants.
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="w-4 h-4" />
            Generate Agreement
          </Button>
        </div>

        {/* Tenant Selector */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Select Tenant
              </label>
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">-- Select a tenant --</option>
                {tenantsLoading ? (
                  <option disabled>Loading...</option>
                ) : (
                  tenants?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} — Room ID: {t.roomId.substring(0, 8)}
                    </option>
                  ))
                )}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Generation Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                New Agreement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Template
                  </label>
                  <select
                    value={templateType}
                    onChange={(e) => setTemplateType(e.target.value)}
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="pg">PG Accommodation</option>
                    <option value="standard">Standard Rental</option>
                    <option value="hostel">Hostel</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">State</label>
                  <Input
                    placeholder="e.g. Karnataka"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration</label>
                  <Input
                    placeholder="e.g. 11 months"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Custom Clauses (one per line)
                </label>
                <textarea
                  rows={4}
                  value={customClauses}
                  onChange={(e) => setCustomClauses(e.target.value)}
                  placeholder={"No guests after 10 PM\nNo cooking in room\n1 month notice period"}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleGenerate} disabled={submitting || !selectedTenant || !startDate} className="gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Generate PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && (
          <Card className={result.error ? "border-destructive" : "border-green-500"}>
            <CardContent className="pt-5 pb-4">
              {result.error ? (
                <p className="text-destructive text-sm">❌ {result.error}</p>
              ) : (
                <p className="text-green-600 text-sm font-semibold">
                  ✅ Agreement generated! Status: {result.status}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Agreement List */}
        {selectedTenant && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agreements History</CardTitle>
            </CardHeader>
            <CardContent>
              {agreementsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !agreements || agreements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No agreements generated yet for this tenant.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="text-left py-2 pr-4">Template</th>
                        <th className="text-left py-2 px-4">Period</th>
                        <th className="text-left py-2 px-4">Status</th>
                        <th className="text-left py-2 px-4">Created</th>
                        <th className="text-right py-2 pl-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agreements.map((a: any) => (
                        <tr key={a.id} className="border-b border-border/40">
                          <td className="py-2.5 pr-4 font-medium capitalize">{a.templateType}</td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {a.startDate ? fmt.format(new Date(a.startDate)) : "—"}
                            {a.endDate ? ` → ${fmt.format(new Date(a.endDate))}` : ""}
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge variant={a.status === "draft" ? "secondary" : "default"}>
                              {a.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {fmt.format(new Date(a.createdAt))}
                          </td>
                          <td className="py-2.5 pl-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(a.id)}
                              className="gap-1"
                            >
                              <Download className="w-3 h-3" />
                              PDF
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
