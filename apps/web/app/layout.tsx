import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TenantEase Internal Shell",
  description: "Minimal backend validation UI for TenantEase"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

