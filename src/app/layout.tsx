import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Kalkulator Durian FAMA',
  description: 'Sistem Kalkulator Anggaran Pengeluaran Durian - FAMA',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Durian FAMA',
  },
};

export const viewport: Viewport = {
  themeColor: '#1F4D36',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ms">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <ServiceWorkerRegister />
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1F4D36',
                color: '#fff',
                borderRadius: '10px',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
