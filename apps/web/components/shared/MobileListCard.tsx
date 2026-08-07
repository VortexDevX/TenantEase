import * as React from "react";
import { cn } from "@/lib/utils";

interface MobileListCardProps {
  title: string;
  meta?: React.ReactNode;
  value?: React.ReactNode;
  status?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function MobileListCard({ title, meta, value, status, children, className }: MobileListCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">{title}</p>
          {meta ? <p className="mt-0.5 text-xs font-medium text-muted-foreground">{meta}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {value}
          {status}
        </div>
      </div>
      {children ? <div className="mt-3 border-t border-white/[0.04] pt-3">{children}</div> : null}
    </div>
  );
}
