import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Calorie Donate | Development',
  description: 'Shared API connection check',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
