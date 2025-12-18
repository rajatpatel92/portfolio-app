import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';
import InactivityManager from '@/components/InactivityManager';


const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Ascend',
  description: 'Track your investments',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <InactivityManager />
          {children}
        </Providers>
      </body>
    </html>
  );
}
