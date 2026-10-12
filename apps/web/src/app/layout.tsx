import type { Metadata, Viewport } from 'next';
import { AppShell } from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Calorie Donate',
  description:
    '目標を超えたカロリーを、世界の子どもたちへの寄付に変えるダイエット支援アプリ',
  applicationName: 'Calorie Donate',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/brand/favicon.ico', sizes: '16x16 32x32 48x48 64x64' },
      { url: '/brand/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/brand/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Calorie Donate',
    statusBarStyle: 'default',
  },
};
export const viewport: Viewport = { themeColor: '#f9bf13' };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
