"use client";

import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { fetchApi } from "@/lib/api-client";
import { formatPaisa } from "@/lib/format";
import { IndianRupee, Search, CheckCircle2, ChevronRight, Banknote, CreditCard, Building, Loader2 } from "lucide-react";
import type { TenantDto, RentEntryDto } from "@tenantease/types";

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function RecordPaymentContent() {
  const { activeProperty, loading: propLoading } = useProperty();
  const propertyId = activeProperty?.id;

  const { data: tenants, loading: tenantsLoading } = useApi<TenantDto[]>(
    propertyId ? `/properties/${propertyId}/tenants?limit=100` : null
  );

  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"UPI" | "CASH" | "BANK_TRANSFER">("UPI");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selectedTenant = tenants?.find((t) => t.id === selectedTenantId) ?? null;

  // Fetch rent entries for selected tenant to find unpaid ones
  const { data: rentEntries } = useApi<RentEntryDto[]>(
    selectedTenantId ? `/tenants/${selectedTenantId}/rent` : null,
    { enabled: !!selectedTenantId }
  );

  const unpaidEntry = rentEntries?.find((e) => e.status === "UNPAID" || e.status === "PARTIAL" || e.status === "OVERDUE") ?? null;

  // Auto-fill amount from unpaid entry
  const defaultAmount = unpaidEntry ? (unpaidEntry.amountDue - unpaidEntry.amountPaid) / 100 : 0;

  const searchResults = useMemo(() => {
    if (!tenants || !search.trim()) return [];
    const q = search.toLowerCase();
    return tenants.filter(
      (t) => t.status === "ACTIVE" && (t.fullName.toLowerCase().includes(q) || t.phone.includes(q))
    ).slice(0, 5);
  }, [tenants, search]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unpaidEntry || !amount) return;

    setSubmitting(true);
    try {
      await fetchApi("/payments", {
        method: "POST",
        body: JSON.stringify({
          rentEntryId: unpaidEntry.id,
          amount: Math.round(parseFloat(amount) * 100), // convert to paisa
          mode: method,
          paidAt: new Date().toISOString(),
        }),
      });
      setSubmitted(true);
    } catch (err) {
      // Error state could be enhanced here
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  const isLoading = propLoading || tenantsLoading;

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 animate-fade-in">
        <div className="w-16 h-16 bg-success/10 text-success rounded-2xl flex items-center justify-center shadow-soft">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Payment Recorded</h2>
        <p className="text-muted-foreground font-medium">
          {formatPaisa(Math.round(parseFloat(amount) * 100))} from {selectedTenant?.fullName}
        </p>
        <Button onClick={() => { setSubmitted(false); setSelectedTenantId(null); setAmount(""); setSearch(""); }}>
          Record Another
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto animate-fade-in pb-10">
      
      {/* Header */}
      <section className="flex flex-col items-center justify-center text-center py-6">
         <div className="w-16 h-16 bg-primary/10 text-primary-strong rounded-2xl flex items-center justify-center mb-4 shadow-soft">
            <IndianRupee size={32} />
         </div>
         <h1 className="text-3xl font-bold tracking-tight text-foreground">Record Payment</h1>
         <p className="text-muted-foreground mt-2 font-medium max-w-sm">Capture offline payments or manual digital transfers instantly.</p>
      </section>

      {/* Form Container */}
      <Card className="shadow-float border-border/80">
        <CardContent className="p-0 sm:p-4">
           <form className="flex flex-col gap-8 p-6" onSubmit={handleSubmit}>
              
              {/* Step 1: Select Tenant */}
              <div className="flex flex-col gap-3 animate-slide-up stagger-1">
                 <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                   <span className="bg-secondary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span> 
                   Select Tenant
                 </label>
                 
                 {!selectedTenant ? (
                   <>
                     <div className="relative w-full">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
                       <Input
                         placeholder="Search Tenant Name or Phone..."
                         className="pl-10 h-12"
                         value={search}
                         onChange={(e) => setSearch(e.target.value)}
                       />
                     </div>
                     
                     {isLoading && (
                       <div className="flex items-center justify-center py-4">
                         <Loader2 className="w-5 h-5 animate-spin text-primary" />
                       </div>
                     )}
                     
                     {searchResults.length > 0 && (
                       <div className="border border-border rounded-xl overflow-hidden">
                         {searchResults.map((t) => (
                           <button
                             type="button"
                             key={t.id}
                             onClick={() => { setSelectedTenantId(t.id); setAmount(String((t.monthlyRent) / 100)); setSearch(""); }}
                             className="w-full text-left flex items-center gap-3 p-3 hover:bg-secondary/50 transition-colors border-b border-border last:border-0"
                           >
                             <div className="w-9 h-9 bg-primary/10 text-primary-strong rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                               {getInitials(t.fullName)}
                             </div>
                             <div className="flex flex-col">
                               <span className="font-semibold text-sm text-foreground">{t.fullName}</span>
                               <span className="text-xs text-muted-foreground">{t.phone} | {formatPaisa(t.monthlyRent)}/mo</span>
                             </div>
                           </button>
                         ))}
                       </div>
                     )}
                   </>
                 ) : (
                   <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-primary/10 text-primary-strong rounded-full flex items-center justify-center font-bold">
                           {getInitials(selectedTenant.fullName)}
                         </div>
                         <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{selectedTenant.fullName}</span>
                            <span className="text-xs text-muted-foreground font-medium">
                              {selectedTenant.phone} | Due: {unpaidEntry ? formatPaisa(unpaidEntry.amountDue - unpaidEntry.amountPaid) : formatPaisa(selectedTenant.monthlyRent)}
                            </span>
                         </div>
                      </div>
                      <button type="button" onClick={() => { setSelectedTenantId(null); setAmount(""); }} className="text-xs text-muted-foreground hover:text-foreground font-semibold">Change</button>
                   </div>
                 )}
              </div>

              {selectedTenant && (
                <>
                  <div className="h-px bg-border/60 w-full" />

                  {/* Step 2: Payment Details */}
                  <div className="flex flex-col gap-4 animate-slide-up stagger-2">
                     <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                       <span className="bg-secondary w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span> 
                       Payment Amount
                     </label>
                     
                     <div className="relative w-full">
                       <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground font-bold pointer-events-none" size={20} />
                       <Input 
                         type="number" 
                         value={amount}
                         onChange={(e) => setAmount(e.target.value)}
                         className="pl-11 h-16 text-2xl font-bold rounded-xl" 
                       />
                       <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                         INR
                       </div>
                     </div>
                  </div>

                  <div className="h-px bg-border/60 w-full" />

                  {/* Step 3: Payment Method */}
                  <div className="flex flex-col gap-3 animate-slide-up stagger-3">
                     <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                       <span className="bg-secondary w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span> 
                       Payment Method
                     </label>
                     
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {([
                          { value: "UPI" as const, icon: CreditCard, label: "UPI / Digital" },
                          { value: "CASH" as const, icon: Banknote, label: "Cash" },
                          { value: "BANK_TRANSFER" as const, icon: Building, label: "Bank Transfer" },
                        ]).map((opt) => (
                          <button
                            type="button"
                            key={opt.value}
                            onClick={() => setMethod(opt.value)}
                            className={`relative flex items-center justify-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
                              method === opt.value
                                ? "border-primary bg-primary/5 text-primary-strong"
                                : "border-border hover:bg-secondary/50"
                            }`}
                          >
                            <opt.icon size={18} />
                            <span className="font-semibold text-sm">{opt.label}</span>
                            {method === opt.value && (
                              <CheckCircle2 size={16} className="absolute right-3 text-primary-strong" />
                            )}
                          </button>
                        ))}
                     </div>
                  </div>

                  <div className="pt-6 animate-slide-up stagger-4">
                    <Button
                      type="submit"
                      className="w-full h-14 text-lg rounded-xl shadow-float group"
                      disabled={submitting || !amount || !unpaidEntry}
                    >
                       {submitting ? (
                         <Loader2 className="w-5 h-5 animate-spin mr-2" />
                       ) : null}
                       Confirm Payment <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                    {!unpaidEntry && selectedTenant && (
                      <p className="text-xs text-muted-foreground text-center mt-3">
                        No unpaid rent entry found for this tenant. Generate rent entries first.
                      </p>
                    )}
                  </div>
                </>
              )}
           </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { useRequireRole } from "@/contexts/AuthContext";

export default function RecordPayment() {
  const { authorized } = useRequireRole("OWNER");
  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/payments/new">
      <RecordPaymentContent />
    </DashboardLayout>
  );
}
