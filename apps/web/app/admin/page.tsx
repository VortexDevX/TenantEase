"use client";

import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { useApi } from "@/lib/useApi";
import { fetchApi } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, UserCog, User, ShieldCheck } from "lucide-react";

function AdminDashboardContent() {
  const { data: users, loading, refetch } = useApi<any[]>("/admin/users");
  const [updating, setUpdating] = useState<string | null>(null);

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

      <Card className="shadow-float border-border/80">
        <div className="p-4 border-b border-border bg-secondary/30">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <UserCog className="w-5 h-5" /> User Directory
          </h2>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-destructive" /></div>
          ) : users?.length ? (
            <div className="divide-y divide-border">
              {users.map((u) => (
                <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-secondary/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground tracking-tight">{u.phone}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">Joined: {new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={u.role === "ADMIN" ? "destructive" : u.role === "OWNER" ? "default" : "secondary"}
                      className="w-24 justify-center"
                    >
                      {u.role === "ADMIN" && <ShieldCheck className="w-3 h-3 mr-1" />}
                      {u.role}
                    </Badge>
                    
                    <div className="flex shrink-0 border border-border rounded-lg overflow-hidden h-9">
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
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">No users found.</div>
          )}
        </CardContent>
      </Card>
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
