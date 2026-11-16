"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { RoomDto, TenantDto } from "@tenantease/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api-client";
import { rupeesToPaisa } from "@/lib/money";

export type TenantAction = "transfer" | "notice" | "vacate";

const titles = {
  transfer: "Move tenant",
  notice: "Record notice",
  vacate: "Vacate tenant",
};

export function TenantActionDialog({ action, tenant, rooms, onClose, onSaved }: {
  action: TenantAction;
  tenant: TenantDto;
  rooms: RoomDto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const choices = rooms.filter((room) => room.id !== tenant.roomId && room.occupiedBeds < room.bedCount);

  useEffect(() => {
    const current = dialog.current;
    current?.showModal();
    return () => current?.close();
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const rent = String(form.get("rent") ?? "");
    const monthlyRent = rent ? rupeesToPaisa(rent) : undefined;
    const damageDeduction = rupeesToPaisa(String(form.get("damage") || "0"));

    if ((monthlyRent !== undefined && (!Number.isSafeInteger(monthlyRent) || monthlyRent < 1))
      || !Number.isSafeInteger(damageDeduction) || damageDeduction < 0) {
      setError("Enter a valid rupee amount.");
      return;
    }

    const details = action === "transfer" ? { roomId: form.get("room"), monthlyRent }
      : action === "notice" ? { expectedVacateDate: form.get("date") }
        : { vacatedAt: form.get("date"), damageDeduction, refundStatus: "pending" };

    setPending(true);
    try {
      await fetchApi(`/tenants/${tenant.id}/${action}`, { method: "POST", body: JSON.stringify(details) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the change.");
      setPending(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="tenant-action-title" className="tenant-action-dialog"
      onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="tenant-action-title" className="text-xl font-bold">{titles[action]}</h2>
          <p className="text-sm text-muted-foreground">{tenant.fullName}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close dialog" disabled={pending} onClick={onClose}><X size={18} aria-hidden="true" /></Button>
      </div>
      <form onSubmit={save} className="mt-4 grid gap-4">
        {action === "transfer" ? (
          <>
            <label className="grid gap-1.5 text-sm font-semibold">New room
              <select name="room" required defaultValue="" className="min-h-11 rounded-lg border border-input bg-card px-3 text-sm">
                <option value="">{choices.length ? "Choose a vacant bed" : "No other rooms have vacancies"}</option>
                {choices.map((room) => <option key={room.id} value={room.id}>{room.roomNumber} · {room.bedCount - room.occupiedBeds} available</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">New monthly rent (optional)
              <Input name="rent" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="Keep current rent" />
            </label>
          </>
        ) : (
          <label className="grid gap-1.5 text-sm font-semibold">{action === "notice" ? "Expected move-out date" : "Move-out date"}
            <Input name="date" type="date" required defaultValue={action === "vacate" ? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : undefined} />
          </label>
        )}
        {action === "vacate" && (
          <label className="grid gap-1.5 text-sm font-semibold">Damage deduction (₹)
            <Input name="damage" type="number" min="0" step="0.01" inputMode="decimal" defaultValue="0" />
          </label>
        )}
        {error && <p role="alert" className="rounded-lg bg-destructive-soft p-3 text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={action === "vacate" ? "destructive" : "default"}
            disabled={pending || (action === "transfer" && !choices.length)}>{pending ? "Saving…" : titles[action]}</Button>
        </div>
      </form>
    </dialog>
  );
}
