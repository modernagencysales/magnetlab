'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PageContainer, PageTitle } from '@magnetlab/magnetui';
import { cn } from '@/lib/utils';

const emailTabs = [
  { name: 'Flows', href: '/email/flows' },
  { name: 'Broadcasts', href: '/email/broadcasts' },
  { name: 'Subscribers', href: '/email/subscribers' },
];

export default function EmailLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <PageContainer maxWidth="xl">
      <PageTitle title="Email" description="Manage flows, broadcasts, and subscribers." />

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
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>

      {children}
    </PageContainer>
  );
}
