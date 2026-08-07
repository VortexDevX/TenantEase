import * as React from "react";
import { cn } from "@/lib/utils";
import { MoneyValue } from "./MoneyValue";

interface StripItem {
  id: string;
  label: string;
  value: React.ReactNode;
  isMoney?: boolean;
  color?: "success" | "warning" | "destructive" | "info" | "default";
}

interface RentLedgerStripProps {
  monthLabel?: string;
  items: StripItem[];
  className?: string;
}

const colorMap: Record<string, string> = {
  success:     "text-emerald-400",
  warning:     "text-amber-400",
  destructive: "text-red-400",
  info:        "text-primary-strong",
  default:     "text-foreground",
};

export function RentLedgerStrip({ monthLabel, items, className }: RentLedgerStripProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {monthLabel ? (
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{monthLabel}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => {
          const textColor = colorMap[item.color ?? "default"];
          return (
            <div
              key={item.id}
              className="flex flex-col gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {item.label}
              </span>
              <span className={cn("text-lg font-bold tracking-tight", textColor)}>
                {item.isMoney ? <MoneyValue amount={item.value as number} /> : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
