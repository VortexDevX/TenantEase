"use client";

import { useAuth } from "@/contexts/AuthContext";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { useApi } from "@/lib/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ScrollText } from "lucide-react";
import { openApiBlob } from "@/lib/api-client";

export default function TenantAgreementsPage() {
  const { user } = useAuth();

  const { data: agreements, loading } = useApi<any[]>(
    user?.tenantId ? `/tenants/${user.tenantId}/agreements` : null
  );

  const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const handleDownload = async (agreementId: string) => {
    await openApiBlob(`/agreements/${agreementId}/download`, `agreement-${agreementId}.pdf`);
  };

  return (
    <TenantLayout activePath="/tenant/agreements">
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            My Agreements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and download your rental agreements.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          </div>
        ) : !agreements || agreements.length === 0 ? (
          <Card className="border-white/[0.06] bg-white/[0.02] shadow-glass">
            <CardContent className="py-12 text-center">
              <ScrollText className="w-10 h-10 text-violet-400/80 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm font-semibold">
                No rental agreements found. Your property owner will generate one for you.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {agreements.map((a: any) => (
              <Card key={a.id} className="border-white/[0.06] bg-white/[0.02] shadow-glass">
                <CardContent className="pt-5 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold capitalize text-foreground">
                          {a.templateType} Agreement
                        </span>
                        <Badge variant={a.status === "draft" ? "secondary" : "default"} className={a.status !== "draft" ? "bg-violet-500/10 text-violet-400 border border-violet-500/20" : ""}>
                          {a.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-muted-foreground">
                        {a.startDate ? fmt.format(new Date(a.startDate)) : "—"}
                        {a.endDate ? ` → ${fmt.format(new Date(a.endDate))}` : ""}
                        {a.duration ? ` (${a.duration})` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created: {fmt.format(new Date(a.createdAt))}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(a.id)}
                      className="gap-1 border-white/[0.08] hover:bg-white/[0.04] text-violet-400 hover:text-violet-300"
                    >
                      <Download className="w-3 h-3" />
                      Download PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </TenantLayout>
  );
}
