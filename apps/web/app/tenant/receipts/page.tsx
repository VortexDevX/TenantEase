"use client";

import { TenantLayout } from "@/components/layout/TenantLayout";
import { useRequireRole, useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/lib/useApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Download, Clock } from "lucide-react";
import { formatPaisa } from "@/lib/format";
import type { RentEntryDto } from "@tenantease/types";

function TenantReceiptsContent() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const { data: rentEntries, loading } = useApi<RentEntryDto[]>(
    tenantId ? "/tenant-portal/rent" : null
  );

  if (!user?.hasBooking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center animate-fade-in">
        <div className="w-20 h-20 bg-secondary rounded-2xl flex items-center justify-center">
          <Clock className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">No Active Booking</h2>
        <p className="text-muted-foreground max-w-sm">
          You don't have an active booking to view receipts for.
        </p>
      </div>
    );
  }

  // Filter only PAID or PARTIAL since UNPAID has no receipts
  const paidEntries = rentEntries?.filter(e => e.status === "PAID" || e.status === "PARTIAL") || [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <section>
         <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" /> Receipts
         </h1>
         <p className="text-muted-foreground font-medium mt-1">
            Download your rent payment receipts.
         </p>
      </section>

      <div className="grid gap-4 mt-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : paidEntries.length ? (
          paidEntries.map((req) => (
            <Card key={req.id} className="shadow-float border-border/80 hover:border-primary/30 transition-colors">
              <CardContent className="p-5 flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-lg text-foreground">{req.billingMonth}</span>
                  <span className="text-sm text-muted-foreground">Paid: {formatPaisa(req.amountPaid)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={req.status === "PAID" ? "success" : "warning"}>
                    {req.status}
                  </Badge>
                  <Button variant="outline" size="sm" className="gap-2 shrink-0">
                     <Download size={16} /> <span className="hidden sm:inline">Download</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-dashed shadow-none bg-transparent">
             <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-3">
               <FileText className="w-10 h-10 text-muted-foreground opacity-50" />
               <h3 className="text-lg font-bold">No Receipts Found</h3>
               <p className="text-muted-foreground text-sm max-w-[250px]">
                 Once you make a payment, your receipts will appear here.
               </p>
             </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function TenantReceiptsPage() {
  const { authorized } = useRequireRole("TENANT");
  if (!authorized) return null;

  return (
    <TenantLayout activePath="/tenant/receipts">
      <TenantReceiptsContent />
    </TenantLayout>
  );
}
