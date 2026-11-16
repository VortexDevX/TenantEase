"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft, BarChart3, BedDouble, Building2, ChevronDown, CircleUserRound, CreditCard,
  FileText, LayoutDashboard, Megaphone, Settings, UserCog, Users, Wrench, Zap,
} from "lucide-react";
import type { StaffRole } from "@tenantease/types";
import { useAuth } from "@/contexts/AuthContext";
import { useProperty } from "@/lib/PropertyContext";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { WorkspaceShell, type WorkspaceLink } from "./WorkspaceShell";

const everyone: StaffRole[] = ["MANAGER", "ACCOUNTANT", "WARDEN"];
const finance: StaffRole[] = ["MANAGER", "ACCOUNTANT"];

type OperationsLink = WorkspaceLink & { staff?: StaffRole[] };

const navigation: { label: string; links: OperationsLink[] }[] = [
  { label: "Workspace", links: [
    { icon: LayoutDashboard, label: "Overview", href: "/", mobile: true, staff: everyone },
    { icon: Building2, label: "Properties", href: "/properties" },
    { icon: BedDouble, label: "Rooms", href: "/rooms", staff: everyone },
    { icon: Users, label: "Tenants", href: "/tenants", mobile: true, staff: everyone },
  ] },
  { label: "Finance", links: [
    { icon: CreditCard, label: "Payments", href: "/payments", mobile: true, staff: finance },
    { icon: Zap, label: "Utilities", href: "/utilities", staff: everyone },
    { icon: BarChart3, label: "Reports", href: "/reports", staff: ["ACCOUNTANT"] },
  ] },
  { label: "Operations", links: [
    { icon: Wrench, label: "Maintenance", href: "/maintenance", staff: ["MANAGER", "WARDEN"] },
    { icon: FileText, label: "Agreements", href: "/agreements", staff: everyone },
    { icon: Megaphone, label: "Announcements", href: "/announcements", staff: everyone },
    { icon: UserCog, label: "Staff", href: "/staff" },
  ] },
  { label: "Account", links: [
    { icon: Settings, label: "Subscription", href: "/subscription" },
    { icon: CircleUserRound, label: "Profile", href: "/profile", staff: everyone },
  ] },
];

const accountPaths = ["/", "/properties", "/profile", "/staff", "/staff-portal", "/subscription"];

export function DashboardLayout({ children, activePath }: { children: ReactNode; activePath: string }) {
  const { activeProperty, properties, staffRole, setActivePropertyId, loading, error, refetch } = useProperty();
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const groups = navigation.map(({ label, links }) => ({
    label,
    links: links.filter((link) => isOwner || link.href === "/" || link.href === "/profile" || (staffRole && link.staff?.includes(staffRole))),
  }));

  if (!isOwner) {
    groups[0].links.push({ icon: Building2, label: "Assignments", href: "/staff-portal" });
  }

  const isPropertyPage = !accountPaths.includes(activePath);
  const hasAccess = groups.some((group) => group.links.some((link) => link.href === activePath));

  return (
    <WorkspaceShell activePath={activePath} groups={groups} label={isOwner ? "Owner workspace" : "Staff workspace"}
      profileLink headerControl={
        <div className="workspace-property">
          <Building2 size={16} aria-hidden="true" />
          <select aria-label="Active property" value={activeProperty?.id ?? ""}
            onChange={(event) => setActivePropertyId(event.target.value)} disabled={!properties.length}>
            {!properties.length && <option value="">{loading ? "Loading properties…" : "No property"}</option>}
            {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </div>
      }>
      {error ? (
        <EmptyState title="Could not load properties" description={error}
          action={<Button onClick={refetch}>Try again</Button>} />
      ) : isPropertyPage && loading && !activeProperty ? (
        <p role="status" className="py-12 text-center text-muted-foreground">Loading property…</p>
      ) : isPropertyPage && !activeProperty ? (
        <EmptyState title="Select a property to continue" action={
          <Button asChild><Link href={isOwner ? "/properties" : "/staff-portal"}>{isOwner ? "Open properties" : "View assignments"}</Link></Button>
        } />
      ) : !hasAccess ? (
        <EmptyState title="This page is unavailable for your assignment" action={
          <Button asChild variant="outline"><Link href="/"><ArrowLeft size={16} aria-hidden="true" /> Overview</Link></Button>
        } />
      ) : isPropertyPage || activePath === "/" || activePath === "/properties" ? (
        <div key={activeProperty?.id} className="min-w-0">{children}</div>
      ) : children}
    </WorkspaceShell>
  );
}
