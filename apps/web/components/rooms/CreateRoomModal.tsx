import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, fetchApi } from "@/lib/api-client";
import { paisaToRupeesInput, rupeesToPaisa } from "@/lib/money";
import { Loader2, X } from "lucide-react";
import type { RoomDto, RoomType } from "@tenantease/types";
import { useAccessibleDialog } from "@/lib/useAccessibleDialog";

interface CreateRoomModalProps {
  propertyId: string;
  room?: RoomDto | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateRoomModal({ propertyId, room, onClose, onSuccess }: CreateRoomModalProps) {
  const dialogRef = useAccessibleDialog(onClose);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!room;

  const [formData, setFormData] = useState({
    roomNumber: room?.roomNumber ?? "",
    floor: room?.floor ?? 0,
    type: room?.type ?? ("SINGLE" as RoomType),
    bedCount: room?.bedCount ?? 1,
    monthlyRent: room ? paisaToRupeesInput(room.monthlyRent) : "",
    depositAmount: room ? paisaToRupeesInput(room.depositAmount) : "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const monthlyRent = rupeesToPaisa(formData.monthlyRent);
    const depositAmount = rupeesToPaisa(formData.depositAmount || "0");

    if (!Number.isFinite(monthlyRent) || monthlyRent < 1) {
      setError("Monthly rent must be greater than ₹0.");
      return;
    }

    if (!Number.isFinite(depositAmount) || depositAmount < 0) {
      setError("Deposit must be ₹0 or more.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await fetchApi(isEditing ? `/rooms/${room.id}` : `/properties/${propertyId}/rooms`, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify({
          roomNumber: formData.roomNumber.trim(),
          floor: formData.floor,
          type: formData.type,
          bedCount: formData.bedCount,
          monthlyRent,
          depositAmount,
        }),
      });
      onSuccess();
    } catch (err) {
       if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
         setError(err.message);
       } else {
         setError(err instanceof Error ? err.message : "Failed to save room.");
       }
    } finally {
       setLoading(false);
    }
  }

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="room-dialog-title" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-float border border-border overflow-hidden animate-slide-up">
        <div className="flex justify-between items-center p-4 border-b border-border bg-secondary/30">
           <h2 id="room-dialog-title" className="font-bold text-lg text-foreground tracking-tight">{isEditing ? "Edit Room" : "Add New Room"}</h2>
           <button type="button" onClick={onClose} className="p-1.5 text-muted-foreground hover:bg-background rounded-full transition-colors" aria-label="Close room form">
              <X size={18} />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
           {error && (
             <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-medium">
                {error}
             </div>
           )}

           <div className="grid grid-cols-3 gap-4">
             <div className="flex flex-col gap-1.5">
                <label htmlFor="room-number" className="text-sm font-semibold">Room Number</label>
                <Input id="room-number" required value={formData.roomNumber} onChange={e => setFormData({...formData, roomNumber: e.target.value})} placeholder="e.g. 101" />
             </div>
             <div className="flex flex-col gap-1.5">
                <label htmlFor="room-floor" className="text-sm font-semibold">Floor</label>
                <Input id="room-floor" type="number" min="0" value={formData.floor} onChange={e => setFormData({...formData, floor: parseInt(e.target.value) || 0})} placeholder="0" />
             </div>
             <div className="flex flex-col gap-1.5">
                <label htmlFor="room-type" className="text-sm font-semibold">Type</label>
                <select
                  id="room-type"
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
              <label htmlFor="room-bed-count" className="text-sm font-semibold">Bed Count</label>
              <Input id="room-bed-count" type="number" required min="1" max="20" value={formData.bedCount} onChange={e => setFormData({...formData, bedCount: parseInt(e.target.value) || 1})} />
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-1.5 relative">
                <label htmlFor="room-monthly-rent" className="text-sm font-semibold">Monthly Rent (₹)</label>
                <Input id="room-monthly-rent" required type="number" min="1" step="0.01" value={formData.monthlyRent} onChange={e => setFormData({...formData, monthlyRent: e.target.value})} placeholder="0.00" />
             </div>
             <div className="flex flex-col gap-1.5 relative">
                <label htmlFor="room-deposit" className="text-sm font-semibold">Deposit (₹)</label>
                <Input id="room-deposit" type="number" min="0" step="0.01" value={formData.depositAmount} onChange={e => setFormData({...formData, depositAmount: e.target.value})} placeholder="0.00" />
             </div>
           </div>

           <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading} className="w-24">
                 {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditing ? "Update" : "Save"}
              </Button>
           </div>
        </form>
      </div>
    </div>
  );
}
