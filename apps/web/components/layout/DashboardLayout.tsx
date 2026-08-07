"use client";

import * as React from "react";
import Link from "next/link";
import { LayoutDashboard, Users, CreditCard, Wrench, LogOut, Building2, BedDouble, Megaphone, Zap, BarChart3, FileText, Crown, UserCog, CircleUserRound } from "lucide-react";
import { PropertyProvider, useProperty } from "@/lib/PropertyContext";
import { useAuth } from "@/contexts/AuthContext";

interface LayoutProps {
  children: React.ReactNode;
  activePath: string;
}

const navItems = [
  { icon: LayoutDashboard, label: "Home", href: "/" },
  { icon: Building2, label: "Properties", href: "/properties", ownerOnly: true },
  { icon: BedDouble, label: "Rooms", href: "/rooms", staffRoles: ["MANAGER", "ACCOUNTANT", "WARDEN"] },
  { icon: Users, label: "Tenants", href: "/tenants", staffRoles: ["MANAGER", "ACCOUNTANT", "WARDEN"] },
  { icon: UserCog, label: "Staff", href: "/staff", ownerOnly: true },
  { icon: Megaphone, label: "Announcements", href: "/announcements", staffRoles: ["MANAGER", "ACCOUNTANT", "WARDEN"] },
  { icon: Zap, label: "Utilities", href: "/utilities", staffRoles: ["MANAGER", "ACCOUNTANT", "WARDEN"] },
  { icon: CreditCard, label: "Payments", href: "/payments", staffRoles: ["MANAGER", "ACCOUNTANT"] },
  { icon: Crown, label: "Plan", href: "/subscription", ownerOnly: true },
  { icon: FileText, label: "Agreements", href: "/agreements", staffRoles: ["MANAGER", "ACCOUNTANT", "WARDEN"] },
  { icon: BarChart3, label: "Reports", href: "/reports", staffRoles: ["ACCOUNTANT"] },
  { icon: Wrench, label: "Maintenance", href: "/maintenance", staffRoles: ["MANAGER", "WARDEN"] },
  { icon: CircleUserRound, label: "Profile", href: "/profile" },
] satisfies Array<{ icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string; href: string; ownerOnly?: boolean; staffRoles?: string[] }>;

function LayoutShell({ children, activePath }: LayoutProps) {
  const { activeProperty, properties, setActivePropertyId, loading: propLoading } = useProperty();
  const { user, logout } = useAuth();
  const propertyName = propLoading ? "Loading..." : (activeProperty?.name ?? "No Property");
  const staffRole = user?.staffAssignments?.find((assignment) => assignment.propertyId === activeProperty?.id)?.role;
  const availableNavItems = navItems.filter((item) =>
    user?.role === "OWNER" || (!item.ownerOnly && (!item.staffRoles || (staffRole && item.staffRoles.includes(staffRole))))
  );

  return (
    <div className="min-h-screen bg-page-gradient pb-20 md:pb-0 md:pl-72 flex flex-col relative w-full">
      
      {/* ── Desktop Sidebar ── */}
      <aside className="fixed left-0 top-0 bottom-0 h-screen w-72 overflow-hidden hidden md:flex flex-col gap-4 p-5 z-40 border-r border-white/[0.06] bg-card/60 backdrop-blur-2xl">
        {/* Logo */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary-strong text-primary-foreground flex justify-center items-center font-bold text-xl shadow-glow">
            T
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-foreground tracking-tight">TenantEase</span>
            <span className="text-[11px] font-medium text-muted-foreground tracking-wide">PG command center</span>
          </div>
        </div>

        {/* Property Selector */}
        <div className="flex shrink-0 flex-col gap-2">
          <label htmlFor="active-property-desktop" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Active Property</label>
          <select
            id="active-property-desktop"
            value={activeProperty?.id ?? ""}
            onChange={(event) => setActivePropertyId(event.target.value)}
            className="h-11 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-medium text-foreground outline-none transition-all duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 cursor-pointer"
            disabled={propLoading || properties.length === 0}
          >
            {properties.length === 0 ? <option value="">No properties yet</option> : null}
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation */}
        <nav aria-label="Owner operations" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-1 scrollbar-none">
          {availableNavItems.map((item) => {
            const isActive = activePath === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg font-medium transition-all duration-200 cursor-pointer ${
                  isActive 
                    ? "bg-primary/12 text-primary-strong border-l-2 border-primary-strong ml-0 pl-3"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground border-l-2 border-transparent"
                }`}
              >
                <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-primary-strong" : "text-muted-foreground"}`} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="text-sm">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto flex shrink-0 flex-col gap-3">
          <div className="p-3.5 bg-white/[0.03] rounded-lg flex items-center justify-between border border-white/[0.06]">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-foreground truncate">{propertyName}</span>
                <span className="text-[11px] text-muted-foreground">
                  {activeProperty ? `${activeProperty.type} · ${activeProperty.occupiedBeds}/${activeProperty.occupiedBeds + activeProperty.vacantBeds} beds` : ""}
                </span>
              </div>
          </div>
          <button 
            onClick={() => void logout()}
            className="flex items-center justify-center gap-2 p-3 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 border border-transparent hover:border-red-500/20 font-medium w-full text-sm cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 lg:p-10 animate-fade-in relative">
        {/* Mobile header */}
        <header className="flex md:hidden items-center justify-between py-2 mb-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary to-primary-strong text-primary-foreground flex justify-center items-center font-bold shadow-glow">
              T
            </div>
            <span className="font-bold text-foreground">TenantEase</span>
          </div>
          <div className="max-w-[44vw] truncate text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-foreground">
             {propertyName}
          </div>
        </header>

        {/* Mobile property selector */}
        <div className="md:hidden mb-5">
          <label htmlFor="active-property-mobile" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Active Property</label>
          <select
            id="active-property-mobile"
            value={activeProperty?.id ?? ""}
            onChange={(event) => setActivePropertyId(event.target.value)}
            className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-medium text-foreground outline-none transition-all duration-200 focus:border-primary/50 cursor-pointer"
            disabled={propLoading || properties.length === 0}
          >
            {properties.length === 0 ? <option value="">No properties yet</option> : null}
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>

        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav aria-label="Owner operations" className="fixed bottom-0 left-0 right-0 md:hidden z-40 bg-card/80 backdrop-blur-2xl border-t border-white/[0.06] shadow-[0_-8px_32px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none px-2 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
          {availableNavItems.map((item) => {
            const isActive = activePath === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-none flex-col items-center justify-center gap-0.5 w-[72px] h-14 rounded-lg transition-all duration-200 cursor-pointer ${
                  isActive 
                    ? "text-primary-strong font-semibold"
                    : "text-muted-foreground font-medium"
                }`}
              >
                <div className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 ${isActive ? 'bg-primary/15' : ''}`}>
                  <Icon className={`w-[18px] h-[18px] transition-transform duration-200 ${isActive ? "scale-110" : ""}`} strokeWidth={isActive ? 2.4 : 1.8} />
                </div>
                <span className="text-[10px] tracking-tight">{item.label}</span>
                {isActive ? <div className="w-1 h-1 rounded-full bg-primary-strong shadow-[0_0_8px_hsl(270_91%_72%/0.65)]" /> : null}
              </Link>
            )
          })}
        </div>
      </nav>

    </div>
  );
}

export function DashboardLayout({ children, activePath }: LayoutProps) {
  return (
    <PropertyProvider>
      <LayoutShell activePath={activePath}>
        {children}
      </LayoutShell>
    </PropertyProvider>
  );
}
