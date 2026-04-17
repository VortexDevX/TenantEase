"use client";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Save, Database, ShieldAlert, Key } from "lucide-react";

export default function AdminSettingsPage() {
  const { authorized } = useRequireRole("ADMIN");
  
  if (!authorized) return null;

  return (
    <AdminLayout activePath="/admin/settings">
      <div className="flex flex-col gap-6 animate-fade-in">
        <section className="bg-destructive/5 border border-destructive/20 p-6 rounded-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Settings className="w-8 h-8 text-destructive" /> System Settings
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            Global configuration and security parameters.
          </p>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          {/* General Settings */}
          <Card className="shadow-float border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5 text-muted-foreground"/> General Configuration</CardTitle>
              <CardDescription>Adjust basic system behaviors.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">OTP Expiry Time (Minutes)</label>
                <Input type="number" defaultValue={10} className="max-w-[200px]" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Max Login Attempts</label>
                <Input type="number" defaultValue={5} className="max-w-[200px]" />
              </div>
              <Button className="w-fit gap-2 mt-2"><Save className="w-4 h-4" /> Save Changes</Button>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card className="shadow-float border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Key className="w-5 h-5 text-muted-foreground"/> Security</CardTitle>
              <CardDescription>Manage keys and sensitive tokens.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">JWT Refresh Expiry (Days)</label>
                <Input type="number" defaultValue={7} className="max-w-[200px]" />
              </div>
              <Button className="w-fit gap-2 mt-2" variant="outline"><Key className="w-4 h-4" /> Rotate Application Secrets</Button>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="shadow-float border-destructive/50 bg-destructive/5 md:col-span-2 mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="w-5 h-5"/> Danger Zone</CardTitle>
              <CardDescription>Destructive administrative actions.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-4">
              <Button variant="destructive" className="gap-2"><Database className="w-4 h-4" /> Clear Audit Logs (Older than 30 Days)</Button>
              <Button variant="outline" className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-white transition-colors">Force Logout All Users</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
