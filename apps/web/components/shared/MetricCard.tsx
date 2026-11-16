import * as React from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({ title, value, subtitle, icon, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 break-words font-heading text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {subtitle ? (
            <p className="mt-1 text-xs font-medium text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {icon ? (
          <div className="dashboard-row-icon">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
