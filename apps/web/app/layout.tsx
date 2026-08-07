import type { Metadata } from "next";
import { Lexend, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "TenantEase — PG & Rental Management",
  description:
    "Digital rent register for PG owners, hostels, and rental properties. Manage tenants, payments, rooms, and reports.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${sourceSans.variable} ${lexend.variable} bg-background text-foreground min-h-screen`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
