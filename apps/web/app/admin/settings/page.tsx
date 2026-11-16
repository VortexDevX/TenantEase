"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Key,
  Lock,
  ServerCog,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const runtimeItems = [
  { label: "API base URL", value: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000" },
  { label: "Auth mode", value: "JWT access + refresh token" },
  { label: "OTP mode", value: "Mock OTP in local development" },
  { label: "Storage", value: "Local storage directory for receipts/documents" },
];

const checklist = [
  "JWT_ACCESS_SECRET is configured in root .env",
  "JWT_REFRESH_SECRET is configured in root .env",
  "OTP_PEPPER is configured in root .env",
  "ADMIN_PHONES contains only trusted admin phone numbers",
  "PostgreSQL migrations are applied before running API tests",
];

const commands = [
  { label: "Typecheck", value: "corepack pnpm -r typecheck" },
  { label: "API tests", value: "corepack pnpm --filter @tenantease/api test" },
  { label: "Build", value: "corepack pnpm -r build" },
  { label: "DB editor", value: "corepack pnpm db:studio" },
  { label: "Audit", value: "corepack pnpm audit --prod" },
];

export default function AdminSettingsPage() {
  const { authorized } = useRequireRole("ADMIN");

  if (!authorized) return null;

  return (
    <AdminLayout activePath="/admin/settings">
      <div className="flex flex-col gap-5 animate-fade-in pb-10">
        <PageHeader title="System settings" description="Review runtime configuration and server-managed security settings." />

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-border bg-secondary/50 shadow-glass">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <ServerCog className="h-5 w-5 text-destructive/80" />
                Runtime Configuration
              </CardTitle>
              <CardDescription>Read-only values visible to the web app.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
              {runtimeItems.map((item) => (
                <div key={item.label} className="rounded-lg border border-border bg-secondary/50 p-4 hover:bg-secondary/50 transition-colors">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground truncate">{item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border bg-secondary/50 shadow-glass">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Key className="h-5 w-5 text-destructive/80" />
                Secret Handling
              </CardTitle>
              <CardDescription>Secrets stay in `.env`, not browser-editable controls.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="rounded-lg border border-success/20 bg-success-soft/10 p-4 text-success shadow-glass-success">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Lock className="h-4 w-4" />
                  Protected by server environment
                </div>
                <p className="mt-2 text-xs font-semibold text-success/90">
                  Rotate secrets from the server `.env`, then restart API and invalidate old sessions.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-border bg-secondary/50 text-muted-foreground">No client-side secret editor</Badge>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border bg-secondary/50 shadow-glass">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                Security Checklist
              </CardTitle>
              <CardDescription>Run through these before trusting admin access.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-6">
              {checklist.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-3 hover:bg-secondary/50 transition-colors">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <p className="text-sm font-semibold text-foreground leading-normal">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border bg-secondary/50 shadow-glass">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Terminal className="h-5 w-5 text-destructive/80" />
                Verification Commands
              </CardTitle>
              <CardDescription>Run these from the repository root.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-6">
              {commands.map((command) => (
                <div key={command.label} className="rounded-lg border border-border bg-secondary/50 p-3 hover:bg-secondary/50 transition-colors">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{command.label}</p>
                  <code className="mt-2 block rounded-md bg-secondary/50 border border-border px-3 py-2 text-xs font-mono font-bold text-foreground overflow-x-auto whitespace-pre">
                    {command.value}
                  </code>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card className="border-destructive/20 bg-destructive/[0.02] shadow-glass-rose">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <h2 className="font-bold text-destructive">Destructive actions are not exposed here.</h2>
                <p className="mt-1 text-sm font-semibold text-destructive/80">
                  Database resets, audit pruning, and forced logout should be explicit backend operations with audit logs.
                </p>
              </div>
            </div>
            <Badge variant="destructive" className="w-fit gap-1 bg-destructive/20 text-destructive border border-destructive/35">
              <Database className="h-3 w-3" />
              Manual only
            </Badge>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
