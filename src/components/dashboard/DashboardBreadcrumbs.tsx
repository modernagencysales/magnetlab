'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@magnetlab/magnetui';

// ─── Route segment → display label map ─────────────────

const SEGMENT_LABELS: Record<string, string> = {
  // Main nav
  magnets: 'Lead Magnets',
  pages: 'Pages',
  knowledge: 'Knowledge',
  posts: 'Posts',
  automations: 'Automations',
  leads: 'Leads',
  signals: 'Signals',
  email: 'Email',
  team: 'Team',
  create: 'Create',
  analytics: 'Analytics',
  assets: 'Assets',
  catalog: 'Catalog',
  // Support
  docs: 'Docs',
  help: 'Help',
  settings: 'Settings',
  admin: 'Admin',
  // Settings sub-routes
  account: 'Account',
  integrations: 'Integrations',
  branding: 'Branding',
  developer: 'Developer',
  copilot: 'Co-pilot',
  // Email sub-routes
  flows: 'Flows',
  broadcasts: 'Broadcasts',
  subscribers: 'Subscribers',
  // Other sub-routes
  funnel: 'Funnel',
  new: 'New',
  libraries: 'Libraries',
  external: 'External',
  prompts: 'Prompts',
  // Settings signal sub-routes
  'icp-config': 'ICP Config',
  keywords: 'Keywords',
  companies: 'Companies',
  competitors: 'Competitors',
};

// UUID pattern to detect dynamic route segments
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Also match short IDs (Supabase, etc.)
const DYNAMIC_ID_PATTERN = /^[0-9a-zA-Z_-]{10,}$/;

function isDynamicSegment(segment: string): boolean {
  return UUID_PATTERN.test(segment) || DYNAMIC_ID_PATTERN.test(segment);
}

function getSegmentLabel(segment: string): string | null {
  if (isDynamicSegment(segment)) return null; // Skip dynamic IDs
  return SEGMENT_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
}

export function DashboardBreadcrumbs() {
  const pathname = usePathname();

  // Root path — just show Home
  if (pathname === '/') {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Home</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: { label: string; href: string }[] = [];

  // Build breadcrumb entries, skipping dynamic segments
  let cumulativePath = '';
  for (const segment of segments) {
    cumulativePath += `/${segment}`;
    const label = getSegmentLabel(segment);
    if (label) {
      breadcrumbs.push({ label, href: cumulativePath });
    }
  }

  // If no breadcrumbs found (all dynamic segments), show Home
  if (breadcrumbs.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Home</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <BreadcrumbItem key={crumb.href}>
              {index > 0 && <BreadcrumbSeparator />}
              {isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
