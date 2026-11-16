import * as React from "react";
import { cn } from "@/lib/utils";
import { MoneyValue } from "./MoneyValue";
import { StatusBadge, StatusBadgeType } from "./StatusBadge";
import { TableCell, TableRow } from "@/components/ui/table";

interface TenantRentRowProps {
  tenantName: string;
  billingMonth: string;
  amount: number;
  outstanding: number;
  status: StatusBadgeType;
  dueDate: Date;
  actions?: React.ReactNode;
  className?: string;
}

export function TenantRentRow({ tenantName, billingMonth, amount, outstanding, status, dueDate, actions, className }: TenantRentRowProps) {
  return (
    <TableRow className={cn("hover:bg-secondary/50", className)}>
      <TableCell className="font-semibold text-foreground">{tenantName}</TableCell>
      <TableCell className="text-muted-foreground">{billingMonth}</TableCell>
      <TableCell className="text-right">
        <MoneyValue amount={amount} />
      </TableCell>
      <TableCell className="text-right"><MoneyValue amount={outstanding} /></TableCell>
      <TableCell>
        <StatusBadge status={status} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
      </TableCell>
      <TableCell className="text-right">{actions}</TableCell>
    </TableRow>
  );
}
