import * as React from "react";
import { cn } from "@/lib/utils";

interface MoneyValueProps {
  amount: number;
  className?: string;
  muted?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Display paisa amount as formatted rupees.
 * The conversion logic (÷ 100) is NOT modified.
 */
export function MoneyValue({ amount, className, muted, size = "md" }: MoneyValueProps) {
  const rupees = (amount / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
  };

  return (
    <span
      className={cn(
        "font-semibold tabular-nums tracking-tight",
        sizeClasses[size],
        muted ? "text-muted-foreground" : "text-foreground",
        className
      )}
    >
      ₹{rupees}
    </span>
  );
}
