# Custom Domains & White-Label Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable teams to serve their pages on a custom subdomain and fully white-label the experience (hide branding, custom favicon, custom site name, custom email sender name).

**Architecture:** New `team_domains` table for domain config, white-label columns on `teams` table. Middleware intercepts custom domain requests via Host header lookup (LRU-cached) and rewrites to existing `/p/[username]/[slug]` routes. Vercel Domains API handles provisioning and SSL. Public page components conditionally render branding based on team config.

**Tech Stack:** Next.js 15 middleware, Supabase PostgreSQL, Vercel Domains API, React server components

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260219000000_team_domains_whitelabel.sql`

**Step 1: Write the migration**

```sql
-- Team-level custom domains and white-label configuration

-- 1. Create team_domains table
CREATE TABLE IF NOT EXISTS team_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  vercel_domain_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending_dns',
  dns_config JSONB,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_team_domains_team_id UNIQUE (team_id),
  CONSTRAINT uq_team_domains_domain UNIQUE (domain)
);

-- Status check constraint
ALTER TABLE team_domains ADD CONSTRAINT chk_team_domains_status
  CHECK (status IN ('pending_dns', 'verified', 'active', 'error'));

-- Index for middleware lookup by domain (hot path)
CREATE INDEX idx_team_domains_domain ON team_domains(domain);

-- 2. Add white-label columns to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS hide_branding BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS custom_favicon_url TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS custom_site_name TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS custom_email_sender_name TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS whitelabel_enabled BOOLEAN NOT NULL DEFAULT false;

-- 3. RLS policies for team_domains
ALTER TABLE team_domains ENABLE ROW LEVEL SECURITY;

-- Public read for domain + status (middleware lookup without auth)
CREATE POLICY "team_domains_public_read" ON team_domains
  FOR SELECT USING (true);

-- Owner can insert/update/delete
CREATE POLICY "team_domains_owner_crud" ON team_domains
  FOR ALL USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  );

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION update_team_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_team_domains_updated_at
  BEFORE UPDATE ON team_domains
  FOR EACH ROW
  EXECUTE FUNCTION update_team_domains_updated_at();
```

**Step 2: Apply migration locally**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx supabase db push`
Expected: Migration applies successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260219000000_team_domains_whitelabel.sql
git commit -m "feat: add team_domains table and white-label columns on teams"
```

---

### Task 2: Domain Lookup Utility

**Files:**
- Create: `src/lib/utils/domain-lookup.ts`

**Step 1: Write the domain lookup with LRU cache**

```typescript
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

interface DomainEntry {
  teamId: string;
  username: string;
  status: string;
  timestamp: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const MAX_CACHE_SIZE = 500;
const cache = new Map<string, DomainEntry>();

function evictStale() {
  if (cache.size <= MAX_CACHE_SIZE) return;
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
  // If still over limit, delete oldest entries
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < entries.length - MAX_CACHE_SIZE; i++) {
      cache.delete(entries[i][0]);
    }
  }
}

export async function lookupCustomDomain(
  hostname: string
): Promise<{ teamId: string; username: string } | null> {
  // Check cache
  const cached = cache.get(hostname);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (cached.status !== 'active') return null;
    return { teamId: cached.teamId, username: cached.username };
  }

  // DB lookup
  const supabase = createSupabaseAdminClient();
  const { data: domainRow } = await supabase
    .from('team_domains')
    .select('team_id, status')
    .eq('domain', hostname)
    .single();

  if (!domainRow) {
    // Cache negative result to avoid repeated DB hits
    cache.set(hostname, { teamId: '', username: '', status: 'not_found', timestamp: Date.now() });
    evictStale();
    return null;
  }

  // Get team owner's username
  const { data: team } = await supabase
    .from('teams')
    .select('owner_id')
    .eq('id', domainRow.team_id)
    .single();

  if (!team) return null;

  const { data: user } = await supabase
    .from('users')
    .select('username')
    .eq('id', team.owner_id)
    .single();

  if (!user?.username) return null;

  const entry: DomainEntry = {
    teamId: domainRow.team_id,
    username: user.username,
    status: domainRow.status,
    timestamp: Date.now(),
  };
  cache.set(hostname, entry);
  evictStale();

  if (domainRow.status !== 'active') return null;
  return { teamId: entry.teamId, username: entry.username };
}

/** Call this when domain settings change to bust the cache */
export function invalidateDomainCache(hostname: string) {
  cache.delete(hostname);
}
```

**Step 2: Commit**

```bash
git add src/lib/utils/domain-lookup.ts
git commit -m "feat: add domain lookup utility with LRU cache for middleware"
```

---

### Task 3: Middleware Custom Domain Routing

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Update middleware to handle custom domains**

Replace the entire `src/middleware.ts` with:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { lookupCustomDomain } from '@/lib/utils/domain-lookup';

// Known app hostnames (not custom domains)
const APP_HOSTNAMES = new Set([
  'magnetlab.app',
  'www.magnetlab.app',
  'localhost',
  'localhost:3000',
]);

function isAppHostname(hostname: string): boolean {
  if (APP_HOSTNAMES.has(hostname)) return true;
  // Vercel preview deploys
  if (hostname.endsWith('.vercel.app')) return true;
  return false;
}

// Routes that require authentication
const protectedRoutes = [
  '/create', '/magnets', '/pages', '/knowledge', '/posts',
  '/leads', '/settings', '/automations',
  // Legacy routes (redirects handled in route files)
  '/library', '/content', '/assets', '/analytics',
  '/swipe-file', '/docs',
  '/catalog', '/team-select', '/team',
];

// Routes that should redirect to dashboard if authenticated
const authRoutes = ['/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host')?.replace(/:\d+$/, '') || '';

  // --- Custom domain routing ---
  if (!isAppHostname(hostname)) {
    const domainInfo = await lookupCustomDomain(hostname);
    if (!domainInfo) {
      return new NextResponse('Not Found', { status: 404 });
    }

    // Rewrite: clientdomain.com/my-funnel → /p/username/my-funnel
    const slug = pathname.replace(/^\//, ''); // strip leading slash
    if (!slug) {
      // Root path — no landing page for now
      return new NextResponse('Not Found', { status: 404 });
    }

    const url = request.nextUrl.clone();
    url.pathname = `/p/${domainInfo.username}/${slug}`;

    const response = NextResponse.rewrite(url);
    response.headers.set('x-custom-domain', 'true');
    response.headers.set('x-team-id', domainInfo.teamId);
    return response;
  }

  // --- Normal app routing ---
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value;

  const isAuthenticated = !!sessionToken;

  if (isAuthenticated && authRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!isAuthenticated && pathname === '/') {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  if (!isAuthenticated && protectedRoutes.some((route) => pathname.startsWith(route))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};
```

**Step 2: Verify dev server starts and existing routes still work**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add custom domain routing in middleware via Host header lookup"
```

---

### Task 4: White-Label Data Fetching in Public Pages

**Files:**
- Modify: `src/app/p/[username]/[slug]/page.tsx`
- Modify: `src/app/p/[username]/[slug]/thankyou/page.tsx`
- Modify: `src/app/p/[username]/[slug]/content/page.tsx`

**Step 1: Create a shared white-label fetch helper**

Create `src/lib/utils/whitelabel.ts`:

```typescript
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export interface WhitelabelConfig {
  hideBranding: boolean;
  customFaviconUrl: string | null;
  customSiteName: string | null;
}

export async function getWhitelabelConfig(teamId: string | null): Promise<WhitelabelConfig | null> {
  if (!teamId) return null;

  const supabase = createSupabaseAdminClient();
  const { data: team } = await supabase
    .from('teams')
    .select('whitelabel_enabled, hide_branding, custom_favicon_url, custom_site_name')
    .eq('id', teamId)
    .single();

  if (!team || !team.whitelabel_enabled) return null;

  return {
    hideBranding: team.hide_branding || false,
    customFaviconUrl: team.custom_favicon_url || null,
    customSiteName: team.custom_site_name || null,
  };
}
```

**Step 2: Update opt-in page (`src/app/p/[username]/[slug]/page.tsx`)**

After the funnel query, add white-label fetch and pass to props. Add `team_id` to the funnel select. After fetching funnel data:

```typescript
import { getWhitelabelConfig } from '@/lib/utils/whitelabel';

// ... existing funnel fetch, add team_id to select ...

const whitelabel = await getWhitelabelConfig(funnel.team_id);

// In generateMetadata, use whitelabel?.customSiteName for title suffix
// In component return, add:
//   hideBranding={whitelabel?.hideBranding || false}
```

Update `generateMetadata` to use `customSiteName`:
```typescript
// Replace title line in generateMetadata:
const siteName = whitelabel?.customSiteName || 'MagnetLab';
title: leadMagnet?.title ? `${leadMagnet.title} | ${siteName}` : siteName,
```

Add favicon to metadata when set:
```typescript
...(whitelabel?.customFaviconUrl ? { icons: { icon: whitelabel.customFaviconUrl } } : {}),
```

**Step 3: Update thank-you page (`src/app/p/[username]/[slug]/thankyou/page.tsx`)**

Same pattern — add `team_id` to funnel select, fetch whitelabel config, pass `hideBranding` prop, update metadata.

**Step 4: Update content page (`src/app/p/[username]/[slug]/content/page.tsx`)**

Same pattern — add `team_id` to funnel select, fetch whitelabel config, pass `hideBranding` prop, update metadata.

**Step 5: Commit**

```bash
git add src/lib/utils/whitelabel.ts src/app/p/\[username\]/\[slug\]/page.tsx src/app/p/\[username\]/\[slug\]/thankyou/page.tsx src/app/p/\[username\]/\[slug\]/content/page.tsx
git commit -m "feat: fetch white-label config in public pages, pass to components"
```

---

### Task 5: Conditional Branding in Components

**Files:**
- Modify: `src/components/funnel/public/OptinPage.tsx` (props interface ~line 13, footer ~line 230)
- Modify: `src/components/funnel/public/ThankyouPage.tsx` (props interface ~line 27, footer ~line 527)
- Modify: `src/components/content/ContentFooter.tsx` (props interface ~line 3, footer ~line 10)
- Modify: `src/components/content/ContentPageClient.tsx` (props interface ~line 23, pass to ContentFooter)

**Step 1: Update OptinPage**

Add to `OptinPageProps` interface:
```typescript
hideBranding?: boolean;
```

Replace the "Powered by" section (lines 230-241):
```typescript
      {/* Powered by */}
      {!hideBranding && (
        <div className="mt-12">
          <a
            href="https://magnetlab.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs transition-colors hover:opacity-80"
            style={{ color: 'var(--ds-placeholder)' }}
          >
            Powered by MagnetLab
          </a>
        </div>
      )}
```

**Step 2: Update ThankyouPage**

Add to `ThankyouPageProps` interface:
```typescript
hideBranding?: boolean;
```

Replace the "Powered by" section (lines 527-538) with same conditional pattern.

**Step 3: Update ContentFooter**

Update props interface:
```typescript
interface ContentFooterProps {
  isDark: boolean;
  hideBranding?: boolean;
}
```

Wrap the entire footer JSX:
```typescript
export function ContentFooter({ isDark, hideBranding }: ContentFooterProps) {
  if (hideBranding) return null;
  // ... existing footer code
}
```

**Step 4: Update ContentPageClient**

Add to `ContentPageClientProps`:
```typescript
hideBranding?: boolean;
```

Pass to ContentFooter where it's rendered:
```typescript
<ContentFooter isDark={isDark} hideBranding={hideBranding} />
```

**Step 5: Commit**

```bash
git add src/components/funnel/public/OptinPage.tsx src/components/funnel/public/ThankyouPage.tsx src/components/content/ContentFooter.tsx src/components/content/ContentPageClient.tsx
git commit -m "feat: conditionally render 'Powered by' badge based on white-label config"
```

---

### Task 6: Vercel Domains API Integration

**Files:**
- Create: `src/lib/integrations/vercel-domains.ts`

**Step 1: Write the Vercel domains client**

```typescript
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID; // optional, for team accounts

function vercelHeaders() {
  return {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function teamParam(): string {
  return VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
}

export interface VercelDomainResponse {
  name: string;
  verified: boolean;
  verification?: Array<{ type: string; domain: string; value: string; reason: string }>;
  error?: { code: string; message: string };
}

/** Add a custom domain to the Vercel project */
export async function addDomain(domain: string): Promise<VercelDomainResponse> {
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains${teamParam()}`,
    {
      method: 'POST',
      headers: vercelHeaders(),
      body: JSON.stringify({ name: domain }),
    }
  );
  return res.json();
}

/** Check domain verification and SSL status */
export async function checkDomain(domain: string): Promise<VercelDomainResponse> {
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains/${domain}${teamParam()}`,
    {
      method: 'GET',
      headers: vercelHeaders(),
    }
  );
  return res.json();
}

/** Remove a custom domain from the Vercel project */
export async function removeDomain(domain: string): Promise<{ success: boolean }> {
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains/${domain}${teamParam()}`,
    {
      method: 'DELETE',
      headers: vercelHeaders(),
    }
  );
  if (res.status === 200 || res.status === 204) return { success: true };
  return { success: false };
}

/** Get domain configuration info for DNS instructions */
export async function getDomainConfig(domain: string): Promise<{
  cnames: Array<{ name: string; value: string }>;
  aRecords: Array<{ value: string }>;
} | null> {
  const res = await fetch(
    `https://api.vercel.com/v6/domains/${domain}/config${teamParam()}`,
    {
      method: 'GET',
      headers: vercelHeaders(),
    }
  );
  if (!res.ok) return null;
  return res.json();
}
```

**Step 2: Commit**

```bash
git add src/lib/integrations/vercel-domains.ts
git commit -m "feat: add Vercel Domains API client for custom domain provisioning"
```

---

### Task 7: Team Domain API Routes

**Files:**
- Create: `src/app/api/settings/team-domain/route.ts`
- Create: `src/app/api/settings/team-domain/verify/route.ts`

**Step 1: Write the main team-domain route**

`src/app/api/settings/team-domain/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUserPlan } from '@/lib/auth/plan-limits';
import { addDomain, removeDomain } from '@/lib/integrations/vercel-domains';
import { invalidateDomainCache } from '@/lib/utils/domain-lookup';

function isValidDomain(domain: string): boolean {
  const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain) && domain.length <= 253;
}

// GET — get team's current domain
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', session.user.id)
    .limit(1)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'No team found' }, { status: 404 });
  }

  const { data: domain } = await supabase
    .from('team_domains')
    .select('id, domain, status, dns_config, last_checked_at, created_at')
    .eq('team_id', team.id)
    .single();

  return NextResponse.json({ domain: domain || null });
}

// POST — set custom domain
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Plan check
  const plan = await getUserPlan(session.user.id);
  if (plan === 'free') {
    return NextResponse.json({
      error: 'Custom domains require a Pro or Unlimited plan',
      upgrade: '/settings#billing',
    }, { status: 403 });
  }

  const body = await request.json();
  const domain = body.domain?.trim()?.toLowerCase();

  if (!domain || !isValidDomain(domain)) {
    return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Get team
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', session.user.id)
    .limit(1)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'No team found' }, { status: 404 });
  }

  // Check uniqueness
  const { data: existing } = await supabase
    .from('team_domains')
    .select('id, team_id')
    .eq('domain', domain)
    .single();

  if (existing && existing.team_id !== team.id) {
    return NextResponse.json({ error: 'Domain already in use by another team' }, { status: 409 });
  }

  // Add to Vercel
  const vercelResult = await addDomain(domain);
  if (vercelResult.error) {
    return NextResponse.json({
      error: `Vercel error: ${vercelResult.error.message}`,
    }, { status: 400 });
  }

  // Upsert team_domains
  const dnsConfig = {
    type: 'CNAME',
    value: 'cname.vercel-dns.com',
    verification: vercelResult.verification || [],
  };

  const { data: domainRow, error: upsertError } = await supabase
    .from('team_domains')
    .upsert({
      team_id: team.id,
      domain,
      vercel_domain_id: vercelResult.name,
      status: vercelResult.verified ? 'active' : 'pending_dns',
      dns_config: dnsConfig,
      last_checked_at: new Date().toISOString(),
    }, { onConflict: 'team_id' })
    .select()
    .single();

  if (upsertError) {
    return NextResponse.json({ error: 'Failed to save domain' }, { status: 500 });
  }

  // Enable whitelabel on the team
  await supabase
    .from('teams')
    .update({ whitelabel_enabled: true })
    .eq('id', team.id);

  invalidateDomainCache(domain);

  return NextResponse.json({
    domain: domainRow,
    dns: {
      type: 'CNAME',
      name: domain.split('.')[0], // subdomain part
      value: 'cname.vercel-dns.com',
    },
  });
}

// DELETE — remove custom domain
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', session.user.id)
    .limit(1)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'No team found' }, { status: 404 });
  }

  const { data: domainRow } = await supabase
    .from('team_domains')
    .select('id, domain')
    .eq('team_id', team.id)
    .single();

  if (!domainRow) {
    return NextResponse.json({ error: 'No domain configured' }, { status: 404 });
  }

  // Remove from Vercel
  await removeDomain(domainRow.domain);

  // Delete from DB
  await supabase
    .from('team_domains')
    .delete()
    .eq('id', domainRow.id);

  invalidateDomainCache(domainRow.domain);

  return NextResponse.json({ success: true });
}
```

**Step 2: Write the verify route**

`src/app/api/settings/team-domain/verify/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { checkDomain } from '@/lib/integrations/vercel-domains';
import { invalidateDomainCache } from '@/lib/utils/domain-lookup';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', session.user.id)
    .limit(1)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'No team found' }, { status: 404 });
  }

  const { data: domainRow } = await supabase
    .from('team_domains')
    .select('id, domain, status')
    .eq('team_id', team.id)
    .single();

  if (!domainRow) {
    return NextResponse.json({ error: 'No domain configured' }, { status: 404 });
  }

  // Check with Vercel
  const vercelStatus = await checkDomain(domainRow.domain);

  const newStatus = vercelStatus.verified ? 'active' : 'pending_dns';

  await supabase
    .from('team_domains')
    .update({
      status: newStatus,
      dns_config: {
        type: 'CNAME',
        value: 'cname.vercel-dns.com',
        verification: vercelStatus.verification || [],
      },
      last_checked_at: new Date().toISOString(),
    })
    .eq('id', domainRow.id);

  if (newStatus === 'active') {
    invalidateDomainCache(domainRow.domain);
  }

  return NextResponse.json({
    status: newStatus,
    verified: vercelStatus.verified,
    verification: vercelStatus.verification || [],
  });
}
```

**Step 3: Commit**

```bash
git add src/app/api/settings/team-domain/route.ts src/app/api/settings/team-domain/verify/route.ts
git commit -m "feat: add team domain API routes (CRUD + verify via Vercel API)"
```

---

### Task 8: White-Label Settings API Route

**Files:**
- Create: `src/app/api/settings/whitelabel/route.ts`

**Step 1: Write the white-label settings route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUserPlan } from '@/lib/auth/plan-limits';

// GET — get white-label config
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: team } = await supabase
    .from('teams')
    .select('id, whitelabel_enabled, hide_branding, custom_favicon_url, custom_site_name, custom_email_sender_name')
    .eq('owner_id', session.user.id)
    .limit(1)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'No team found' }, { status: 404 });
  }

  return NextResponse.json({ whitelabel: team });
}

// PATCH — update white-label config
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const plan = await getUserPlan(session.user.id);
  if (plan === 'free') {
    return NextResponse.json({
      error: 'White-labeling requires a Pro or Unlimited plan',
      upgrade: '/settings#billing',
    }, { status: 403 });
  }

  const body = await request.json();
  const { hideBranding, customFaviconUrl, customSiteName, customEmailSenderName } = body;

  const supabase = createSupabaseAdminClient();
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', session.user.id)
    .limit(1)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'No team found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('teams')
    .update({
      hide_branding: hideBranding ?? false,
      custom_favicon_url: customFaviconUrl ?? null,
      custom_site_name: customSiteName ?? null,
      custom_email_sender_name: customEmailSenderName ?? null,
    })
    .eq('id', team.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add src/app/api/settings/whitelabel/route.ts
git commit -m "feat: add white-label settings API route (GET + PATCH)"
```

---

### Task 9: Settings UI — WhiteLabelSettings Component

**Files:**
- Create: `src/components/settings/WhiteLabelSettings.tsx`
- Modify: `src/components/dashboard/SettingsContent.tsx` (add import + render)
- Modify: `src/app/(dashboard)/settings/page.tsx` (pass whitelabel data)

**Step 1: Write the WhiteLabelSettings component**

Create `src/components/settings/WhiteLabelSettings.tsx` — a settings card with:
- Domain input + save button + status badge (green "Active", yellow "Pending DNS")
- Expandable DNS instructions panel with copy-to-clipboard
- Verify button (polls /api/settings/team-domain/verify)
- Delete domain button with confirmation
- Separator
- Hide branding checkbox
- Site name input
- Favicon upload (reuse Supabase storage pattern from BrandingSettings)
- Email sender name input
- Save branding button

The component should:
- Accept `plan` prop to show upgrade prompt for free users
- Fetch domain and whitelabel data via GET on mount
- Handle save, verify, delete actions
- Show loading/error states
- Poll verification status after domain save (every 10s, up to 2 min)

**Step 2: Add to SettingsContent**

In `src/components/dashboard/SettingsContent.tsx`:
- Import `WhiteLabelSettings`
- Add a "White Label" section after the "Page Defaults Section" (~line 499)
- Pass `plan` from subscription data

**Step 3: Commit**

```bash
git add src/components/settings/WhiteLabelSettings.tsx src/components/dashboard/SettingsContent.tsx src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add White Label settings UI with domain config and branding controls"
```

---

### Task 10: Env Vars and Deployment

**Files:**
- Modify: `.env.local` (add VERCEL_TOKEN, VERCEL_PROJECT_ID)

**Step 1: Add env vars locally**

Add to `.env.local`:
```
VERCEL_TOKEN=<your-vercel-token>
VERCEL_PROJECT_ID=<your-vercel-project-id>
VERCEL_TEAM_ID=<your-vercel-team-id-if-applicable>
```

**Step 2: Set env vars on Vercel**

Run: `vercel env add VERCEL_TOKEN production`
Run: `vercel env add VERCEL_PROJECT_ID production`

**Step 3: Update CLAUDE.md with new env vars**

Add `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` to the env vars list in CLAUDE.md.

**Step 4: Full build test**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run build`
Expected: Build succeeds with no errors

Run: `npm run typecheck`
Expected: No type errors

**Step 5: Commit docs update**

```bash
git add CLAUDE.md
git commit -m "docs: add custom domains & white-label section to CLAUDE.md"
```

---

### Task 11: Manual E2E Verification

**No automated test — manual verification steps:**

1. Start dev server: `npm run dev`
2. Go to Settings → White Label section
3. Verify free plan shows upgrade prompt
4. With Pro plan: enter a test domain, verify API call succeeds
5. Check Vercel dashboard to confirm domain was added
6. Verify DNS instructions display correctly
7. Test verify button (should show pending if DNS not configured)
8. Toggle "Hide Powered By" → save → visit a public page → confirm footer is gone
9. Set custom site name → visit a public page → check browser tab title
10. Clean up: delete test domain

---

## Dependency Graph

```
Task 1 (migration) → Task 2 (domain lookup) → Task 3 (middleware)
Task 1 (migration) → Task 4 (whitelabel fetch) → Task 5 (conditional branding)
Task 1 (migration) → Task 6 (Vercel API client) → Task 7 (domain API routes)
Task 1 (migration) → Task 8 (whitelabel API route)
Task 7 + Task 8 → Task 9 (settings UI)
Task 3 + Task 5 + Task 9 → Task 10 (env vars + deployment)
Task 10 → Task 11 (manual E2E)
```

Tasks 2-8 can be parallelized after Task 1 completes.
