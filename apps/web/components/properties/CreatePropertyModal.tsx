import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api-client";
import { Loader2, X } from "lucide-react";
import type { PropertyType } from "@tenantease/types";

interface CreatePropertyModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreatePropertyModal({ onClose, onSuccess }: CreatePropertyModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    pinCode: "",
    type: "PG" as PropertyType,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await fetchApi("/properties", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      onSuccess();
    } catch (err: any) {
       setError(err.message || "Failed to create property.");
    } finally {
       setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-float border border-border overflow-hidden animate-slide-up">
        <div className="flex justify-between items-center p-4 border-b border-border bg-secondary/30">
           <h2 className="font-bold text-lg text-foreground tracking-tight">Add New Property</h2>
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
              <label className="text-sm font-semibold">Property Name</label>
              <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Sunrise PG" />
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Type</label>
                <select 
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.type} 
                  onChange={e => setFormData({...formData, type: e.target.value as PropertyType})}
                >
                  <option value="PG">PG</option>
                  <option value="HOSTEL">Hostel</option>
                  <option value="FLAT">Flat / Appt</option>
                </select>
             </div>
             <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Pin Code</label>
                <Input required value={formData.pinCode} onChange={e => setFormData({...formData, pinCode: e.target.value})} placeholder="e.g. 560001" />
             </div>
           </div>

           <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold">Full Address</label>
              <textarea 
                required 
                rows={2}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={formData.address} 
                onChange={e => setFormData({...formData, address: e.target.value})} 
                placeholder="Street address, block number..." 
              />
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">City</label>
                <Input required value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="e.g. Bangalore" />
             </div>
             <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">State</label>
                <Input required value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} placeholder="e.g. Karnataka" />
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
