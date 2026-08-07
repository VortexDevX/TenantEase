"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  UserCog,
  Users,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { useApi } from "@/lib/useApi";
import { ApiError, fetchApi } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type AdminUser = {
  id: string;
  phone: string;
  role: "ADMIN" | "OWNER" | "STAFF" | "TENANT";
  isBlocked: boolean;
  blockedAt: string | null;
  createdAt: string;
  tenantRecordCount: number;
  staffAssignmentCount: number;
  ownerProfile: {
    id: string;
    displayName: string | null;
    companyName: string | null;
    propertyCount: number;
  } | null;
};

type AdminUsersResponse = {
  items: AdminUser[];
  total: number;
  limit: number;
  offset: number;
  summary: {
    total: number;
    blocked: number;
    admins: number;
    owners: number;
    staff: number;
    tenants: number;
  };
};

type AdminAuditLog = {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  payloadJson: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    phone: string;
    role: AdminUser["role"];
  } | null;
};

type AdminAuditResponse = {
  items: AdminAuditLog[];
  total: number;
  limit: number;
  offset: number;
};

type RoleFilter = "ALL" | "ADMIN" | "OWNER" | "STAFF" | "TENANT";
type StatusFilter = "ALL" | "ACTIVE" | "BLOCKED" | "LINKED";

const roleFilters: RoleFilter[] = ["ALL", "ADMIN", "OWNER", "STAFF", "TENANT"];
const statusFilters: StatusFilter[] = ["ALL", "ACTIVE", "BLOCKED", "LINKED"];

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function roleBadgeVariant(role: AdminUser["role"], blocked: boolean) {
  if (blocked) return "destructive";
  if (role === "ADMIN") return "destructive";
  if (role === "OWNER") return "default";
  if (role === "STAFF") return "warning";
  return "secondary";
}

function hasLinkedData(user: AdminUser) {
  return (user.ownerProfile?.propertyCount ?? 0) > 0 || user.tenantRecordCount > 0 || user.staffAssignmentCount > 0;
}

function describeUser(user: AdminUser) {
  if (user.ownerProfile) {
    const name = user.ownerProfile.displayName ?? "Unnamed owner";
    return user.ownerProfile.companyName ? `${name} · ${user.ownerProfile.companyName}` : name;
  }

  if (user.tenantRecordCount > 0) {
    return `${user.tenantRecordCount} tenant record${user.tenantRecordCount === 1 ? "" : "s"}`;
  }

  if (user.staffAssignmentCount > 0) {
    return `${user.staffAssignmentCount} staff assignment${user.staffAssignmentCount === 1 ? "" : "s"}`;
  }

  return "No profile data";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isProtectedAdmin(user: AdminUser, currentUserId?: string) {
  return user.role === "ADMIN" && user.id !== currentUserId;
}

function AdminDashboardContent({ currentUserId }: { currentUserId?: string }) {
  const { data, loading, error, refetch } = useApi<AdminUsersResponse>("/admin/users");
  const { data: auditData, loading: auditLoading, refetch: refetchAudit } = useApi<AdminAuditResponse>("/admin/audit-logs?limit=8");
  const [updating, setUpdating] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);

  const users = data?.items ?? [];
  const summary = data?.summary ?? {
    total: users.length,
    admins: users.filter((user) => user.role === "ADMIN").length,
    owners: users.filter((user) => user.role === "OWNER").length,
    staff: users.filter((user) => user.role === "STAFF").length,
    tenants: users.filter((user) => user.role === "TENANT").length,
    blocked: users.filter((user) => user.isBlocked).length,
  };

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return users.filter((user) => {
      const searchable = [
        user.phone,
        user.role,
        user.ownerProfile?.displayName ?? "",
        user.ownerProfile?.companyName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !normalized || searchable.includes(normalized);
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && !user.isBlocked) ||
        (statusFilter === "BLOCKED" && user.isBlocked) ||
        (statusFilter === "LINKED" && hasLinkedData(user));

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [query, roleFilter, statusFilter, users]);

  async function runAction(userId: string, action: () => Promise<void>, successMessage: string) {
    setUpdating(userId);
    setOperationError(null);
    setOperationSuccess(null);
    try {
      await action();
      setOperationSuccess(successMessage);
      await refetch();
      await refetchAudit();
    } catch (err) {
      setOperationError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setUpdating(null);
    }
  }

  function handleRoleChange(user: AdminUser, newRole: AdminUser["role"]) {
    if (isProtectedAdmin(user, currentUserId)) {
      setOperationError("Other admin accounts are protected. Change them directly in the database only when you mean it.");
      return;
    }
    if (user.id === currentUserId && user.role === "ADMIN" && newRole !== "ADMIN") {
      setOperationError("You cannot demote your own admin account.");
      return;
    }

    void runAction(
      user.id,
      () =>
        fetchApi(`/admin/users/${user.id}/role`, {
          method: "PUT",
          body: JSON.stringify({ role: newRole }),
        }),
      `Role changed to ${newRole}.`,
    );
  }

  function handleBlockToggle(user: AdminUser) {
    if (user.role === "ADMIN") {
      setOperationError(user.id === currentUserId ? "You cannot block your own admin account." : "Admin accounts are protected from block actions.");
      return;
    }

    const nextBlocked = !user.isBlocked;
    void runAction(
      user.id,
      () =>
        fetchApi(`/admin/users/${user.id}/${nextBlocked ? "block" : "unblock"}`, {
          method: "POST",
        }),
      nextBlocked ? "User blocked." : "User unblocked.",
    );
  }

  function handleDelete(user: AdminUser) {
    if (user.role === "ADMIN") {
      setOperationError(user.id === currentUserId ? "You cannot delete your own admin account." : "Admin accounts are protected from deletion.");
      return;
    }

    if (hasLinkedData(user)) {
      setOperationError("Users with properties, tenant records, or staff assignments cannot be deleted. Block them instead.");
      return;
    }

    const confirmed = window.confirm(`Delete ${user.phone}? This removes the account and cannot be undone.`);
    if (!confirmed) return;

    void runAction(
      user.id,
      () =>
        fetchApi(`/admin/users/${user.id}`, {
          method: "DELETE",
        }),
      "User deleted.",
    );
  }

  return (    <div className="flex flex-col gap-5 animate-fade-in pb-10">
      <section className="rounded-xl border border-rose-500/20 bg-rose-500/[0.02] p-5 shadow-glass-rose">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <ShieldAlert className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-500">Admin console</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">Users, Roles, And Access</h1>
              </div>
            </div>
              <p className="mt-3 max-w-2xl text-sm font-medium text-muted-foreground">
              Review accounts, change roles, block risky users, inspect audit activity, and remove only empty accounts.
            </p>
          </div>

          <Button variant="outline" onClick={refetch} disabled={loading} className="gap-2 border-white/[0.08] hover:bg-white/[0.04]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="grid gap-3 p-4 md:grid-cols-3">
            <div className="rounded-lg border border-rose-500/10 bg-rose-500/[0.02] p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-rose-400">
                <Lock className="h-4 w-4 text-rose-500" />
                Admin guard
              </div>
              <p className="mt-2 text-xs font-medium text-muted-foreground">Admins cannot demote, block, or delete other admins from UI/API.</p>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.01] p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <BriefcaseBusiness className="h-4 w-4 text-primary" />
                Business data
              </div>
              <p className="mt-2 text-xs font-medium text-muted-foreground">Users with properties or tenant records can be blocked, not deleted.</p>
            </div>
            <div className="rounded-lg border border-success/10 bg-success-soft/5 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-success">
                <Database className="h-4 w-4 text-success" />
                DB editor
              </div>
              <code className="mt-2 block rounded-md bg-white/[0.04] border border-white/[0.06] px-2 py-1 text-[11px] font-semibold text-foreground">corepack pnpm db:studio</code>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Recent audit</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{auditData?.total ?? 0} total events</p>
              </div>
              <Activity className="h-5 w-5 text-muted-foreground opacity-60" />
            </div>
            <div className="mt-3 flex max-h-44 flex-col gap-2 overflow-auto pr-1">
              {auditLoading ? (
                <div className="flex h-20 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-rose-500" />
                </div>
              ) : auditData?.items.length ? (
                auditData.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-foreground">{item.action}</p>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                      {item.user?.phone ?? "System"} · {item.resource}
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-xs font-medium text-muted-foreground">No audit events yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card className="border-white/[0.06] bg-white/[0.02] shadow-glass">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Total</p>
              <p className="mt-2 text-3xl font-black tracking-tight">{summary.total}</p>
            </div>
            <Users className="h-5 w-5 text-muted-foreground opacity-55" />
          </CardContent>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] shadow-glass">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-500">Admins</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-rose-500">{summary.admins}</p>
            </div>
            <Shield className="h-5 w-5 text-rose-500 opacity-70" />
          </CardContent>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] shadow-glass">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Owners</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-primary">{summary.owners}</p>
            </div>
            <BriefcaseBusiness className="h-5 w-5 text-primary opacity-70" />
          </CardContent>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] shadow-glass">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-success">Tenants</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-success">{summary.tenants}</p>
            </div>
            <User className="h-5 w-5 text-success opacity-70" />
          </CardContent>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] shadow-glass">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-warning">Staff</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-warning">{summary.staff}</p>
            </div>
            <UserCog className="h-5 w-5 text-warning opacity-70" />
          </CardContent>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02] shadow-glass">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">Blocked</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-rose-600">{summary.blocked}</p>
            </div>
            <Ban className="h-5 w-5 text-rose-600 opacity-70" />
          </CardContent>
        </Card>
      </section>

      {(error || operationError || operationSuccess) && (
        <section
          className={`rounded-lg border p-4 text-sm font-semibold ${
            operationSuccess
              ? "border-success/20 bg-success-soft/10 text-success shadow-glass-success"
              : "border-destructive/20 bg-destructive-soft/10 text-destructive shadow-glass-error"
          }`}
        >
          <div className="flex items-start gap-2">
            {operationSuccess ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
            <p>{operationSuccess ?? operationError ?? error}</p>
          </div>
        </section>
      )}

      <Card className="overflow-hidden border-white/[0.06] bg-white/[0.02] shadow-glass">
        <div className="border-b border-white/[0.04] bg-white/[0.01] p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
            <div>
              <label htmlFor="admin-user-search" className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Search directory
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-60" />
                <Input
                  id="admin-user-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Phone, owner name, company, role"
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-role-filter" className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Role
              </label>
              <select
                id="admin-role-filter"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-semibold text-foreground outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 lg:w-40"
              >
                {roleFilters.map((role) => (
                  <option key={role} value={role} className="bg-background">
                    {role === "ALL" ? "All roles" : role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="admin-status-filter" className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Status
              </label>
              <select
                id="admin-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-semibold text-foreground outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 lg:w-44"
              >
                {statusFilters.map((status) => (
                  <option key={status} value={status} className="bg-background">
                    {status === "ALL" ? "All users" : status === "LINKED" ? "Has data" : status}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
            </div>
          ) : filteredUsers.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="border-b border-white/[0.04] bg-white/[0.01]">
                  <tr className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Linked Data</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] bg-white/[0.01]">
                  {filteredUsers.map((user) => {
                    const linked = hasLinkedData(user);
                    const busy = updating === user.id;
                    const protectedAdmin = isProtectedAdmin(user, currentUserId);
                    const self = user.id === currentUserId;
                    return (
                      <tr key={user.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-muted-foreground border border-white/[0.08]">
                              <UserCog className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-bold tracking-tight text-foreground">{user.phone}</p>
                              <p className="mt-1 text-xs font-medium text-muted-foreground">{describeUser(user)}</p>
                              {user.isBlocked ? (
                                <p className="mt-1 text-xs font-semibold text-rose-500">Blocked on {formatDate(user.blockedAt)}</p>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-1">
                                {self ? <Badge variant="outline" className="border-rose-500/20 text-rose-400 bg-rose-500/5">You</Badge> : null}
                                {protectedAdmin ? <Badge variant="destructive" className="bg-rose-500/25 border-rose-500/40 text-rose-200">Protected admin</Badge> : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <Badge variant={roleBadgeVariant(user.role, user.isBlocked)} className={`gap-1 ${user.isBlocked ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : ''}`}>
                            {user.role === "ADMIN" ? <ShieldCheck className="h-3 w-3" /> : null}
                            {user.isBlocked ? "BLOCKED" : user.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={user.ownerProfile?.propertyCount ? "default" : "outline"} className={user.ownerProfile?.propertyCount ? 'bg-primary/20 text-primary-strong border-primary/30' : 'border-white/[0.08]'}>
                              {user.ownerProfile?.propertyCount ?? 0} properties
                            </Badge>
                            <Badge variant={user.tenantRecordCount ? "success" : "outline"} className={user.tenantRecordCount ? 'bg-success-soft/20 text-success border-success/30' : 'border-white/[0.08]'}>
                              {user.tenantRecordCount} tenant records
                            </Badge>
                            <Badge variant={user.staffAssignmentCount ? "warning" : "outline"} className={user.staffAssignmentCount ? 'bg-warning-soft/20 text-warning border-warning/30' : 'border-white/[0.08]'}>
                              {user.staffAssignmentCount} staff links
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-muted-foreground">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-wrap justify-end gap-2">
                            {(["ADMIN", "OWNER", "STAFF", "TENANT"] as const).map((roleOption) => (
                              <Button
                                key={roleOption}
                                variant={user.role === roleOption ? "secondary" : "outline"}
                                size="sm"
                                disabled={
                                  user.role === roleOption ||
                                  busy ||
                                  protectedAdmin ||
                                  (self && user.role === "ADMIN" && roleOption !== "ADMIN")
                                }
                                title={protectedAdmin ? "Other admin accounts are protected" : undefined}
                                onClick={() => handleRoleChange(user, roleOption)}
                                className={`border-white/[0.06] hover:bg-white/[0.04] text-xs h-8 ${user.role === roleOption ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : ''}`}
                              >
                                {roleOption}
                              </Button>
                            ))}
                            <Button
                              variant={user.isBlocked ? "outline" : "destructive"}
                              size="sm"
                              disabled={busy || user.role === "ADMIN"}
                              onClick={() => handleBlockToggle(user)}
                              title={user.role === "ADMIN" ? "Admin accounts are protected from block actions" : undefined}
                              className="gap-1 text-xs h-8"
                            >
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                              {user.isBlocked ? "Unblock" : "Block"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy || linked || user.role === "ADMIN"}
                              onClick={() => handleDelete(user)}
                              title={
                                user.role === "ADMIN"
                                  ? "Admin accounts are protected from deletion"
                                  : linked
                                    ? "Block users with linked property, tenant, or staff data instead"
                                    : "Delete empty account"
                              }
                              className="gap-1 text-xs h-8 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-400"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-56 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <Users className="h-9 w-9" />
              <p className="font-semibold text-foreground">No users match current filters.</p>
              <p className="text-sm">Clear search or switch filters to see all accounts.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { authorized, user } = useRequireRole("ADMIN");

  if (!authorized) return null;

  return (
    <AdminLayout activePath="/admin">
      <AdminDashboardContent currentUserId={user?.id} />
    </AdminLayout>
  );
}
