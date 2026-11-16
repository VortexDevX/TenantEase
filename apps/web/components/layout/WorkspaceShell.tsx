"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Brand } from "@/components/shared/Brand";
import { Button } from "@/components/ui/button";

export type WorkspaceLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  mobile?: boolean;
};

export type WorkspaceGroup = { label: string; links: WorkspaceLink[] };

export function WorkspaceShell({
  children, activePath, groups, label, headerControl, profileLink = false,
}: {
  children: ReactNode;
  activePath: string;
  groups: WorkspaceGroup[];
  label: string;
  headerControl?: ReactNode;
  profileLink?: boolean;
}) {
  const { user, logout } = useAuth();
  const menu = useRef<HTMLDialogElement>(null);
  const links = groups.flatMap((group) => group.links);
  const home = links[0]?.href ?? "/";
  const active = links.find((link) => link.href === activePath);
  const mobileLinks = links.filter((link) => link.mobile);
  const name = user?.displayName || user?.fullName || label;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

  function navigation(closeMenu = false) {
    return groups.map((group) => group.links.length > 0 && (
      <div key={group.label} className="workspace-nav-group">
        <p>{group.label}</p>
        {group.links.map(({ href, label: title, icon: Icon }) => (
          <Link key={href} href={href} aria-current={activePath === href ? "page" : undefined}
            onClick={closeMenu ? () => menu.current?.close() : undefined}>
            <Icon size={17} aria-hidden="true" />
            {title}
          </Link>
        ))}
      </div>
    ));
  }

  return (
    <div className="workspace">
      <a className="skip-link" href="#workspace-content">Skip to content</a>
      <aside className="workspace-sidebar">
        <Brand href={home} />
        <nav aria-label={label} className="workspace-navigation">{navigation()}</nav>
        <div className="workspace-account">
          <span className="workspace-avatar" aria-hidden="true">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="workspace-account-label">{label}</p>
          </div>
          <button type="button" aria-label="Log out" title="Log out" onClick={() => void logout()}>
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <div className="workspace-body">
        <header className="workspace-topbar">
          <Brand href={home} className="workspace-mobile-brand" />
          <div className="workspace-breadcrumb">
            <span>{label}</span>
            <ChevronRight size={14} aria-hidden="true" />
            <span>{active?.label ?? "Workspace"}</span>
          </div>
          <div className="workspace-controls">
            {headerControl}
            {profileLink && (
              <Link href="/profile" aria-label="Profile" className="workspace-avatar workspace-profile">{initials}</Link>
            )}
          </div>
        </header>
        <main id="workspace-content" tabIndex={-1} className="workspace-content">{children}</main>
      </div>

      <nav aria-label={`${label} shortcuts`} className="workspace-mobile-nav">
        {mobileLinks.map(({ href, label: title, icon: Icon }) => (
          <Link key={href} href={href} aria-current={activePath === href ? "page" : undefined}>
            <Icon size={19} aria-hidden="true" />
            <span>{title}</span>
          </Link>
        ))}
        <button type="button" aria-haspopup="dialog" onClick={() => menu.current?.showModal()}>
          <Menu size={19} aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      <dialog ref={menu} aria-labelledby="workspace-menu-title" className="workspace-menu"
        onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
        <div className="workspace-menu-sheet">
          <div className="flex items-center justify-between gap-3">
            <h2 id="workspace-menu-title" className="text-xl font-bold">Navigation</h2>
            <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={() => menu.current?.close()}>
              <X size={20} aria-hidden="true" />
            </Button>
          </div>
          <nav aria-label={label} className="workspace-navigation">{navigation(true)}</nav>
          <Button variant="outline" className="w-full justify-start" onClick={() => {
            menu.current?.close();
            void logout();
          }}>
            <LogOut size={17} aria-hidden="true" /> Log out
          </Button>
        </div>
      </dialog>
    </div>
  );
}
