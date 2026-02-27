'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User,
  CreditCard,
  Users,
  Linkedin,
  Mail,
  MailPlus,
  Monitor,
  Send,
  BarChart3,
  Radio,
  Target,
  Search,
  Building2,
  Eye,
  Palette,
  Video,
  Crown,
  Key,
  Webhook,
  BookOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/index';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Account',
    items: [
      { label: 'Profile', href: '/settings/account', icon: User },
      { label: 'Billing', href: '/settings/account#billing', icon: CreditCard },
      { label: 'Team', href: '/settings/account#team', icon: Users },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { label: 'LinkedIn', href: '/settings/integrations', icon: Linkedin },
      { label: 'Email Sending', href: '/settings/integrations#email', icon: Mail },
      { label: 'Email Marketing', href: '/settings/integrations#marketing', icon: MailPlus },
      { label: 'CRM', href: '/settings/integrations#crm', icon: Monitor },
      { label: 'LinkedIn Delivery', href: '/settings/integrations#delivery', icon: Send },
      { label: 'Analytics', href: '/settings/integrations#analytics', icon: BarChart3 },
      { label: 'Conductor', href: '/settings/integrations#conductor', icon: Radio },
      { label: 'Tracking Pixels', href: '/settings/integrations#pixels', icon: Target },
      { label: 'Webhooks', href: '/settings/integrations#webhooks', icon: Webhook },
    ],
  },
  {
    title: 'Signal Engine',
    items: [
      { label: 'ICP Config', href: '/settings/signals', icon: Search },
      { label: 'Keywords', href: '/settings/signals#keywords', icon: Target },
      { label: 'Companies', href: '/settings/signals#companies', icon: Building2 },
      { label: 'Competitors', href: '/settings/signals#competitors', icon: Eye },
    ],
  },
  {
    title: 'Branding',
    items: [
      { label: 'Brand & Theme', href: '/settings/branding', icon: Palette },
      { label: 'Page Defaults', href: '/settings/branding#defaults', icon: Video },
      { label: 'White Label', href: '/settings/branding#whitelabel', icon: Crown },
    ],
  },
  {
    title: 'Developer',
    items: [
      { label: 'API Keys', href: '/settings/developer', icon: Key },
      { label: 'Webhooks', href: '/settings/developer#webhooks', icon: Webhook },
      { label: 'Documentation', href: '/settings/developer#docs', icon: BookOpen },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  const basePath = href.split('#')[0];
  return pathname === basePath;
}

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-24 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h3>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                          active
                            ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Mobile horizontal pill bar */}
      <nav className="lg:hidden overflow-x-auto border-b mb-6">
        <div className="flex gap-1 px-2 py-2">
          {NAV_GROUPS.map((group) => {
            const groupBasePath = group.items[0].href.split('#')[0];
            const active = pathname === groupBasePath;
            return (
              <Link
                key={group.title}
                href={group.items[0].href}
                className={cn(
                  'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {group.title}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
