"use client";

import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { useApi } from "@/lib/useApi";
import { fetchApi } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, UserCog, User, ShieldCheck, Search, Shield, BriefcaseBusiness, Home } from "lucide-react";

type AdminUser = {
  id: string;
  phone: string;
  role: "ADMIN" | "OWNER" | "TENANT";
  isBlocked: boolean;
  blockedAt: string | null;
  createdAt: string;
  ownerProfile: {
    id: string;
    displayName: string | null;
    companyName: string | null;
  } | null;
};

type AdminUsersResponse = {
  items: AdminUser[];
  total: number;
  limit: number;
  offset: number;
};

function AdminDashboardContent() {
  const { data, loading, refetch } = useApi<AdminUsersResponse>("/admin/users");
  const [updating, setUpdating] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const users = data?.items ?? [];
  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return users;
    }

    return users.filter((user) => {
      const displayName = user.ownerProfile?.displayName?.toLowerCase() ?? "";
      const companyName = user.ownerProfile?.companyName?.toLowerCase() ?? "";
      return (
        user.phone.includes(normalized) ||
        displayName.includes(normalized) ||
        companyName.includes(normalized) ||
        user.role.toLowerCase().includes(normalized)
      );
    });
  }, [query, users]);

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter((user) => user.role === "ADMIN").length,
    owners: users.filter((user) => user.role === "OWNER").length,
    tenants: users.filter((user) => user.role === "TENANT").length
  }), [users]);

  async function handleRoleChange(userId: string, newRole: "ADMIN" | "OWNER" | "TENANT") {
    setUpdating(userId);
    try {
      await fetchApi(`/admin/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: newRole }),
      });
      refetch(); // Reload user list
    } catch (err) {
      alert("Failed to update role");
      console.error(err);
    } finally {
      setUpdating(null);
    }
  }

  async function handleBlockToggle(userId: string, nextBlocked: boolean) {
    setUpdating(userId);
    try {
      await fetchApi(`/admin/users/${userId}/${nextBlocked ? "block" : "unblock"}`, {
        method: "POST",
      });
      refetch();
    } catch (err) {
      alert(nextBlocked ? "Failed to block user" : "Failed to unblock user");
      console.error(err);
    } finally {
      setUpdating(null);
    }
  }

  async function handleDelete(userId: string) {
    const confirmed = window.confirm("Delete this user account? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    setUpdating(userId);
    try {
      await fetchApi(`/admin/users/${userId}`, {
        method: "DELETE",
      });
      refetch();
    } catch (err) {
      alert("Failed to delete user");
      console.error(err);
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <section className="bg-destructive/5 border border-destructive/20 p-6 rounded-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-destructive" /> System Administration
        </h1>
        <p className="text-muted-foreground font-medium mt-1">
          Manage system-wide permissions and roles here.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Total Users</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{stats.total}</p>
            </div>
            <User className="w-5 h-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Admins</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{stats.admins}</p>
            </div>
            <Shield className="w-5 h-5 text-destructive" />
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Owners</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{stats.owners}</p>
            </div>
            <BriefcaseBusiness className="w-5 h-5 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Tenants</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{stats.tenants}</p>
            </div>
            <Home className="w-5 h-5 text-emerald-600" />
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-float border-border/80">
        <div className="p-4 border-b border-border bg-secondary/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <UserCog className="w-5 h-5" /> User Directory
            </h2>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by phone, role, or owner"
                className="pl-9"
              />
            </div>
          </div>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-destructive" /></div>
          ) : filteredUsers.length ? (
            <div className="divide-y divide-border">
              {filteredUsers.map((u) => (
                <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-secondary/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground tracking-tight">{u.phone}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">Joined: {new Date(u.createdAt).toLocaleDateString()}</span>
                      {u.isBlocked ? (
                        <span className="text-xs font-semibold text-destructive mt-0.5">
                          Blocked{u.blockedAt ? ` · ${new Date(u.blockedAt).toLocaleDateString()}` : ""}
                        </span>
                      ) : null}
                      {u.ownerProfile ? (
                        <span className="text-xs text-muted-foreground mt-0.5">
                          {u.ownerProfile.displayName ?? "Unnamed owner"}{u.ownerProfile.companyName ? ` · ${u.ownerProfile.companyName}` : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={u.isBlocked ? "destructive" : u.role === "ADMIN" ? "destructive" : u.role === "OWNER" ? "default" : "secondary"}
                      className="w-24 justify-center"
                    >
                      {u.isBlocked ? "BLOCKED" : (
                        <>
                          {u.role === "ADMIN" && <ShieldCheck className="w-3 h-3 mr-1" />}
                          {u.role}
                        </>
                      )}
                    </Badge>
                    
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <div className="flex border border-border rounded-lg overflow-hidden h-9">
                      {(["ADMIN", "OWNER", "TENANT"] as const).map(roleOption => (
                        <button
                          key={roleOption}
                          disabled={u.role === roleOption || updating === u.id}
                          onClick={() => handleRoleChange(u.id, roleOption)}
                          className={`px-3 text-xs font-medium transition-colors ${
                            u.role === roleOption 
                              ? "bg-secondary text-foreground opacity-50 cursor-not-allowed hidden" 
                              : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
                          } ${updating === u.id ? "opacity-50" : ""}`}
                        >
                          Make {roleOption}
                        </button>
                      ))}
                      </div>
                      <Button
                        variant={u.isBlocked ? "outline" : "destructive"}
                        size="sm"
                        disabled={updating === u.id}
                        onClick={() => handleBlockToggle(u.id, !u.isBlocked)}
                      >
                        {u.isBlocked ? "Unblock" : "Block"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updating === u.id}
                        onClick={() => handleDelete(u.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <p className="font-medium">No users found.</p>
              <p className="mt-1 text-sm">If you expect admin access here, add your phone to `ADMIN_PHONES` in `.env` and log in again.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={refetch}>Refresh Directory</Button>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { authorized } = useRequireRole("ADMIN");
  
  if (!authorized) return null;

  return (
    <AdminLayout activePath="/admin">
      <AdminDashboardContent />
    </AdminLayout>
  );
}
