import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {}

function Tabs({ className, children, ...props }: TabsProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-secondary/50 p-1 backdrop-blur-sm",
        className
      )}
      role="tablist"
      {...props}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

function TabsTrigger({ className, active, children, ...props }: TabsTriggerProps) {
  return (
    <button
      role="tab"
      aria-selected={active}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 cursor-pointer select-none",
        active
          ? "bg-primary/15 text-primary-strong shadow-sm border border-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border border-transparent",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export { Tabs, TabsTrigger };
