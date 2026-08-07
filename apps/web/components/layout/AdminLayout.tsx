"use client";

import * as React from "react";
import Link from "next/link";
import { Users, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface AdminLayoutProps {
  children: React.ReactNode;
  activePath: string;
}

const adminNavItems = [
  { icon: Users, label: "Users & Roles", href: "/admin" },
  { icon: Settings, label: "System Settings", href: "/admin/settings" },
];

export function AdminLayout({ children, activePath }: AdminLayoutProps) {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-page-gradient pb-20 md:pb-0 md:pl-72 flex flex-col relative w-full">

      {/* ── Desktop Sidebar ── */}
      <aside className="fixed left-0 top-0 bottom-0 w-72 hidden md:flex flex-col gap-6 p-6 z-40 border-r border-white/[0.06] bg-card/60 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 text-white flex justify-center items-center font-bold text-xl shadow-[0_0_20px_hsl(0_72%_51%/0.3)]">
            A
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-foreground tracking-tight">TenantEase</span>
            <span className="text-[11px] text-red-400/80 font-semibold uppercase tracking-wider">Admin Portal</span>
          </div>
        </div>

        <nav aria-label="Administration" className="flex flex-col gap-0.5 mt-2 flex-1">
          {adminNavItems.map((item) => {
            const isActive = activePath === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-red-500/10 text-red-400 border-l-2 border-red-400 pl-3"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground border-l-2 border-transparent"
                }`}
              >
                <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-red-400" : "text-muted-foreground"}`} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
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
        <header className="flex md:hidden items-center justify-between py-2 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-red-500 to-rose-600 text-white flex justify-center items-center font-bold shadow-[0_0_16px_hsl(0_72%_51%/0.3)]">
              A
            </div>
            <span className="font-bold text-foreground">Admin Portal</span>
          </div>
        </header>

        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav aria-label="Administration" className="fixed bottom-0 left-0 right-0 flex md:hidden items-center justify-around p-2 pb-[calc(0.375rem+env(safe-area-inset-bottom))] z-40 px-4 bg-card/80 backdrop-blur-2xl border-t border-white/[0.06] shadow-[0_-8px_32px_rgba(0,0,0,0.3)]">
        {adminNavItems.map((item) => {
          const isActive = activePath === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-24 h-14 rounded-xl transition-all duration-200 cursor-pointer ${
                isActive
                  ? "text-red-400 font-semibold"
                  : "text-muted-foreground font-medium"
              }`}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 ${isActive ? 'bg-red-500/10' : 'bg-transparent'}`}>
                <Icon className={`w-[18px] h-[18px] transition-transform duration-200 ${isActive ? "scale-110" : ""}`} strokeWidth={isActive ? 2.4 : 1.8} />
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>
              {isActive ? <div className="w-1 h-1 rounded-full bg-red-400 shadow-[0_0_6px_hsl(0_72%_51%/0.6)]" /> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
