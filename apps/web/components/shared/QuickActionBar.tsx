import * as React from "react";
import { cn } from "@/lib/utils";

interface QuickActionBarProps {
  children: React.ReactNode;
  className?: string;
}

export function QuickActionBar({ children, className }: QuickActionBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary/50 p-2",
        className
      )}
    >
      {children}
    </div>
  );
}
