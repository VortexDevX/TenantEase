import * as React from "react";
import { cn } from "@/lib/utils";
import { MoneyValue } from "./MoneyValue";
import { StatusBadge, StatusBadgeType } from "./StatusBadge";
import { TableCell, TableRow } from "@/components/ui/table";

interface TenantRentRowProps {
  tenantName: string;
  roomName: string;
  amount: number;
  status: StatusBadgeType;
  dueDate: Date;
  actions?: React.ReactNode;
  className?: string;
}

export function TenantRentRow({ tenantName, roomName, amount, status, dueDate, actions, className }: TenantRentRowProps) {
  return (
    <TableRow className={cn("hover:bg-white/[0.03]", className)}>
      <TableCell className="font-semibold text-foreground">{tenantName}</TableCell>
      <TableCell className="text-muted-foreground">{roomName}</TableCell>
      <TableCell className="text-right">
        <MoneyValue amount={amount} />
      </TableCell>
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
