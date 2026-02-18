import Link from 'next/link';
import { Zap, Plug, Settings, Bot } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Docs | MagnetLab',
  description: 'Guides and documentation for building lead magnets, connecting integrations, and using AI tools with MagnetLab.',
};

const categories = [
  {
    title: 'Quick Start',
    description: 'Create your first landing page and start capturing leads in minutes.',
    href: '/docs/create-landing-page',
    icon: Zap,
    color: 'text-emerald-500',
  },
  {
    title: 'Connect Your Email List',
    description: 'Pipe new leads into Mailchimp, ConvertKit, ActiveCampaign, or any ESP.',
    href: '/docs/connect-email-list',
    icon: Plug,
    color: 'text-blue-500',
  },
  {
    title: 'Advanced Setup',
    description: 'Customize your funnel, set up email sequences, and add tracking.',
    href: '/docs/customize-funnel',
    icon: Settings,
    color: 'text-orange-500',
  },
  {
    title: 'Create Pages with Claude',
    description: 'Use the MagnetLab MCP server to build landing pages from your AI assistant.',
    href: '/docs/mcp-setup',
    icon: Bot,
    color: 'text-violet-500',
  },
];

export default function DocsHubPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Documentation</h1>
      <p className="text-muted-foreground mb-8">
        Everything you need to build high-converting lead magnets with MagnetLab.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link
              key={cat.href}
              href={cat.href}
              className="rounded-lg border bg-card p-5 transition-colors hover:border-violet-500/50 hover:bg-violet-500/5"
            >
              <Icon size={24} className={cat.color} />
              <h2 className="text-lg font-semibold mt-3">{cat.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{cat.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
