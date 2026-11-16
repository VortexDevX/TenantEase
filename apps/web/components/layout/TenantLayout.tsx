"use client";

import type { ReactNode } from "react";
import { Home, Wrench, FileText, Megaphone, ScrollText, CircleUserRound } from "lucide-react";
import { WorkspaceShell } from "./WorkspaceShell";

const groups = [
  { label: "My stay", links: [
    { icon: Home, label: "Home", href: "/tenant", mobile: true },
    { icon: Megaphone, label: "Notices", href: "/tenant/announcements" },
    { icon: ScrollText, label: "Agreements", href: "/tenant/agreements" },
    { icon: Wrench, label: "Maintenance", href: "/tenant/maintenance", mobile: true },
    { icon: FileText, label: "Receipts", href: "/tenant/receipts", mobile: true },
  ] },
  { label: "Account", links: [{ icon: CircleUserRound, label: "Profile", href: "/profile" }] },
];

export function TenantLayout({ children, activePath }: { children: ReactNode; activePath: string }) {
  return <WorkspaceShell label="Tenant portal" groups={groups} activePath={activePath} profileLink>{children}</WorkspaceShell>;
}
