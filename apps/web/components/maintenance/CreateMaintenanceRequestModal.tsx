import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api-client";
import { Loader2, X } from "lucide-react";

interface CreateMaintenanceRequestModalProps {
  propertyId: string;
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateMaintenanceRequestModal({ propertyId, tenantId, onClose, onSuccess }: CreateMaintenanceRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    category: "PLUMBING",
    urgency: "MEDIUM",
    description: "",
    preferredTime: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await fetchApi(`/maintenance`, {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          propertyId,
          tenantId,
        }),
      });
      onSuccess();
    } catch (err: any) {
       setError(err.message || "Failed to submit request.");
    } finally {
       setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-float border border-border overflow-hidden animate-slide-up my-auto">
        <div className="flex justify-between items-center p-4 border-b border-border bg-secondary/30">
           <h2 className="font-bold text-lg text-foreground tracking-tight">Raise Maintenance Request</h2>
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
                <label className="text-sm font-semibold">Category</label>
                <select 
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.category} 
                  onChange={e => setFormData({...formData, category: e.target.value})}
                >
                  <option value="PLUMBING">Plumbing</option>
                  <option value="ELECTRICAL">Electrical</option>
                  <option value="CARPENTRY">Carpentry</option>
                  <option value="APPLIANCES">Appliances</option>
                  <option value="CLEANING">Cleaning</option>
                  <option value="OTHER">Other</option>
                </select>
             </div>
             <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Urgency</label>
                 <select 
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.urgency} 
                  onChange={e => setFormData({...formData, urgency: e.target.value})}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="EMERGENCY">Emergency</option>
                </select>
             </div>
           </div>

           <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold">Description</label>
              <textarea 
                required 
                rows={3}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                placeholder="Describe the issue in detail..." 
              />
           </div>

           <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold">Preferred Time (Optional)</label>
              <input 
                type="text"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={formData.preferredTime} 
                onChange={e => setFormData({...formData, preferredTime: e.target.value})} 
                placeholder="e.g. Weekends in the morning" 
              />
           </div>

           <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading} className="w-24">
                 {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
              </Button>
           </div>
        </form>
      </div>
    </div>
  );
}
