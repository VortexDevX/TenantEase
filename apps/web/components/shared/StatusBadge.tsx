import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Normalisation map (logic preserved exactly) ── */
const VARIANT_MAP: Record<string, string> = {};
const sets: Record<string, string[]> = {
  success: ["PAID", "ACTIVE", "OCCUPIED", "ACCEPTED", "RESOLVED", "CLOSED", "ENABLED", "NEW"],
  warning: ["PARTIAL", "NOTICE", "PENDING", "IN_PROGRESS", "OVERDUE_SOON"],
  destructive: ["OVERDUE", "EMERGENCY", "HIGH", "REVOKED", "FAILED"],
  info: ["VACANT", "AVAILABLE"],
  secondary: ["DRAFT", "VACATED", "LOW", "MEDIUM", "DISABLED"],
};
for (const [variant, keys] of Object.entries(sets)) {
  for (const key of keys) VARIANT_MAP[key] = variant;
}

export type StatusBadgeType = string;

interface StatusBadgeProps {
  status: StatusBadgeType;
  className?: string;
}

const dotColor: Record<string, string> = {
  success: "bg-emerald-400 shadow-[0_0_6px_hsl(160_84%_39%/0.6)]",
  warning: "bg-amber-400 shadow-[0_0_6px_hsl(38_92%_50%/0.6)]",
  destructive: "bg-red-400 shadow-[0_0_6px_hsl(0_72%_51%/0.6)]",
  info: "bg-primary-strong shadow-glow",
  secondary: "bg-slate-400",
};

const pillColor: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  destructive: "bg-red-500/10 text-red-400 border-red-500/20",
  info: "bg-primary/10 text-primary-strong border-primary/20",
  secondary: "bg-white/[0.04] text-slate-400 border-white/[0.06]",
};

function normalise(input: string): string {
  const upper = input.toUpperCase().replace(/ /g, "_");
  return VARIANT_MAP[upper] ?? "secondary";
}

function displayLabel(input: string): string {
  return input
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = normalise(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold tracking-wide select-none",
        pillColor[variant],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[variant])} />
      {displayLabel(status)}
    </span>
  );
}
