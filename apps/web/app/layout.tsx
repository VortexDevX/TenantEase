import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { PropertyProvider } from "@/lib/PropertyContext";

const heading = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-heading", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "TenantEase | Property management",
  description: "Manage rooms, tenants, rent, and maintenance for your PG or rental property.",
  icons: { icon: "/tenant-ease-icon.svg" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#f6f6ef",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className={`${body.variable} ${heading.variable} min-h-screen`}>
        <AuthProvider>
          <PropertyProvider>{children}</PropertyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
