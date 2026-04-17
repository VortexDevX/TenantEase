"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IndianRupee, Plus, ReceiptIndianRupee, Download, TrendingUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { useProperty } from "@/lib/PropertyContext";
import { fetchApi } from "@/lib/api-client";
import { formatPaisa } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export default function PaymentsPage() {
  const { authorized } = useRequireRole("OWNER");
  const { activeProperty } = useProperty();
  const propertyId = activeProperty?.id;
  const [generating, setGenerating] = useState(false);

  async function handleGenerateRentRoll() {
    if (!propertyId) return;
    setGenerating(true);
    try {
      await fetchApi(`/properties/${propertyId}/rent/generate`, { method: "POST" });
      alert("Rent roll generated successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to generate rent roll");
    } finally {
      setGenerating(false);
    }
  }

  // For this initial view, we might fetch a roll-up or recent payments.
  // Assuming a generic endpoint /properties/:id/rent?limit=20 for recent history
  // Since we don't have a direct unified /payments endpoint wired up easily for just history, 
  // we'll display a placeholder empty state if data isn't easily fetchable, 
  // but let's wire it structurally.

  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/payments">
      <div className="flex flex-col gap-6 animate-fade-in pb-10">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <section>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <ReceiptIndianRupee className="w-8 h-8 text-primary" /> Payments & Ledgers
            </h1>
            <p className="text-muted-foreground font-medium mt-1">
              Track collected rent, overdue balances, and record manual payments.
            </p>
          </section>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" className="shadow-sm bg-card hover:bg-secondary">
               Export CSV
            </Button>
            <Link href="/payments/new">
              <Button className="rounded-xl shadow-soft">
                <Plus className="w-4 h-4 mr-2" /> Record Payment
              </Button>
            </Link>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid gap-4 md:grid-cols-2 mt-4">
           <Card className="border-border shadow-soft bg-primary/5 hover:bg-primary/10 transition-colors">
              <CardContent className="p-6 flex items-center justify-between">
                 <div className="flex flex-col gap-2">
                    <div className="w-10 h-10 bg-primary/20 text-primary-strong rounded-xl flex items-center justify-center">
                       <Plus size={20} />
                    </div>
                    <h3 className="font-bold text-lg text-foreground mt-2">Record Offline Payment</h3>
                    <p className="text-sm text-muted-foreground max-w-[250px]">Log cash or direct bank transfers against pending rent entries.</p>
                 </div>
                 <Link href="/payments/new" className="shrink-0">
                    <Button variant="default">Record Now</Button>
                 </Link>
              </CardContent>
           </Card>

           <Card className="border-border shadow-soft bg-success/5 hover:bg-success/10 transition-colors">
              <CardContent className="p-6 flex items-center justify-between">
                 <div className="flex flex-col gap-2">
                    <div className="w-10 h-10 bg-success/20 text-success rounded-xl flex items-center justify-center">
                       <TrendingUp size={20} />
                    </div>
                    <h3 className="font-bold text-lg text-foreground mt-2">Generate Rent Roll</h3>
                    <p className="text-sm text-muted-foreground max-w-[250px]">Automatically issue new rent invoices for all active tenants.</p>
                 </div>
                 <Button onClick={handleGenerateRentRoll} disabled={!propertyId || generating} variant="outline" className="text-success border-success/30 hover:bg-success/20">
                   {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                   Generate
                 </Button>
              </CardContent>
           </Card>
        </div>

        {/* Ledger Empty State / Structure */}
        <Card className="border-border shadow-float mt-4">
           <div className="p-4 border-b border-border bg-secondary/30 flex justify-between items-center">
              <h2 className="font-bold text-lg">Recent Payment Ledger</h2>
           </div>
           <CardContent className="p-16 text-center">
              <ReceiptIndianRupee className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground">No Recent Payments</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                 Once tenants make payments or you record them manually, the transaction history will appear in this ledger.
              </p>
           </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
