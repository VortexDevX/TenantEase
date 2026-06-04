import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';

const poppins = Poppins({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins'
});

export const metadata: Metadata = {
  title: 'TenantEase | PG Management',
  description: 'Smart Property & Tenant Management for India',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'TenantEase',
    statusBarStyle: 'default'
  },
  icons: {
    icon: '/tenant-ease-icon.svg',
    apple: '/tenant-ease-icon.svg'
  }
};

export const viewport: Viewport = {
  themeColor: '#0f766e'
};

import { AuthProvider } from '../contexts/AuthContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} font-sans antialiased bg-background`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
