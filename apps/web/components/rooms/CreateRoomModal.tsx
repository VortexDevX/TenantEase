import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api-client";
import { Loader2, X } from "lucide-react";
import type { RoomType } from "@tenantease/types";

interface CreateRoomModalProps {
  propertyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateRoomModal({ propertyId, onClose, onSuccess }: CreateRoomModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    roomNumber: "",
    type: "SINGLE" as RoomType,
    bedCount: 1,
    monthlyRent: "",
    depositAmount: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await fetchApi(`/properties/${propertyId}/rooms`, {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          // Convert rupees to paisa
          monthlyRent: Math.round(parseFloat(formData.monthlyRent) * 100),
          depositAmount: Math.round(parseFloat(formData.depositAmount) * 100),
        }),
      });
      onSuccess();
    } catch (err: any) {
       setError(err.message || "Failed to add room.");
    } finally {
       setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-float border border-border overflow-hidden animate-slide-up">
        <div className="flex justify-between items-center p-4 border-b border-border bg-secondary/30">
           <h2 className="font-bold text-lg text-foreground tracking-tight">Add New Room</h2>
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

           <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Room Number</label>
                <Input required value={formData.roomNumber} onChange={e => setFormData({...formData, roomNumber: e.target.value})} placeholder="e.g. 101" />
             </div>
             <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Type</label>
                <select 
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.type} 
                  onChange={e => {
                    const newType = e.target.value as RoomType;
                    const bedMap: Record<string, number> = { SINGLE: 1, DOUBLE: 2, TRIPLE: 3, DORMITORY: 4 };
                    setFormData({...formData, type: newType, bedCount: bedMap[newType] || formData.bedCount});
                  }}
                >
                  <option value="SINGLE">Single</option>
                  <option value="DOUBLE">Double</option>
                  <option value="TRIPLE">Triple</option>
                  <option value="DORMITORY">Dormitory</option>
                </select>
             </div>
           </div>

           <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold">Bed Count</label>
              <Input type="number" required min="1" value={formData.bedCount} onChange={e => setFormData({...formData, bedCount: parseInt(e.target.value) || 1})} />
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-1.5 relative">
                <label className="text-sm font-semibold">Monthly Rent (₹)</label>
                <Input required type="number" step="0.01" value={formData.monthlyRent} onChange={e => setFormData({...formData, monthlyRent: e.target.value})} placeholder="0.00" />
             </div>
             <div className="flex flex-col gap-1.5 relative">
                <label className="text-sm font-semibold">Deposit (₹)</label>
                <Input required type="number" step="0.01" value={formData.depositAmount} onChange={e => setFormData({...formData, depositAmount: e.target.value})} placeholder="0.00" />
             </div>
           </div>

           <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
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
