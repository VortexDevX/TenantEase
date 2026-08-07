"use client";

import Link from "next/link";
import { Building2, CircleUserRound, Home, LogOut, Phone, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { useAuth } from "@/contexts/AuthContext";

type ProfileUser = NonNullable<ReturnType<typeof useAuth>["user"]>;

function homePath(role?: string) {
  switch (role) {
    case "ADMIN": return "/admin";
    case "OWNER": return "/";
    case "STAFF": return "/staff-portal";
    case "TENANT": return "/tenant";
    default: return "/login";
  }
}

function displayName(user: ProfileUser) {
  return user.displayName ?? user.fullName ?? "No name added";
}

function profileSubtitle(user: ProfileUser) {
  if (user.role === "OWNER") return user.companyName ?? "Owner workspace";
  if (user.role === "TENANT") {
    return user.hasBooking ? "Tenant profile linked to room" : "Tenant account waiting for owner setup";
  }
  if (user.role === "STAFF") {
    const assignmentCount = user.staffAssignments?.length ?? 0;
    return `${assignmentCount} active assignment${assignmentCount === 1 ? "" : "s"}`;
  }
  return "Admin account";
}

function ProfileHero({ user, onLogout }: { user: ProfileUser; onLogout: () => void }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <CircleUserRound className="h-7 w-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile</h1>
              <Badge>{user.role}</Badge>
            </div>
            <p className="mt-1 text-sm font-medium text-muted-foreground">{profileSubtitle(user)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={homePath(user.role)}>
              <Home className="mr-2 h-4 w-4" />
              Home
            </Link>
          </Button>
          <Button type="button" variant="secondary" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </div>
    </section>
  );
}

function ContactCard({ user }: { user: ProfileUser }) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Phone className="h-5 w-5 text-primary" />
          Contact
        </CardTitle>
        <CardDescription>Basic login identity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProfileFact label="Phone" value={`+91 ${user.phone}`} className="tabular-nums" />
        <ProfileFact label="Name" value={displayName(user)} />
      </CardContent>
    </Card>
  );
}

function AccessCard({ user }: { user: ProfileUser }) {
  const status = user.role === "TENANT" && !user.hasBooking
    ? "Owner will link your room before rent details appear."
    : "Active account";

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Access
        </CardTitle>
        <CardDescription>Current account permissions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProfileFact label="Role" value={user.role} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{status}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileFact({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-semibold text-foreground ${className ?? ""}`}>{value}</p>
    </div>
  );
}

function OwnerWorkspaceCard({ user }: { user: ProfileUser }) {
  if (user.role !== "OWNER") return null;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          Owner Workspace
        </CardTitle>
        <CardDescription>Business details shown on owner workflows</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <ProfileFact label="Owner name" value={user.displayName ?? "Not added"} />
        <ProfileFact label="Business name" value={user.companyName ?? "Not added"} />
      </CardContent>
    </Card>
  );
}

function StaffAssignmentsCard({ user }: { user: ProfileUser }) {
  if (user.role !== "STAFF" || !user.staffAssignments?.length) return null;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg">Staff Assignments</CardTitle>
        <CardDescription>Properties this phone can access</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {user.staffAssignments.map((assignment) => (
          <div key={assignment.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4">
            <div>
              <p className="font-semibold text-foreground">{assignment.propertyName}</p>
              <p className="text-xs font-medium text-muted-foreground">{assignment.propertyId}</p>
            </div>
            <Badge variant="secondary">{assignment.role}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProfileContent() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <ProfileHero user={user} onLogout={() => void logout()} />

      <section className="grid gap-4 md:grid-cols-2">
        <ContactCard user={user} />
        <AccessCard user={user} />
      </section>

      <OwnerWorkspaceCard user={user} />
      <StaffAssignmentsCard user={user} />
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();

  if (user?.role === "OWNER") {
    return (
      <DashboardLayout activePath="/profile">
        <ProfileContent />
      </DashboardLayout>
    );
  }

  if (user?.role === "TENANT") {
    return (
      <TenantLayout activePath="/profile">
        <ProfileContent />
      </TenantLayout>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <ProfileContent />
    </main>
  );
}
