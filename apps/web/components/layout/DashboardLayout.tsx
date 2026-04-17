"use client";

import * as React from "react";
import Link from "next/link";
import { LayoutDashboard, Users, CreditCard, Wrench, LogOut } from "lucide-react";
import { PropertyProvider, useProperty } from "@/lib/PropertyContext";

interface LayoutProps {
  children: React.ReactNode;
  activePath: string;
}

const navItems = [
  { icon: LayoutDashboard, label: "Home", href: "/" },
  { icon: Users, label: "Tenants", href: "/tenants" },
  { icon: CreditCard, label: "Payments", href: "/payments/new" },
  { icon: Wrench, label: "Maintenance", href: "/maintenance" },
];

function LayoutShell({ children, activePath }: LayoutProps) {
  const { activeProperty, loading: propLoading } = useProperty();
  const propertyName = propLoading ? "Loading..." : (activeProperty?.name ?? "No Property");

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64 flex flex-col relative w-full">
      
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border hidden md:flex flex-col gap-6 p-6 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex justify-center items-center font-bold text-xl shadow-soft">
            T
          </div>
          <span className="font-bold text-lg text-foreground tracking-tight">TenantEase</span>
        </div>

        <nav className="flex flex-col gap-2 mt-4 flex-1">
          {navItems.map((item) => {
            const isActive = activePath === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3 rounded-lg font-medium transition-all ${
                  isActive 
                    ? "bg-primary/10 text-primary-strong" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <div className="p-4 bg-secondary rounded-xl flex items-center justify-between border border-border">
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight text-foreground">{propertyName}</span>
                <span className="text-xs text-muted-foreground">{activeProperty?.type ?? ""}</span>
              </div>
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem("te_access_token");
              window.location.href = "/login";
            }}
            className="flex items-center justify-center gap-2 p-3 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors border border-transparent hover:border-destructive/20 font-medium w-full text-sm"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 animate-fade-in relative">
        <header className="flex md:hidden items-center justify-between py-2 mb-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex justify-center items-center font-bold shadow-soft">
              T
            </div>
            <span className="font-bold text-foreground">TenantEase</span>
          </div>
          <div className="text-sm font-semibold px-3 py-1.5 rounded-full bg-card border border-border text-foreground">
             {propertyName}
          </div>
        </header>

        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex md:hidden items-center justify-around p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 px-4 shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
         {navItems.map((item) => {
            const isActive = activePath === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl transition-all ${
                  isActive 
                     ? "text-primary-strong font-semibold" 
                    : "text-muted-foreground font-medium"
                }`}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${isActive ? 'bg-primary/10' : 'bg-transparent'}`}>
                  <Icon className={`w-5 h-5 ${isActive ? "scale-110" : ""}`} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </Link>
            )
          })}
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
