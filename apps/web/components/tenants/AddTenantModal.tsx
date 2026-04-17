import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api-client";
import { useApi } from "@/lib/useApi";
import { Loader2, X } from "lucide-react";
import type { RoomDto } from "@tenantease/types";

interface AddTenantModalProps {
  propertyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddTenantModal({ propertyId, onClose, onSuccess }: AddTenantModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: rooms, loading: loadingRooms } = useApi<RoomDto[]>(`/properties/${propertyId}/rooms`);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    roomId: "",
    moveInDate: new Date().toISOString().split('T')[0],
    monthlyRent: "",
    depositPaid: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await fetchApi(`/properties/${propertyId}/tenants`, {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          monthlyRent: Math.round(parseFloat(formData.monthlyRent) * 100),
          depositPaid: Math.round(parseFloat(formData.depositPaid) * 100),
        }),
      });
      onSuccess();
    } catch (err: any) {
       setError(err.message || "Failed to add tenant.");
    } finally {
       setLoading(false);
    }
  }

  const availableRooms = rooms?.filter(r => r.occupiedBeds < r.bedCount) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-float border border-border overflow-hidden animate-slide-up my-auto">
        <div className="flex justify-between items-center p-4 border-b border-border bg-secondary/30">
           <h2 className="font-bold text-lg text-foreground tracking-tight">Onboard New Tenant</h2>
           <button onClick={onClose} className="p-1.5 text-muted-foreground hover:bg-background rounded-full transition-colors">
              <X size={18} />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
           {error && (
             <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-medium">
                {error}
             </div>
           )}

           <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold">Full Name</label>
              <Input required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} placeholder="e.g. Rahul Sharma" />
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Phone Number</label>
                <Input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="10-digit number" />
             </div>
             <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Email (Optional)</label>
                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="rahul@example.com" />
             </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold flex justify-between">
                  Assign Room
                  {loadingRooms && <Loader2 className="w-3 h-3 animate-spin"/>}
                </label>
                <select 
                  required
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.roomId} 
                  onChange={e => {
                    const roomId = e.target.value;
                    const r = rooms?.find(room => room.id === roomId);
                    setFormData({
                       ...formData, 
                       roomId,
                       monthlyRent: r ? (r.monthlyRent / 100).toString() : formData.monthlyRent,
                       depositPaid: r ? (r.depositAmount / 100).toString() : formData.depositPaid,
                    });
                  }}
                >
                  <option value="" disabled>Select Room...</option>
                  {availableRooms.map(r => (
                    <option key={r.id} value={r.id}>Room {r.roomNumber} ({r.bedCount - r.occupiedBeds} beds left)</option>
                  ))}
                </select>
             </div>
             <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Move In Date</label>
                <Input type="date" required value={formData.moveInDate} onChange={e => setFormData({...formData, moveInDate: e.target.value})} />
             </div>
           </div>

           <div className="grid grid-cols-2 gap-4 bg-secondary/20 p-3 rounded-lg border border-border">
             <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Custom Rent (₹)</label>
                <Input required type="number" step="0.01" value={formData.monthlyRent} onChange={e => setFormData({...formData, monthlyRent: e.target.value})} placeholder="0.00" />
                <span className="text-[10px] text-muted-foreground leading-tight">Can be modified per tenant</span>
             </div>
             <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Deposit Paid (₹)</label>
                <Input required type="number" step="0.01" value={formData.depositPaid} onChange={e => setFormData({...formData, depositPaid: e.target.value})} placeholder="0.00" />
             </div>
           </div>

           <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading} className="w-24">
                 {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
           </div>
        </form>
      </div>
    </div>
  );
}
