import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api-client";
import { Loader2, X } from "lucide-react";

interface ResolveMaintenanceModalProps {
  requestId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResolveMaintenanceModal({ requestId, onClose, onSuccess }: ResolveMaintenanceModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await fetchApi(`/maintenance/${requestId}`, {
        method: "PUT",
        body: JSON.stringify({
          status: "RESOLVED",
          resolutionNotes: notes,
        }),
      });
      onSuccess();
    } catch (err: any) {
       setError(err.message || "Failed to resolve request.");
    } finally {
       setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-float border border-border overflow-hidden animate-slide-up my-auto">
        <div className="flex justify-between items-center p-4 border-b border-border bg-secondary/30">
           <h2 className="font-bold text-lg text-foreground tracking-tight">Mark Resolved</h2>
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
              <label className="text-sm font-semibold">Resolution Notes</label>
              <textarea 
                required 
                rows={3}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="Briefly describe what was fixed..." 
              />
           </div>

           <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading} className="w-24">
                 {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Resolve"}
              </Button>
           </div>
        </form>
      </div>
    </div>
  );
}
