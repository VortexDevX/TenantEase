"use client";

import { TenantLayout } from "@/components/layout/TenantLayout";
import { useRequireRole, useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/lib/useApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Download, Clock } from "lucide-react";
import { formatPaisa } from "@/lib/format";
import type { TenantReceiptDto } from "@tenantease/types";
import { openApiBlob } from "@/lib/api-client";

function TenantReceiptsContent() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const { data: receipts, loading } = useApi<TenantReceiptDto[]>(
    tenantId ? "/tenant-portal/receipts" : null
  );

  if (!user?.hasBooking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center animate-fade-in">
        <div className="w-20 h-20 border border-white/[0.06] bg-white/[0.02] shadow-glass rounded-2xl flex items-center justify-center">
          <Clock className="w-10 h-10 text-violet-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">No Active Booking</h2>
        <p className="text-muted-foreground max-w-sm font-semibold">
          You don't have an active booking to view receipts for.
        </p>
      </div>
    );
  }

  const handleDownload = async (receipt: TenantReceiptDto) => {
    await openApiBlob(receipt.fileUrl, `${receipt.receiptNumber}.pdf`);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-10">
      <section>
         <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <FileText className="w-8 h-8 text-violet-400" /> Receipts
         </h1>
         <p className="text-muted-foreground font-medium mt-1 text-sm">
            Download your rent payment receipts.
         </p>
      </section>

      <div className="grid gap-4 mt-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-violet-400" /></div>
        ) : receipts?.length ? (
          receipts.map((receipt) => (
            <Card key={receipt.id} className="shadow-glass border-white/[0.06] bg-white/[0.02] hover:border-violet-500/30 transition-all duration-300">
              <CardContent className="p-5 flex justify-between items-center gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-bold text-lg text-foreground truncate">{receipt.billingMonth}</span>
                  <span className="text-sm font-semibold text-muted-foreground truncate">
                    {receipt.receiptNumber} · Paid: {formatPaisa(receipt.amount)} via {receipt.mode}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PAID</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-white/[0.08] hover:bg-white/[0.04] text-violet-400 hover:text-violet-300"
                    onClick={() => handleDownload(receipt)}
                  >
                     <Download size={16} /> <span className="hidden sm:inline">Download</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-white/[0.06] bg-white/[0.02] shadow-glass">
             <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-3">
               <FileText className="w-10 h-10 text-violet-400/80" />
               <h3 className="text-lg font-bold text-foreground">No Receipts Found</h3>
               <p className="text-muted-foreground text-sm font-semibold max-w-[250px]">
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
