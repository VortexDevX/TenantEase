"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import type { TenantReceiptDto } from "@tenantease/types";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { useRequireRole } from "@/contexts/AuthContext";
import { useApi } from "@/lib/useApi";
import { openApiBlob } from "@/lib/api-client";
import { formatPaisa } from "@/lib/format";

function TenantReceiptsContent({ hasBooking }: { hasBooking: boolean }) {
  const receipts = useApi<TenantReceiptDto[]>(hasBooking ? "/tenant-portal/receipts" : null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function download(receipt: TenantReceiptDto) {
    setDownloadingId(receipt.id);
    setError("");
    try {
      await openApiBlob(receipt.fileUrl, `${receipt.receiptNumber}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download receipt.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader title="Receipts" description="Download a PDF for each recorded rent payment." />
      {error && <p role="alert" className="rounded-lg bg-destructive-soft p-3 text-sm text-destructive">{error}</p>}
      {receipts.error ? (
        <EmptyState title="Could not load receipts" description={receipts.error} action={<Button onClick={receipts.refetch}>Try again</Button>} />
      ) : receipts.loading ? (
        <p role="status" className="py-6 text-sm text-muted-foreground">Loading receipts…</p>
      ) : receipts.data?.length ? (
        <ul className="dashboard-panel divide-y divide-border">
          {receipts.data.map((receipt) => (
            <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="dashboard-row-icon"><FileText size={17} aria-hidden="true" /></span>
                <div>
                  <p className="font-bold">{formatPaisa(receipt.amount)} · {receipt.billingMonth}</p>
                  <p className="break-words text-sm text-muted-foreground">{receipt.receiptNumber} · {receipt.mode.replaceAll("_", " ")}</p>
                </div>
              </div>
              <Button variant="outline" disabled={downloadingId !== null} onClick={() => void download(receipt)}
                aria-label={`Download receipt ${receipt.receiptNumber}`}>
                <Download size={16} aria-hidden="true" />{downloadingId === receipt.id ? "Downloading…" : "Download PDF"}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={hasBooking ? "No receipts yet" : "No active booking"}
          description={hasBooking ? "Receipts appear after your payment is recorded." : "Your property owner can link your room to this account."}
          icon={<FileText size={23} aria-hidden="true" />} />
      )}
    </div>
  );
}

export default function TenantReceiptsPage() {
  const { authorized, user } = useRequireRole("TENANT");
  if (!authorized) return null;

  return <TenantLayout activePath="/tenant/receipts"><TenantReceiptsContent hasBooking={Boolean(user?.hasBooking)} /></TenantLayout>;
}
