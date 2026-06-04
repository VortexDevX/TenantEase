"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { StaffAssignmentDto, StaffRole, SubscriptionDto } from "@tenantease/types";
import { ShieldCheck, UserCog, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { ApiError, fetchApi } from "@/lib/api-client";
import { useProperty } from "@/lib/PropertyContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const staffRoles: StaffRole[] = ["MANAGER", "ACCOUNTANT", "WARDEN"];

const roleCopy: Record<StaffRole, string> = {
  MANAGER: "Operations, rooms, tenants, maintenance",
  ACCOUNTANT: "Rent, payments, receipts, reports",
  WARDEN: "View access and maintenance follow-up"
};

function statusVariant(status: StaffAssignmentDto["inviteStatus"], active: boolean) {
  if (!active || status === "REVOKED") return "secondary";
  if (status === "ACCEPTED") return "success";
  return "warning";
}

function StaffContent() {
  const { properties, activeProperty } = useProperty();
  const [staff, setStaff] = useState<StaffAssignmentDto[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionDto | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("MANAGER");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeStaff = useMemo(
    () => staff.filter((item) => item.isActive && item.inviteStatus !== "REVOKED"),
    [staff]
  );

  const canInvite = subscription ? activeStaff.length < subscription.maxStaffAccounts : false;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [staffData, subscriptionData] = await Promise.all([
        fetchApi<StaffAssignmentDto[]>("/staff"),
        fetchApi<SubscriptionDto>("/subscription")
      ]);
      setStaff(staffData);
      setSubscription(subscriptionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!propertyId) {
      setPropertyId(activeProperty?.id ?? properties[0]?.id ?? "");
    }
  }, [activeProperty?.id, properties, propertyId]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("invite");
    setError(null);
    setMessage(null);
    try {
      await fetchApi<StaffAssignmentDto>("/staff/invite", {
        method: "POST",
        body: JSON.stringify({
          propertyId,
          phone,
          email: email.trim() || null,
          role
        })
      });
      setPhone("");
      setEmail("");
      setMessage("Staff invite created. They can log in with phone OTP.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invite failed");
    } finally {
      setSaving(null);
    }
  }

  async function updateRole(item: StaffAssignmentDto, nextRole: StaffRole) {
    setSaving(item.id);
    setError(null);
    setMessage(null);
    try {
      await fetchApi<StaffAssignmentDto>(`/staff/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ role: nextRole })
      });
      setMessage("Staff role updated.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setSaving(null);
    }
  }

  async function revokeStaff(item: StaffAssignmentDto) {
    const confirmed = window.confirm(`Revoke staff access for ${item.phone}?`);
    if (!confirmed) return;

    setSaving(item.id);
    setError(null);
    setMessage(null);
    try {
      await fetchApi<StaffAssignmentDto>(`/staff/${item.id}`, {
        method: "DELETE"
      });
      setMessage("Staff access revoked.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Remove failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <section>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
              <UserCog className="h-8 w-8 text-primary" />
              Staff Management
            </h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Invite property managers, accountants, and wardens with plan-aware access.
            </p>
          </section>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Active staff", activeStaff.length.toString()],
            ["Plan limit", subscription ? subscription.maxStaffAccounts.toString() : "--"],
            ["Current plan", subscription?.plan ?? "--"]
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {error ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 text-sm font-semibold text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        {message ? (
          <Card className="border-success/30 bg-success/5">
            <CardContent className="p-4 text-sm font-semibold text-success">{message}</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.35fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Plus className="h-5 w-5 text-primary" />
                Invite staff
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid gap-2">
                  <label htmlFor="staff-property" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Property
                  </label>
                  <select
                    id="staff-property"
                    value={propertyId}
                    onChange={(event) => setPropertyId(event.target.value)}
                    className="h-11 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary"
                    disabled={properties.length === 0}
                  >
                    {properties.length === 0 ? <option value="">No properties</option> : null}
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <label htmlFor="staff-phone" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Phone
                  </label>
                  <Input
                    id="staff-phone"
                    inputMode="numeric"
                    pattern="\d{10}"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="9876543210"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="staff-email" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Email
                  </label>
                  <Input
                    id="staff-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="optional@email.com"
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="staff-role" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Role
                  </label>
                  <select
                    id="staff-role"
                    value={role}
                    onChange={(event) => setRole(event.target.value as StaffRole)}
                    className="h-11 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary"
                  >
                    {staffRoles.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs font-medium text-muted-foreground">{roleCopy[role]}</p>
                </div>

                {!canInvite ? (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm font-medium text-warning">
                    Upgrade plan to add more staff accounts.
                  </div>
                ) : null}

                <Button className="w-full" type="submit" disabled={!propertyId || !canInvite || saving === "invite"}>
                  {saving === "invite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Send invite
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Assigned staff</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-44 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : staff.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm font-medium text-muted-foreground">
                  No staff assigned yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {staff.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border bg-background p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-foreground">{item.phone}</p>
                            <Badge variant={statusVariant(item.inviteStatus, item.isActive)}>{item.inviteStatus}</Badge>
                          </div>
                          <p className="mt-1 text-sm font-medium text-muted-foreground">{item.propertyName}</p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <label htmlFor={`role-${item.id}`} className="sr-only">
                            Staff role
                          </label>
                          <select
                            id={`role-${item.id}`}
                            value={item.role}
                            onChange={(event) => void updateRole(item, event.target.value as StaffRole)}
                            disabled={!item.isActive || item.inviteStatus === "REVOKED" || saving === item.id}
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
                          >
                            {staffRoles.map((staffRole) => (
                              <option key={staffRole} value={staffRole}>
                                {staffRole}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void revokeStaff(item)}
                            disabled={!item.isActive || item.inviteStatus === "REVOKED" || saving === item.id}
                          >
                            {saving === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Revoke
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}

export default function StaffPage() {
  const { authorized } = useRequireRole("OWNER");

  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/staff">
      <StaffContent />
    </DashboardLayout>
  );
}
