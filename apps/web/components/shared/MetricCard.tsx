import * as React from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MetricCard({ title, value, subtitle, icon, onClick, className }: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-card/72 backdrop-blur-xl p-5 transition-[border-color,box-shadow,background-color] duration-200",
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-strong/50 before:to-transparent hover:border-primary-strong/25 hover:bg-card/85 hover:shadow-glass",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground">{value}</p>
          {subtitle ? (
            <p className="text-xs font-medium text-muted-foreground/70 mt-1 truncate">{subtitle}</p>
          ) : null}
        </div>
        {icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary-strong/15 bg-primary/12 text-primary-strong transition-colors group-hover:bg-primary/20">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
