"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Key,
  Lock,
  ServerCog,
  Settings,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useRequireRole } from "@/contexts/AuthContext";
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
      <div className="flex flex-col gap-5 animate-fade-in">
        <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-destructive">System settings</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">Runtime And Security</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-muted-foreground">
                Most system settings are environment-driven. This page shows what is active and which operational checks matter before deployment.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ServerCog className="h-5 w-5 text-muted-foreground" />
                Runtime Configuration
              </CardTitle>
              <CardDescription>Read-only values visible to the web app.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
              {runtimeItems.map((item) => (
                <div key={item.label} className="rounded-lg border border-border bg-secondary/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-muted-foreground" />
                Secret Handling
              </CardTitle>
              <CardDescription>Secrets stay in `.env`, not browser-editable controls.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <div className="rounded-lg border border-success/20 bg-success/10 p-4 text-success">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Lock className="h-4 w-4" />
                  Protected by server environment
                </div>
                <p className="mt-2 text-sm font-medium text-success/90">
                  Rotate secrets from the server `.env`, then restart API and invalidate old sessions.
                </p>
              </div>
              <Badge variant="outline" className="w-fit">No client-side secret editor</Badge>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                Security Checklist
              </CardTitle>
              <CardDescription>Run through these before trusting admin access.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              {checklist.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <p className="text-sm font-medium text-foreground">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-muted-foreground" />
                Verification Commands
              </CardTitle>
              <CardDescription>Run these from the repository root.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              {commands.map((command) => (
                <div key={command.label} className="rounded-lg border border-border bg-secondary/20 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{command.label}</p>
                  <code className="mt-2 block rounded-md bg-background px-3 py-2 text-xs font-semibold text-foreground">
                    {command.value}
                  </code>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <h2 className="font-bold text-destructive">Destructive actions are not exposed here.</h2>
                <p className="mt-1 text-sm font-medium text-destructive/80">
                  Database resets, audit pruning, and forced logout should be explicit backend operations with audit logs.
                </p>
              </div>
            </div>
            <Badge variant="destructive" className="w-fit gap-1">
              <Database className="h-3 w-3" />
              Manual only
            </Badge>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
