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
        "flex flex-wrap items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 backdrop-blur-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
