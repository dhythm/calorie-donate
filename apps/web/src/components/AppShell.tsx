'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'ホーム', icon: '◎' },
  { href: '/meals/new', label: '記録', icon: '＋' },
  { href: '/history', label: 'グラフ', icon: '▥' },
  { href: '/donations', label: '寄付', icon: '♡' },
  { href: '/settings', label: '設定', icon: '⚙' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Calorie Donate ホーム">
          <Image
            src="/brand/wordmark.svg"
            alt="Calorie Donate"
            width={1008}
            height={288}
            className="brand-wordmark"
            priority
          />
        </Link>
        <nav aria-label="メイン" className="nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-link"
              aria-current={isActive(link.href) ? 'page' : undefined}
            >
              <span aria-hidden="true" className="nav-icon">
                {link.icon}
              </span>
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
