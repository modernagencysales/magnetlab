# Settings Page Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-scroll settings page with a sidebar-navigated, URL-routed settings experience across 5 section pages.

**Architecture:** Next.js App Router nested layout — `settings/layout.tsx` provides the sidebar nav, each section is a server component route (`settings/account/page.tsx`, etc.) that fetches only its own data. Existing 18 settings components are unchanged; they just move to the correct route page.

**Tech Stack:** Next.js 15 App Router, React 18, Tailwind CSS, `usePathname()` for active nav state, `redirect()` for `/settings` → `/settings/account`.

---

### Task 1: Create SettingsNav component

**Files:**
- Create: `src/components/settings/SettingsNav.tsx`

**Step 1: Create the sidebar nav component**

```tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils/index';
import {
  User,
  CreditCard,
  Users,
  Link2,
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
  Settings2,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: 'Account',
    items: [
      { href: '/settings/account', label: 'Profile', icon: User },
      { href: '/settings/account#billing', label: 'Billing', icon: CreditCard },
      { href: '/settings/account#team', label: 'Team', icon: Users },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { href: '/settings/integrations', label: 'LinkedIn', icon: Linkedin },
      { href: '/settings/integrations#email', label: 'Email Sending', icon: Mail },
      { href: '/settings/integrations#marketing', label: 'Email Marketing', icon: MailPlus },
      { href: '/settings/integrations#crm', label: 'CRM', icon: Monitor },
      { href: '/settings/integrations#delivery', label: 'LinkedIn Delivery', icon: Send },
      { href: '/settings/integrations#analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/settings/integrations#conductor', label: 'Conductor', icon: Radio },
      { href: '/settings/integrations#pixels', label: 'Tracking Pixels', icon: Target },
      { href: '/settings/integrations#webhooks', label: 'Webhooks', icon: Webhook },
    ],
  },
  {
    label: 'Signal Engine',
    items: [
      { href: '/settings/signals', label: 'ICP Config', icon: Search },
      { href: '/settings/signals#keywords', label: 'Keywords', icon: Target },
      { href: '/settings/signals#companies', label: 'Companies', icon: Building2 },
      { href: '/settings/signals#competitors', label: 'Competitors', icon: Eye },
    ],
  },
  {
    label: 'Branding',
    items: [
      { href: '/settings/branding', label: 'Brand & Theme', icon: Palette },
      { href: '/settings/branding#defaults', label: 'Page Defaults', icon: Video },
      { href: '/settings/branding#whitelabel', label: 'White Label', icon: Crown },
    ],
  },
  {
    label: 'Developer',
    items: [
      { href: '/settings/developer', label: 'API Keys', icon: Key },
      { href: '/settings/developer#webhooks', label: 'Webhooks', icon: Webhook },
      { href: '/settings/developer#docs', label: 'Documentation', icon: BookOpen },
    ],
  },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-8 space-y-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const basePath = item.href.split('#')[0];
                  const isActive = pathname === basePath;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
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

      {/* Mobile horizontal nav */}
      <nav className="lg:hidden mb-6 -mx-4 px-4 overflow-x-auto">
        <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 min-w-max">
          {NAV_SECTIONS.map((section) => {
            const firstHref = section.items[0].href.split('#')[0];
            const isActive = pathname === firstHref;
            return (
              <Link
                key={section.label}
                href={firstHref}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {section.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/settings/SettingsNav.tsx
git commit -m "feat(settings): add sidebar nav component for settings redesign"
```

---

### Task 2: Create settings layout with sidebar

**Files:**
- Create: `src/app/(dashboard)/settings/layout.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`

**Step 1: Create the shared settings layout**

```tsx
import { SettingsNav } from '@/components/settings/SettingsNav';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account and integrations</p>
      </div>

      <div className="flex gap-8">
        <SettingsNav />
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Update the root settings page to redirect**

Replace the entire contents of `src/app/(dashboard)/settings/page.tsx` with:

```tsx
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Settings | MagnetLab',
  description: 'Manage your account and integrations',
};

export default function SettingsPage() {
  redirect('/settings/account');
}
```

**Step 3: Verify the build compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build --no-lint 2>&1 | tail -20`
Expected: Build succeeds (redirects are valid)

**Step 4: Commit**

```bash
git add src/app/(dashboard)/settings/layout.tsx src/app/(dashboard)/settings/page.tsx
git commit -m "feat(settings): add shared layout with sidebar nav and redirect root to /account"
```

---

### Task 3: Create /settings/account route

**Files:**
- Create: `src/app/(dashboard)/settings/account/page.tsx`

**Step 1: Create the account page**

This page renders Profile, Subscription, and Team Members. It pulls the relevant data-fetching from the old `page.tsx` and renders only account-related components.

```tsx
import { auth } from '@/lib/auth';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import { AccountSettings } from '@/components/settings/AccountSettings';

export const metadata = {
  title: 'Account Settings | MagnetLab',
};

export default async function AccountPage() {
  const session = await auth();
  const supabase = await createSupabaseServerClient();

  // Get subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at')
    .eq('user_id', session?.user?.id)
    .single();

  // Get usage
  const monthYear = new Date().toISOString().slice(0, 7);
  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('id, user_id, month_year, lead_magnets_created, posts_scheduled, created_at, updated_at')
    .eq('user_id', session?.user?.id)
    .eq('month_year', monthYear)
    .single();

  // Get username
  const { data: userData } = await supabase
    .from('users')
    .select('username')
    .eq('id', session?.user?.id)
    .single();

  // Get brand kit summary (team-scoped)
  const adminClient = createSupabaseAdminClient();
  const scope = await getDataScope(session?.user?.id || '');
  let brandKitQuery = adminClient
    .from('brand_kits')
    .select('business_description')
  brandKitQuery = applyScope(brandKitQuery, scope);
  const { data: brandKit } = await brandKitQuery.single();

  return (
    <AccountSettings
      user={session?.user || null}
      username={userData?.username || null}
      subscription={subscription}
      usage={usage}
      brandKitDescription={brandKit?.business_description || null}
    />
  );
}
```

**Step 2: Create the AccountSettings client component**

Create `src/components/settings/AccountSettings.tsx`:

```tsx
'use client';

import Image from 'next/image';
import { User, CreditCard } from 'lucide-react';
import { PRICING_PLANS } from '@/lib/types/integrations';
import { UsernameSettings } from '@/components/settings/UsernameSettings';
import { TeamMembersSettings } from '@/components/settings/TeamMembersSettings';

interface AccountSettingsProps {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  username: string | null;
  subscription: {
    plan: string;
    status: string;
    current_period_end?: string;
  } | null;
  usage: {
    lead_magnets_created?: number;
    posts_scheduled?: number;
  } | null;
  brandKitDescription: string | null;
}

export function AccountSettings({
  user,
  username,
  subscription,
  usage,
  brandKitDescription,
}: AccountSettingsProps) {
  const currentPlan = PRICING_PLANS.find((p) => p.id === subscription?.plan) || PRICING_PLANS[0];

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <div className="rounded-lg border bg-card p-6 transition-colors">
        <div className="mb-4 flex items-center gap-3">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Profile</h2>
        </div>
        <div className="flex items-center gap-4 mb-6">
          {user?.image ? (
            <Image src={user.image} alt={user.name || ''} width={64} height={64} className="h-16 w-16 rounded-full" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-medium text-primary-foreground">
              {user?.name?.[0] || 'U'}
            </div>
          )}
          <div>
            <p className="font-medium">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Username Settings */}
        <div className="border-t pt-6">
          <UsernameSettings currentUsername={username} />
        </div>
      </div>

      {/* Subscription Section */}
      <div id="billing" className="rounded-lg border bg-card p-6 transition-colors">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Subscription</h2>
          </div>
          <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            {currentPlan.name}
          </span>
        </div>

        {/* Usage */}
        <div className="mb-6 rounded-lg bg-muted p-4">
          <p className="mb-2 text-sm font-medium">This Month&apos;s Usage</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Lead Magnets</span>
            <span className="font-medium">
              {usage?.lead_magnets_created || 0} / {currentPlan.limits.leadMagnets === 999999 ? '∞' : currentPlan.limits.leadMagnets}
            </span>
          </div>
          {currentPlan.limits.scheduling && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Posts Scheduled</span>
              <span className="font-medium">{usage?.posts_scheduled || 0}</span>
            </div>
          )}
        </div>

        {/* Beta notice */}
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
          <p className="text-sm font-medium text-primary">You have full access during the beta.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            All features are unlocked for beta testers. Use the feedback button in the bottom-right corner to report bugs or request features.
          </p>
        </div>
      </div>

      {/* Team Members Section */}
      <div id="team">
        <TeamMembersSettings />
      </div>

      {/* Brand Kit Summary */}
      {brandKitDescription && (
        <div className="rounded-lg border bg-card p-6 transition-colors">
          <h2 className="mb-4 text-lg font-semibold">Brand Kit</h2>
          <p className="text-sm text-muted-foreground">
            {brandKitDescription.slice(0, 200)}...
          </p>
          <a
            href="/create"
            className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Update Brand Kit
          </a>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build --no-lint 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add src/app/(dashboard)/settings/account/page.tsx src/components/settings/AccountSettings.tsx
git commit -m "feat(settings): add /settings/account route with profile, billing, team"
```

---

### Task 4: Create /settings/integrations route

**Files:**
- Create: `src/app/(dashboard)/settings/integrations/page.tsx`
- Create: `src/components/settings/IntegrationsSettings.tsx`

**Step 1: Create the integrations page (server component)**

```tsx
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings';

export const metadata = {
  title: 'Integrations | MagnetLab Settings',
};

export default async function IntegrationsPage() {
  const session = await auth();
  const adminClient = createSupabaseAdminClient();

  const { data: integrations } = await adminClient
    .from('user_integrations')
    .select('service, is_active, last_verified_at, metadata')
    .eq('user_id', session?.user?.id);

  return <IntegrationsSettings integrations={integrations || []} />;
}
```

**Step 2: Create the IntegrationsSettings client component**

```tsx
'use client';

import { Link2 } from 'lucide-react';
import { LinkedInSettings } from '@/components/settings/LinkedInSettings';
import { CompetitorMonitoring } from '@/components/settings/CompetitorMonitoring';
import { ResendSettings } from '@/components/settings/ResendSettings';
import { ConductorSettings } from '@/components/settings/ConductorSettings';
import { FathomSettings } from '@/components/settings/FathomSettings';
import { EmailMarketingSettings } from '@/components/settings/EmailMarketingSettings';
import { GoHighLevelSettings } from '@/components/settings/GoHighLevelSettings';
import { HeyReachSettings } from '@/components/settings/HeyReachSettings';
import { TrackingPixelSettings } from '@/components/settings/TrackingPixelSettings';
import { WebhookSettings } from '@/components/settings/WebhookSettings';

interface Integration {
  service: string;
  is_active: boolean;
  last_verified_at: string | null;
  metadata?: Record<string, unknown>;
}

interface IntegrationsSettingsProps {
  integrations: Integration[];
}

export function IntegrationsSettings({ integrations }: IntegrationsSettingsProps) {
  const resendIntegration = integrations.find((i) => i.service === 'resend');
  const conductorIntegration = integrations.find((i) => i.service === 'conductor');
  const fathomIntegration = integrations.find((i) => i.service === 'fathom');
  const unipileIntegration = integrations.find((i) => i.service === 'unipile');
  const gohighlevelIntegration = integrations.find((i) => i.service === 'gohighlevel');
  const heyreachIntegration = integrations.find((i) => i.service === 'heyreach');

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 transition-colors">
        <div className="mb-4 flex items-center gap-3">
          <Link2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Integrations</h2>
        </div>

        {/* LinkedIn (Unipile) */}
        <LinkedInSettings
          isConnected={unipileIntegration?.is_active ?? false}
          accountName={(unipileIntegration?.metadata as { unipile_account_name?: string } | undefined)?.unipile_account_name ?? null}
        />

        {/* Competitor Monitoring */}
        <CompetitorMonitoring />

        {/* Resend */}
        <div id="email" className="mt-6 pt-6 border-t">
          <ResendSettings
            isConnected={resendIntegration?.is_active ?? false}
            lastVerifiedAt={resendIntegration?.last_verified_at ?? null}
            metadata={resendIntegration?.metadata as { fromEmail?: string; fromName?: string } | undefined}
          />
        </div>

        {/* Conductor */}
        <div id="conductor" className="mt-6 pt-6 border-t">
          <ConductorSettings
            isConnected={conductorIntegration?.is_active ?? false}
            lastVerifiedAt={conductorIntegration?.last_verified_at ?? null}
            metadata={conductorIntegration?.metadata as { endpointUrl?: string } | undefined}
          />
        </div>

        {/* Fathom */}
        <div id="analytics" className="mt-6 pt-6 border-t">
          <FathomSettings
            isConnected={fathomIntegration?.is_active ?? false}
          />
        </div>

        {/* Email Marketing */}
        <div id="marketing" className="mt-6 pt-6 border-t">
          <EmailMarketingSettings integrations={integrations} />
        </div>

        {/* GoHighLevel CRM */}
        <div id="crm" className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-semibold mb-1">CRM</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Push leads to your CRM when they opt in to your funnels.
          </p>
          <GoHighLevelSettings
            isConnected={gohighlevelIntegration?.is_active ?? false}
            lastVerifiedAt={gohighlevelIntegration?.last_verified_at ?? null}
          />
        </div>

        {/* HeyReach LinkedIn Delivery */}
        <div id="delivery" className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-semibold mb-1">LinkedIn Delivery</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Deliver lead magnets to leads via LinkedIn DM campaigns.
          </p>
          <HeyReachSettings
            isConnected={heyreachIntegration?.is_active ?? false}
            lastVerifiedAt={heyreachIntegration?.last_verified_at ?? null}
          />
        </div>

        {/* Tracking Pixels */}
        <div id="pixels" className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-semibold mb-1">Tracking Pixels</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Add conversion tracking to your funnel pages. Events fire both client-side and server-side for maximum accuracy.
          </p>
          <TrackingPixelSettings integrations={integrations} />
        </div>

        {/* Webhooks */}
        <div id="webhooks" className="mt-6 pt-6 border-t">
          <WebhookSettings />
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build --no-lint 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add src/app/(dashboard)/settings/integrations/page.tsx src/components/settings/IntegrationsSettings.tsx
git commit -m "feat(settings): add /settings/integrations route"
```

---

### Task 5: Create /settings/signals route

**Files:**
- Create: `src/app/(dashboard)/settings/signals/page.tsx`

**Step 1: Create the signals page**

```tsx
import { Settings2 } from 'lucide-react';
import { SignalConfig } from '@/components/settings/SignalConfig';
import { KeywordMonitors } from '@/components/settings/KeywordMonitors';
import { CompanyMonitors } from '@/components/settings/CompanyMonitors';
import { CompetitorMonitoring } from '@/components/settings/CompetitorMonitoring';

export const metadata = {
  title: 'Signal Engine | MagnetLab Settings',
};

export default function SignalsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 transition-colors">
        <div className="mb-4 flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Signal Engine</h2>
        </div>
        <p className="mb-2 text-sm text-muted-foreground">
          Configure ICP targeting, keyword monitoring, and company page tracking for your signal engine.
        </p>

        <SignalConfig />

        <div id="keywords">
          <KeywordMonitors />
        </div>

        <div id="companies">
          <CompanyMonitors />
        </div>
      </div>

      <div id="competitors" className="rounded-lg border bg-card p-6 transition-colors">
        <CompetitorMonitoring />
      </div>
    </div>
  );
}
```

Note: CompetitorMonitoring moves from Integrations to Signals where it logically belongs (it monitors competitors for signals, not an integration connection).

**Step 2: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build --no-lint 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/signals/page.tsx
git commit -m "feat(settings): add /settings/signals route"
```

---

### Task 6: Create /settings/branding route

**Files:**
- Create: `src/app/(dashboard)/settings/branding/page.tsx`
- Create: `src/components/settings/BrandingPage.tsx`

**Step 1: Create the branding server component page**

```tsx
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import { BrandingPage } from '@/components/settings/BrandingPage';

export const metadata = {
  title: 'Branding | MagnetLab Settings',
};

export default async function BrandingRoute() {
  const session = await auth();
  const adminClient = createSupabaseAdminClient();
  const scope = await getDataScope(session?.user?.id || '');

  // Get brand kit
  let brandKitQuery = adminClient
    .from('brand_kits')
    .select('id, user_id, business_description, business_type, credibility_markers, sender_name, saved_ideation_result, ideation_generated_at, urgent_pains, templates, processes, tools, frequent_questions, results, success_example, audience_tools, preferred_tone, style_profile, logos, default_testimonial, default_steps, default_theme, default_primary_color, default_background_style, logo_url, font_family, font_url, created_at, updated_at');
  brandKitQuery = applyScope(brandKitQuery, scope);
  const { data: brandKit } = await brandKitQuery.single();

  // Get subscription for white-label gating
  const supabase = await (await import('@/lib/utils/supabase-server')).createSupabaseServerClient();
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', session?.user?.id)
    .single();

  return (
    <BrandingPage
      brandKit={brandKit}
      plan={subscription?.plan}
    />
  );
}
```

**Step 2: Create BrandingPage client component**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Palette, Video, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { BrandingSettings } from '@/components/settings/BrandingSettings';
import { FunnelTemplateSettings } from '@/components/settings/FunnelTemplateSettings';
import { WhiteLabelSettings } from '@/components/settings/WhiteLabelSettings';
import { logError } from '@/lib/utils/logger';

interface BrandingPageProps {
  brandKit: {
    logos?: Array<{ name: string; imageUrl: string }>;
    default_testimonial?: { quote: string; author?: string; role?: string; result?: string } | null;
    default_steps?: { heading?: string; steps: Array<{ title: string; description: string }> } | null;
    default_theme?: string | null;
    default_primary_color?: string | null;
    default_background_style?: string | null;
    logo_url?: string | null;
    font_family?: string | null;
    font_url?: string | null;
  } | null;
  plan: string | undefined;
}

export function BrandingPage({ brandKit, plan }: BrandingPageProps) {
  const [defaultVslUrl, setDefaultVslUrl] = useState('');
  const [defaultVslUrlLoading, setDefaultVslUrlLoading] = useState(true);
  const [savingDefaultVslUrl, setSavingDefaultVslUrl] = useState(false);
  const [defaultVslUrlSaved, setDefaultVslUrlSaved] = useState(false);
  const [defaultVslUrlError, setDefaultVslUrlError] = useState<string | null>(null);
  const [defaultFunnelTemplate, setDefaultFunnelTemplate] = useState('social_proof');

  useEffect(() => {
    const fetchUserDefaults = async () => {
      try {
        const response = await fetch('/api/user/defaults');
        if (response.ok) {
          const data = await response.json();
          setDefaultVslUrl(data.defaultVslUrl || '');
          setDefaultFunnelTemplate(data.defaultFunnelTemplate || 'social_proof');
        }
      } catch (error) {
        logError('settings/branding', error, { step: 'failed_to_fetch_user_defaults' });
      } finally {
        setDefaultVslUrlLoading(false);
      }
    };
    fetchUserDefaults();
  }, []);

  const handleSaveDefaultVslUrl = async () => {
    setSavingDefaultVslUrl(true);
    setDefaultVslUrlError(null);
    setDefaultVslUrlSaved(false);

    try {
      const response = await fetch('/api/user/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultVslUrl: defaultVslUrl.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      setDefaultVslUrlSaved(true);
      setTimeout(() => setDefaultVslUrlSaved(false), 3000);
    } catch (error) {
      setDefaultVslUrlError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSavingDefaultVslUrl(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Branding */}
      <div className="rounded-lg border bg-card p-6 transition-colors">
        <div className="mb-4 flex items-center gap-3">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Branding & Theme</h2>
        </div>
        <BrandingSettings initialData={{
          logos: brandKit?.logos,
          default_testimonial: brandKit?.default_testimonial,
          default_steps: brandKit?.default_steps,
          default_theme: brandKit?.default_theme,
          default_primary_color: brandKit?.default_primary_color,
          default_background_style: brandKit?.default_background_style,
          logo_url: brandKit?.logo_url,
          font_family: brandKit?.font_family,
          font_url: brandKit?.font_url,
        }} />
      </div>

      {/* Page Defaults */}
      <div id="defaults" className="rounded-lg border bg-card p-6 transition-colors">
        <div className="mb-4 flex items-center gap-3">
          <Video className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Page Defaults</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Set default values for new funnel pages. You can override these on individual funnels.
        </p>

        <div className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-medium">Default Thank You Page Video</p>
          <p className="mb-3 text-xs text-muted-foreground">
            This video will automatically appear on new funnel thank you pages. Supports YouTube, Vimeo, and Loom.
          </p>
          {defaultVslUrlLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={defaultVslUrl}
                  onChange={(e) => setDefaultVslUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
                <button
                  onClick={handleSaveDefaultVslUrl}
                  disabled={savingDefaultVslUrl}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {savingDefaultVslUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </button>
              </div>
              {defaultVslUrlSaved && (
                <p className="mt-2 flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Saved successfully
                </p>
              )}
              {defaultVslUrlError && (
                <p className="mt-2 flex items-center gap-2 text-sm text-red-500">
                  <XCircle className="h-4 w-4" />
                  {defaultVslUrlError}
                </p>
              )}
            </>
          )}
        </div>

        <div className="rounded-lg border p-4 mt-4">
          <FunnelTemplateSettings
            currentTemplate={defaultFunnelTemplate}
            onSaved={setDefaultFunnelTemplate}
          />
        </div>
      </div>

      {/* White Label */}
      <div id="whitelabel">
        <WhiteLabelSettings plan={plan} />
      </div>
    </div>
  );
}
```

**Step 3: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build --no-lint 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add src/app/(dashboard)/settings/branding/page.tsx src/components/settings/BrandingPage.tsx
git commit -m "feat(settings): add /settings/branding route with brand, defaults, white label"
```

---

### Task 7: Create /settings/developer route

**Files:**
- Create: `src/app/(dashboard)/settings/developer/page.tsx`
- Create: `src/components/settings/DeveloperSettings.tsx`

**Step 1: Create the developer page (server component)**

```tsx
import { DeveloperSettings } from '@/components/settings/DeveloperSettings';

export const metadata = {
  title: 'Developer | MagnetLab Settings',
};

export default function DeveloperPage() {
  return <DeveloperSettings />;
}
```

**Step 2: Create DeveloperSettings client component**

This extracts the API Keys inline code from `SettingsContent.tsx` (lines 88-551) plus webhooks and docs into its own component.

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Key, Copy, Trash2, Plus, Loader2, Check, CheckCircle, XCircle } from 'lucide-react';
import { WebhookSettings } from '@/components/settings/WebhookSettings';
import { logError } from '@/lib/utils/logger';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export function DeveloperSettings() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        const response = await fetch('/api/keys');
        if (response.ok) {
          const data = await response.json();
          setApiKeys(data.keys || []);
        }
      } catch (error) {
        logError('settings/developer', error, { step: 'failed_to_fetch_api_keys' });
      } finally {
        setApiKeysLoading(false);
      }
    };
    fetchApiKeys();
  }, []);

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    setApiKeyError(null);
    setNewlyCreatedKey(null);

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create API key');

      setNewlyCreatedKey(data.key);
      setNewKeyName('');
      setApiKeys((prev) => [
        {
          id: data.id,
          name: data.name,
          prefix: data.prefix,
          isActive: true,
          lastUsedAt: null,
          createdAt: data.createdAt,
        },
        ...prev,
      ]);
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : 'Failed to create API key');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Revoke API key "${keyName}"? This cannot be undone.`)) return;
    setLoading(`revoke-${keyId}`);
    try {
      const response = await fetch(`/api/keys/${keyId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to revoke API key');
      setApiKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, isActive: false } : k)));
    } catch (error) {
      logError('settings/developer', error, { step: 'revoke_error' });
    } finally {
      setLoading(null);
    }
  };

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* API Keys */}
      <div className="rounded-lg border bg-card p-6 transition-colors">
        <div className="mb-4 flex items-center gap-3">
          <Key className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">API Keys</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          API keys allow programmatic access to your account. Keep them secret and revoke any compromised keys immediately.
        </p>

        {/* Create new key */}
        <div className="mb-6 rounded-lg border p-4">
          <p className="mb-3 text-sm font-medium">Create New API Key</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g., Production, Development)"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              maxLength={100}
            />
            <button
              onClick={handleCreateApiKey}
              disabled={creatingKey || !newKeyName.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {creatingKey ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create
                </>
              )}
            </button>
          </div>

          {apiKeyError && (
            <p className="mt-2 flex items-center gap-2 text-sm text-red-500">
              <XCircle className="h-4 w-4" />
              {apiKeyError}
            </p>
          )}

          {newlyCreatedKey && (
            <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-green-600">
                <CheckCircle className="h-4 w-4" />
                API key created successfully
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                Copy this key now. You won&apos;t be able to see it again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-3 py-2 text-xs font-mono break-all">
                  {newlyCreatedKey}
                </code>
                <button
                  onClick={() => handleCopyKey(newlyCreatedKey)}
                  className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  {keyCopied ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Existing keys */}
        <div>
          <p className="mb-3 text-sm font-medium">Your API Keys</p>
          {apiKeysLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No API keys yet. Create one above to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    !key.isActive ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{key.name}</p>
                      {!key.isActive && (
                        <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-500">
                          Revoked
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <code className="text-xs text-muted-foreground font-mono">
                        ml_live_...{key.prefix}
                      </code>
                      <span className="text-xs text-muted-foreground">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                      </span>
                      {key.lastUsedAt && (
                        <span className="text-xs text-muted-foreground">
                          Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {key.isActive && (
                    <button
                      onClick={() => handleRevokeApiKey(key.id, key.name)}
                      disabled={loading === `revoke-${key.id}`}
                      className="ml-4 flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition-colors"
                    >
                      {loading === `revoke-${key.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Revoke
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Webhooks */}
      <div id="webhooks" className="rounded-lg border bg-card p-6 transition-colors">
        <WebhookSettings />
      </div>

      {/* API Docs */}
      <div id="docs" className="rounded-lg border bg-card p-6 transition-colors">
        <div className="mb-4 flex items-center gap-3">
          <Key className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">API & Content Pipeline Docs</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Documentation for the Content Pipeline API, webhooks, and integrations.
        </p>
        <a
          href="/docs"
          className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View Full Documentation &rarr;
        </a>
      </div>
    </div>
  );
}
```

**Step 3: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build --no-lint 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add src/app/(dashboard)/settings/developer/page.tsx src/components/settings/DeveloperSettings.tsx
git commit -m "feat(settings): add /settings/developer route with API keys, webhooks, docs"
```

---

### Task 8: Remove old SettingsContent and clean up

**Files:**
- Delete: `src/components/dashboard/SettingsContent.tsx`

**Step 1: Verify no other files import SettingsContent**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && grep -r "SettingsContent" src/ --include="*.tsx" --include="*.ts" -l`
Expected: Only `src/components/dashboard/SettingsContent.tsx` and `src/app/(dashboard)/settings/page.tsx` (which we already replaced)

**Step 2: Delete SettingsContent.tsx**

Run: `rm "/Users/timlife/Documents/claude code/magnetlab/src/components/dashboard/SettingsContent.tsx"`

**Step 3: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build --no-lint 2>&1 | tail -20`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add -u
git commit -m "refactor(settings): remove old SettingsContent.tsx monolith"
```

---

### Task 9: Update sidebar nav link to redirect properly

**Files:**
- Modify: `src/components/dashboard/DashboardNav.tsx` (if needed)

**Step 1: Verify the dashboard nav link**

The existing sidebar links to `/settings`. Since `settings/page.tsx` now redirects to `/settings/account`, this should work without changes. Verify:

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && grep -n "settings" src/components/dashboard/DashboardNav.tsx`

If the link points to `/settings`, it will redirect to `/settings/account` automatically. No change needed.

**Step 2: Manual smoke test**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run dev`

Test these URLs:
- `/settings` → should redirect to `/settings/account`
- `/settings/account` → Profile, Billing, Team
- `/settings/integrations` → All integration cards
- `/settings/signals` → ICP, monitors
- `/settings/branding` → Branding, defaults, white label
- `/settings/developer` → API keys, webhooks, docs

Verify:
- Sidebar nav highlights the correct section
- Mobile view shows horizontal pill nav
- Anchor links (#billing, #team, etc.) scroll to correct sections
- All existing functionality works (connect/disconnect, save, etc.)

**Step 3: Commit**

```bash
git commit --allow-empty -m "chore(settings): verified sidebar link and smoke tested all routes"
```

---

### Task 10: Write tests

**Files:**
- Create: `src/__tests__/components/settings/SettingsNav.test.tsx`

**Step 1: Write SettingsNav tests**

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

// Mock next/navigation
const mockPathname = jest.fn().mockReturnValue('/settings/account');
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

import { SettingsNav } from '@/components/settings/SettingsNav';

describe('SettingsNav', () => {
  it('renders all section labels', () => {
    render(<SettingsNav />);
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Signal Engine')).toBeInTheDocument();
    expect(screen.getByText('Branding')).toBeInTheDocument();
    expect(screen.getByText('Developer')).toBeInTheDocument();
  });

  it('renders nav item links', () => {
    render(<SettingsNav />);
    expect(screen.getByRole('link', { name: /Profile/i })).toHaveAttribute('href', '/settings/account');
    expect(screen.getByRole('link', { name: /LinkedIn$/i })).toHaveAttribute('href', '/settings/integrations');
    expect(screen.getByRole('link', { name: /API Keys/i })).toHaveAttribute('href', '/settings/developer');
  });

  it('highlights active section based on pathname', () => {
    mockPathname.mockReturnValue('/settings/integrations');
    render(<SettingsNav />);
    const linkedinLink = screen.getByRole('link', { name: /LinkedIn$/i });
    expect(linkedinLink.className).toContain('text-primary');
  });

  it('does not highlight inactive sections', () => {
    mockPathname.mockReturnValue('/settings/account');
    render(<SettingsNav />);
    const linkedinLink = screen.getByRole('link', { name: /LinkedIn$/i });
    expect(linkedinLink.className).toContain('text-muted-foreground');
  });
});
```

**Step 2: Run the test**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/components/settings/SettingsNav.test.tsx --no-coverage`
Expected: All 4 tests pass

**Step 3: Commit**

```bash
git add src/__tests__/components/settings/SettingsNav.test.tsx
git commit -m "test(settings): add SettingsNav component tests"
```

---

### Task 11: Update CLAUDE.md with new settings architecture

**Files:**
- Modify: `CLAUDE.md` in the magnetlab repo

**Step 1: Add settings architecture docs**

Add a new section after the "Dashboard Routes" table in CLAUDE.md:

```markdown
### Settings Routes (Sidebar Navigation)

The settings page uses a nested layout with vertical sidebar navigation and URL-based routing.

| Route | Content |
|-------|---------|
| `/settings` | Redirects to `/settings/account` |
| `/settings/account` | Profile, Username, Subscription, Team Members, Brand Kit summary |
| `/settings/integrations` | LinkedIn, Resend, Email Marketing, CRM, HeyReach, Fathom, Conductor, Tracking Pixels, Webhooks |
| `/settings/signals` | ICP Configuration, Keyword Monitors, Company Monitors, Competitor Monitoring |
| `/settings/branding` | Branding (6-card accordion), Page Defaults (video, template), White Label (Pro+) |
| `/settings/developer` | API Keys, Webhooks, Documentation |

Key files:
- `src/app/(dashboard)/settings/layout.tsx` — shared layout with `SettingsNav` sidebar
- `src/components/settings/SettingsNav.tsx` — sidebar nav (client component, uses `usePathname()`)
- `src/components/settings/AccountSettings.tsx` — account page wrapper
- `src/components/settings/IntegrationsSettings.tsx` — integrations page wrapper
- `src/components/settings/BrandingPage.tsx` — branding page wrapper
- `src/components/settings/DeveloperSettings.tsx` — developer page wrapper (extracted API keys logic)
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add settings page redesign architecture to CLAUDE.md"
```
