import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {}

function Tabs({ className, children, ...props }: TabsProps) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg bg-secondary/50 p-1",
        className
      )}
      role="group"
      aria-label="Filter by status"
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
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors cursor-pointer select-none",
        active
          ? "bg-primary/15 text-primary-strong shadow-sm border border-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export { Tabs, TabsTrigger };
