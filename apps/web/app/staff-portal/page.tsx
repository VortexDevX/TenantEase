"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight, Building2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { useRequireRole } from "@/contexts/AuthContext";
import { useProperty } from "@/lib/PropertyContext";
import { StatusBadge } from "@/components/shared/StatusBadge";

function Assignments() {
  const { user } = useRequireRole("STAFF");
  const { properties, loading, setActivePropertyId } = useProperty();
  const router = useRouter();
  const assignments = (user?.staffAssignments ?? []).filter((assignment) =>
    properties.some((property) => property.id === assignment.propertyId)
  );

  return (
    <div className="grid gap-6">
      <PageHeader title="Your assignments" description="Choose the property you want to work on." />
      {loading ? <p role="status" className="py-8 text-muted-foreground">Loading assignments…</p> : assignments.length ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Assigned properties">
          {assignments.map((assignment) => {
            const property = properties.find((item) => item.id === assignment.propertyId);
            return (
              <article key={assignment.id} className="dashboard-panel flex flex-col items-start gap-3">
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="dashboard-row-icon"><Building2 size={18} aria-hidden="true" /></span>
                  <StatusBadge status={assignment.role} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{assignment.propertyName}</h2>
                  {property && <p className="mt-1 text-sm text-muted-foreground">{property.city}, {property.state}</p>}
                </div>
                <Button variant="outline" className="mt-auto w-full justify-between" onClick={() => {
                  setActivePropertyId(assignment.propertyId);
                  router.push("/");
                }}>Open workspace<ArrowUpRight size={16} aria-hidden="true" /></Button>
              </article>
            );
          })}
        </section>
      ) : <EmptyState title="No active assignments" description="Ask the property owner to check your invitation." icon={<Building2 size={23} aria-hidden="true" />} />}
    </div>
  );
}

export default function StaffPortalPage() {
  const { authorized } = useRequireRole("STAFF");
  if (!authorized) return null;

  return <DashboardLayout activePath="/staff-portal"><Assignments /></DashboardLayout>;
}
