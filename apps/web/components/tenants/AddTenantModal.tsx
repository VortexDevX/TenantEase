import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, fetchApi } from "@/lib/api-client";
import { paisaToRupeesInput, rupeesToPaisa } from "@/lib/money";
import { useApi } from "@/lib/useApi";
import { Loader2, X } from "lucide-react";
import type { RoomDto } from "@tenantease/types";
import { useAccessibleDialog } from "@/lib/useAccessibleDialog";

interface AddTenantModalProps {
  propertyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type ValidationIssue = {
  path?: Array<string | number>;
  message?: string;
};

type TenantFormData = {
  fullName: string;
  phone: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  aadhaarLast4: string;
  notes: string;
  roomId: string;
  moveInDate: string;
  monthlyRent: string;
  depositPaid: string;
};

type TenantPayload = {
  fullName: string;
  phone: string;
  email: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  aadhaarLast4: string | null;
  notes: string | null;
  roomId: string;
  moveInDate: string;
  monthlyRent: number;
  depositPaid: number;
};

type TenantPayloadResult = { error: string; payload?: never } | { payload: TenantPayload; error?: never };

const FIELD_LABELS: Record<string, string> = {
  fullName: "Full name",
  phone: "Phone number",
  email: "Email",
  emergencyContactName: "Emergency contact name",
  emergencyContactPhone: "Emergency contact phone",
  emergencyContactRelation: "Emergency contact relation",
  aadhaarLast4: "Aadhaar last 4",
  notes: "Notes",
  roomId: "Room",
  moveInDate: "Move-in date",
  monthlyRent: "Monthly rent",
  depositPaid: "Deposit paid"
};

function formatTenantError(error: unknown) {
  if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
    if (Array.isArray(error.details)) {
      const messages = error.details
        .map((issue: ValidationIssue) => {
          const field = issue.path?.find((part) => typeof part === "string") as string | undefined;
          const label = field ? FIELD_LABELS[field] ?? field : "Field";

          if (field === "email") return "Email must be valid or left blank.";
          if (field === "phone") return "Phone number must be 10 digits.";
          if (field === "moveInDate") return "Move-in date must be selected.";
          if (field === "roomId") return "Select an available room.";

          return `${label}: ${issue.message ?? "Invalid value"}`;
        })
        .filter(Boolean);

      if (messages.length > 0) {
        return messages.join(" ");
      }
    }

    return error.message;
  }

  return error instanceof Error ? error.message : "Failed to add tenant.";
}

function buildTenantPayload(formData: TenantFormData): TenantPayloadResult {
  const monthlyRent = rupeesToPaisa(formData.monthlyRent);
  const depositPaid = rupeesToPaisa(formData.depositPaid);
  const phone = formData.phone.replace(/\D/g, "");
  const email = formData.email.trim();
  const emergencyContactPhone = formData.emergencyContactPhone.replace(/\D/g, "");
  const aadhaarLast4 = formData.aadhaarLast4.replace(/\D/g, "");

  const error =
    validateText(formData.fullName.trim().length >= 2, "Full name must be at least 2 characters.") ??
    validateText(/^\d{10}$/.test(phone), "Phone number must be 10 digits.") ??
    validateText(Boolean(formData.roomId), "Select an available room.") ??
    validateText(!emergencyContactPhone || /^\d{10}$/.test(emergencyContactPhone), "Emergency contact phone must be 10 digits or left blank.") ??
    validateText(!aadhaarLast4 || /^\d{4}$/.test(aadhaarLast4), "Aadhaar metadata must be only the last 4 digits.") ??
    validateText(Boolean(formData.moveInDate), "Move-in date must be selected.") ??
    validateText(Number.isFinite(monthlyRent) && monthlyRent >= 1, "Monthly rent must be greater than ₹0.") ??
    validateText(Number.isFinite(depositPaid) && depositPaid >= 0, "Deposit paid must be ₹0 or more.");

  if (error) {
    return { error };
  }

  return {
    payload: {
      fullName: formData.fullName.trim(),
      phone,
      email: email || null,
      emergencyContactName: formData.emergencyContactName.trim() || null,
      emergencyContactPhone: emergencyContactPhone || null,
      emergencyContactRelation: formData.emergencyContactRelation.trim() || null,
      aadhaarLast4: aadhaarLast4 || null,
      notes: formData.notes.trim() || null,
      roomId: formData.roomId,
      moveInDate: formData.moveInDate,
      monthlyRent,
      depositPaid
    }
  };
}

function validateText(condition: boolean, message: string) {
  return condition ? null : message;
}

export function AddTenantModal({ propertyId, onClose, onSuccess }: AddTenantModalProps) {
  const dialogRef = useAccessibleDialog(onClose);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: rooms, loading: loadingRooms } = useApi<RoomDto[]>(`/properties/${propertyId}/rooms`);

  const [formData, setFormData] = useState<TenantFormData>({
    fullName: "",
    phone: "",
    email: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    aadhaarLast4: "",
    notes: "",
    roomId: "",
    moveInDate: new Date().toISOString().split('T')[0],
    monthlyRent: "",
    depositPaid: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = buildTenantPayload(formData);

    if (!result.payload) {
      setError(result.error);
      return;
    }

    setLoading(true);

    try {
      await fetchApi(`/properties/${propertyId}/tenants`, {
        method: "POST",
        body: JSON.stringify(result.payload),
      });
      onSuccess();
    } catch (err) {
       setError(formatTenantError(err));
    } finally {
       setLoading(false);
    }
  }

  const availableRooms = rooms?.filter(r => r.occupiedBeds < r.bedCount) || [];

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="tenant-dialog-title" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-float border border-border overflow-hidden animate-slide-up my-auto">
        <div className="flex justify-between items-center p-4 border-b border-border bg-secondary/30">
           <h2 id="tenant-dialog-title" className="font-bold text-lg text-foreground tracking-tight">Onboard New Tenant</h2>
           <button type="button" onClick={onClose} className="p-1.5 text-muted-foreground hover:bg-background rounded-full transition-colors" aria-label="Close tenant form">
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
              <label htmlFor="tenant-full-name" className="text-sm font-semibold">Full Name</label>
              <Input id="tenant-full-name" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} placeholder="e.g. Rahul Sharma" />
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-1.5">
                <label htmlFor="tenant-emergency-name" className="text-sm font-semibold">Emergency Contact</label>
                <Input id="tenant-emergency-name" value={formData.emergencyContactName} onChange={e => setFormData({...formData, emergencyContactName: e.target.value})} placeholder="Contact name" />
             </div>
             <div className="flex flex-col gap-1.5">
                <label htmlFor="tenant-emergency-phone" className="text-sm font-semibold">Emergency Phone</label>
                <Input id="tenant-emergency-phone" type="tel" inputMode="numeric" maxLength={10} value={formData.emergencyContactPhone} onChange={e => setFormData({...formData, emergencyContactPhone: e.target.value.replace(/\D/g, "").slice(0, 10)})} placeholder="10-digit number" />
             </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-1.5">
                <label htmlFor="tenant-emergency-relation" className="text-sm font-semibold">Relation</label>
                <Input id="tenant-emergency-relation" value={formData.emergencyContactRelation} onChange={e => setFormData({...formData, emergencyContactRelation: e.target.value})} placeholder="Father, friend..." />
             </div>
             <div className="flex flex-col gap-1.5">
                <label htmlFor="tenant-aadhaar-last4" className="text-sm font-semibold">Aadhaar Last 4</label>
                <Input id="tenant-aadhaar-last4" inputMode="numeric" maxLength={4} value={formData.aadhaarLast4} onChange={e => setFormData({...formData, aadhaarLast4: e.target.value.replace(/\D/g, "").slice(0, 4)})} placeholder="4567" />
             </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-1.5">
                <label htmlFor="tenant-phone" className="text-sm font-semibold">Phone Number</label>
                <Input id="tenant-phone" required type="tel" inputMode="numeric" maxLength={10} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, "").slice(0, 10)})} placeholder="10-digit number" />
             </div>
             <div className="flex flex-col gap-1.5">
                <label htmlFor="tenant-email" className="text-sm font-semibold">Email (Optional)</label>
                <Input id="tenant-email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="rahul@example.com" />
             </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-1.5">
                <label htmlFor="tenant-room" className="text-sm font-semibold flex justify-between">
                  Assign Room
                  {loadingRooms && <Loader2 className="w-3 h-3 animate-spin"/>}
                </label>
                <select 
                  id="tenant-room"
                  required
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.roomId} 
                  onChange={e => {
                    const roomId = e.target.value;
                    const r = rooms?.find(room => room.id === roomId);
                    setFormData({
                       ...formData, 
                       roomId,
                       monthlyRent: r ? paisaToRupeesInput(r.monthlyRent) : formData.monthlyRent,
                       depositPaid: r ? paisaToRupeesInput(r.depositAmount) : formData.depositPaid,
                    });
                  }}
                >
                  <option value="" disabled>{availableRooms.length > 0 ? "Select Room..." : "No rooms available"}</option>
                  {availableRooms.map(r => (
                    <option key={r.id} value={r.id}>Room {r.roomNumber} ({r.bedCount - r.occupiedBeds} beds left)</option>
                  ))}
                </select>
             </div>
             <div className="flex flex-col gap-1.5">
                <label htmlFor="tenant-move-in-date" className="text-sm font-semibold">Move In Date</label>
                <Input id="tenant-move-in-date" type="date" required value={formData.moveInDate} onChange={e => setFormData({...formData, moveInDate: e.target.value})} />
             </div>
           </div>

           <div className="flex flex-col gap-1.5">
              <label htmlFor="tenant-notes" className="text-sm font-semibold">Notes</label>
              <textarea
                id="tenant-notes"
                rows={2}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                placeholder="Optional schedule, referral, or house-rule notes"
              />
           </div>

           <div className="grid grid-cols-2 gap-4 bg-secondary/20 p-3 rounded-lg border border-border">
             <div className="flex flex-col gap-1.5">
                <label htmlFor="tenant-monthly-rent" className="text-sm font-semibold">Custom Rent (₹)</label>
                <Input id="tenant-monthly-rent" required type="number" min="1" step="0.01" value={formData.monthlyRent} onChange={e => setFormData({...formData, monthlyRent: e.target.value})} placeholder="0.00" />
                <span className="text-[10px] text-muted-foreground leading-tight">Can be modified per tenant</span>
             </div>
             <div className="flex flex-col gap-1.5">
                <label htmlFor="tenant-deposit-paid" className="text-sm font-semibold">Deposit Paid (₹)</label>
                <Input id="tenant-deposit-paid" required type="number" min="0" step="0.01" value={formData.depositPaid} onChange={e => setFormData({...formData, depositPaid: e.target.value})} placeholder="0.00" />
             </div>
           </div>

           <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading || loadingRooms || availableRooms.length === 0} className="w-24">
                 {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
           </div>
        </form>
      </div>
    </div>
  );
}
