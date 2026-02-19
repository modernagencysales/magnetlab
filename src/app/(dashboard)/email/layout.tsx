'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const emailTabs = [
  { name: 'Flows', href: '/email/flows' },
  { name: 'Broadcasts', href: '/email/broadcasts' },
  { name: 'Subscribers', href: '/email/subscribers' },
];

export default function EmailLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Email</h1>
        <p className="mt-1 text-muted-foreground">
          Manage flows, broadcasts, and subscribers.
        </p>
      </div>

      <nav className="flex border-b border-border mb-6">
        {emailTabs.map((tab) => {
          const isActive = pathname === tab.href || pathname?.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-zinc-300 dark:hover:border-zinc-600'
              )}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
