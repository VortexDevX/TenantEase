import Link from "next/link";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ href, className }: { href?: string; className?: string }) {
  const content = (
    <>
      <span className="brand-mark" aria-hidden="true"><Building2 size={19} strokeWidth={2.2} /></span>
      <span>TenantEase</span>
    </>
  );

  return href ? (
    <Link href={href} className={cn("brand", className)}>{content}</Link>
  ) : (
    <span className={cn("brand", className)}>{content}</span>
  );
}
