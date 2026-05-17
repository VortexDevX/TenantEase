import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api-client";
import { Loader2, X, AlertCircle } from "lucide-react";

interface Props {
  propertyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AnnouncementModal({ propertyId, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "GENERAL",
    isImportant: false,
    targetFloor: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title || !formData.content) {
        setError("Title and content are required.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      await fetchApi(`/properties/${propertyId}/announcements`, {
        method: "POST",
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          category: formData.category,
          isImportant: formData.isImportant,
          targetFloor: formData.targetFloor ? parseInt(formData.targetFloor) : null,
          targetRoomId: null // Support for room targeting can be added later
        }),
      });
      onSuccess();
    } catch (err: any) {
       setError(err.message || "Failed to post announcement.");
    } finally {
       setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-float border border-border overflow-hidden animate-slide-up my-auto">
        <div className="flex justify-between items-center p-4 border-b border-border bg-secondary/30">
           <h2 className="font-bold text-lg text-foreground tracking-tight">Post Announcement</h2>
           <button onClick={onClose} className="p-1.5 text-muted-foreground hover:bg-background rounded-full transition-colors">
              <X size={18} />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
           {error && (
             <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-medium flex gap-2 items-center">
                <AlertCircle size={16} /> {error}
             </div>
           )}

           <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold">Title</label>
              <Input 
                required 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})} 
                placeholder="e.g. Water Supply Interruption" 
                maxLength={100}
              />
           </div>
           
           <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold">Message Content</label>
              <textarea 
                required 
                className="flex min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
                value={formData.content} 
                onChange={e => setFormData({...formData, content: e.target.value})} 
                placeholder="Write your announcement message here..." 
                maxLength={2000}
              />
           </div>

           <div className="grid grid-cols-2 gap-4 bg-secondary/10 p-4 rounded-xl border border-border">
              <div className="flex flex-col gap-1.5">
                 <label className="text-sm font-semibold">Category</label>
                 <select 
                   className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                   value={formData.category} 
                   onChange={e => setFormData({...formData, category: e.target.value})}
                 >
                   <option value="GENERAL">General</option>
                   <option value="MAINTENANCE">Maintenance</option>
                   <option value="PAYMENT">Payment</option>
                   <option value="RULE_CHANGE">Rule Change</option>
                   <option value="EMERGENCY">Emergency</option>
                 </select>
              </div>
              <div className="flex flex-col gap-1.5">
                 <label className="text-sm font-semibold">Target Floor (Optional)</label>
                 <Input 
                   type="number" 
                   value={formData.targetFloor} 
                   onChange={e => setFormData({...formData, targetFloor: e.target.value})} 
                   placeholder="e.g. 1" 
                 />
                 <span className="text-[10px] text-muted-foreground mt-0.5">Leave blank for all tenants</span>
              </div>
           </div>

           <div className="flex items-center gap-2 mt-1 py-1">
               <input 
                 type="checkbox" 
                 id="important-flag"
                 className="w-4 h-4 rounded border-inputaccent-primary focus:ring-primary text-primary"
                 checked={formData.isImportant}
                 onChange={e => setFormData({...formData, isImportant: e.target.checked})}
               />
               <label htmlFor="important-flag" className="text-sm font-medium flex flex-col cursor-pointer">
                 Mark as Important
                 <span className="text-[11px] text-muted-foreground font-normal">Highlights announcement in red</span>
               </label>
           </div>

           <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading} className="w-28 shadow-float">
                 {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Post"}
              </Button>
           </div>
        </form>
      </div>
    </div>
  );
}
