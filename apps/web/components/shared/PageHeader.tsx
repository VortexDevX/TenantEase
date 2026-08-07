import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-card/55 p-5 shadow-glass backdrop-blur-xl sm:flex-row sm:items-end sm:justify-between sm:p-7", className)}>
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-accent via-primary-strong to-transparent" />
      <div className="min-w-0">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-accent">TenantEase workspace</p>
        <h1 className="text-3xl font-bold leading-[0.98] tracking-[-0.045em] text-foreground sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-muted-foreground sm:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3 shrink-0">{actions}</div> : null}
    </header>
  );
}
