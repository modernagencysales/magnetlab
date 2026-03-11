import Link from 'next/link';
import { Zap, Plug, Settings, Bot } from 'lucide-react';
import type { Metadata } from 'next';
import { PageContainer, PageTitle, Card, CardContent, IconWrapper } from '@magnetlab/magnetui';

export const metadata: Metadata = {
  title: 'Docs | MagnetLab',
  description:
    'Guides and documentation for building lead magnets, connecting integrations, and using AI tools with MagnetLab.',
};

const categories = [
  {
    title: 'Quick Start',
    description: 'Create your first landing page and start capturing leads in minutes.',
    href: '/docs/create-landing-page',
    icon: Zap,
    variant: 'success' as const,
  },
  {
    title: 'Connect Your Email List',
    description: 'Pipe new leads into Mailchimp, ConvertKit, ActiveCampaign, or any ESP.',
    href: '/docs/connect-email-list',
    icon: Plug,
    variant: 'info' as const,
  },
  {
    title: 'Advanced Setup',
    description: 'Customize your funnel, set up email sequences, and add tracking.',
    href: '/docs/customize-funnel',
    icon: Settings,
    variant: 'warning' as const,
  },
  {
    title: 'Create Pages with Claude',
    description: 'Use the MagnetLab MCP server to build landing pages from your AI assistant.',
    href: '/docs/mcp-setup',
    icon: Bot,
    variant: 'primary' as const,
  },
];

export default function DocsHubPage() {
  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
      <PageTitle
        title="Documentation"
        description="Everything you need to build high-converting lead magnets with MagnetLab."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link key={cat.href} href={cat.href} className="group">
              <Card className="h-full border-border transition-colors hover:border-primary/50">
                <CardContent className="p-5">
                  <IconWrapper variant={cat.variant} size="md">
                    <Icon />
                  </IconWrapper>
                  <h2 className="text-sm font-semibold mt-3">{cat.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      </div>
    </PageContainer>
  );
}
