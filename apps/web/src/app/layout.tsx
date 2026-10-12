import type { Metadata, Viewport } from 'next';
import { AppShell } from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Calorie Donate',
  description:
    '目標を超えたカロリーを、世界の子どもたちへの寄付に変えるダイエット支援アプリ',
};
export const viewport: Viewport = { themeColor: '#176b54' };

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
