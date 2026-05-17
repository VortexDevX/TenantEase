"use client";

import { useAuth } from "@/contexts/AuthContext";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { useApi } from "@/lib/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ScrollText } from "lucide-react";

export default function TenantAgreementsPage() {
  const { user } = useAuth();

  const { data: agreements, loading } = useApi<any[]>(
    user?.tenantId ? `/tenants/${user.tenantId}/agreements` : null
  );

  const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const handleDownload = (agreementId: string) => {
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL}/agreements/${agreementId}/download`,
      "_blank"
    );
  };

  return (
    <TenantLayout activePath="/tenant/agreements">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            My Agreements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and download your rental agreements.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !agreements || agreements.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ScrollText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                No rental agreements found. Your property owner will generate one for you.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {agreements.map((a: any) => (
              <Card key={a.id}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize text-foreground">
                          {a.templateType} Agreement
                        </span>
                        <Badge variant={a.status === "draft" ? "secondary" : "default"}>
                          {a.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
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
                      className="gap-1"
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
