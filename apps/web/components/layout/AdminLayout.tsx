"use client";

import type { ReactNode } from "react";
import { Users, Settings } from "lucide-react";
import { WorkspaceShell } from "./WorkspaceShell";

const groups = [{ label: "Administration", links: [
  { icon: Users, label: "Users & roles", href: "/admin", mobile: true },
  { icon: Settings, label: "System settings", href: "/admin/settings", mobile: true },
] }];

export function AdminLayout({ children, activePath }: { children: ReactNode; activePath: string }) {
  return <WorkspaceShell label="Admin portal" groups={groups} activePath={activePath}>{children}</WorkspaceShell>;
}
