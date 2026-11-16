import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { PwaRegister } from '@/components/ui/PwaRegister';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#991b1b',
};

export const metadata: Metadata = {
  title: 'EUROALIMENTOS SRL - POS y Preventa',
  description:
    'Sistema de Preventa Móvil, Pesaje en Despacho y Control de Producción',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'EuroPOS',
  },
  icons: {
    icon: '/icons/icon-192.svg',
    apple: '/icons/icon-192.svg',
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
