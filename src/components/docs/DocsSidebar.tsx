'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Zap, Plug, Settings, Bot, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavSection {
  title: string;
  icon: typeof BookOpen;
  items: { href: string; label: string }[];
}

const sections: NavSection[] = [
  {
    title: 'Quick Start',
    icon: Zap,
    items: [
      { href: '/docs/create-landing-page', label: 'Create Your Landing Page' },
      { href: '/docs/connect-email-list', label: 'Connect to Your Email List' },
    ],
  },
  {
    title: 'Integrations',
    icon: Plug,
    items: [
      { href: '/docs/zapier', label: 'Zapier' },
      { href: '/docs/make', label: 'Make (Integromat)' },
      { href: '/docs/n8n', label: 'n8n' },
      { href: '/docs/direct-api', label: 'Direct API / Webhook' },
    ],
  },
  {
    title: 'Advanced',
    icon: Settings,
    items: [
      { href: '/docs/customize-funnel', label: 'Customize Your Funnel' },
      { href: '/docs/email-sequences', label: 'Email Sequences' },
      { href: '/docs/tracking', label: 'Tracking & Attribution' },
      { href: '/docs/troubleshooting', label: 'Troubleshooting' },
    ],
  },
  {
    title: 'AI / MCP',
    icon: Bot,
    items: [
      { href: '/docs/mcp-setup', label: 'Create Pages with Claude' },
      { href: '/docs/mcp-tools', label: 'MCP Tool Reference' },
      { href: '/docs/mcp-workflows', label: 'Example Workflows' },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:block w-64 border-r bg-card/50 p-4 overflow-y-auto">
      <Link
        href="/docs"
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold mb-4 transition-colors',
          pathname === '/docs'
            ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
            : 'text-foreground hover:bg-muted'
        )}
      >
        <BookOpen size={16} />
        Docs Home
      </Link>

      <nav className="space-y-6">
        {sections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <div key={section.title}>
              <div className="flex items-center gap-2 px-3 mb-1">
                <SectionIcon size={14} className="text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </span>
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                          isActive
                            ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        <ChevronRight
                          size={12}
                          className={cn(
                            'shrink-0 transition-colors',
                            isActive ? 'text-violet-500' : 'text-muted-foreground/50'
                          )}
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
