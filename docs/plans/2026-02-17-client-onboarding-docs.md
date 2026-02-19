# Client Onboarding Docs + MCP Publishing — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an in-app docs hub at `/docs` with tiered guides (client quick-start, agency owner, power user/MCP), publish `@magnetlab/mcp` to npm, and add contextual links from the funnel builder and settings.

**Architecture:** Static React pages at `/(dashboard)/docs/[slug]` with a sidebar layout. Content lives as React components (no CMS/MDX). The MCP package gets npm-ready with proper `files` field and README, then published so users can `npx @magnetlab/mcp serve`.

**Tech Stack:** Next.js 15 (App Router), React, Tailwind CSS, lucide-react icons, `@magnetlab/mcp` npm package.

---

## Phase 1: Publish @magnetlab/mcp to npm

### Task 1: Fix package.json for npm publishing

**Files:**
- Modify: `packages/mcp/package.json`

**Step 1: Add `files`, `exports`, `repository`, and metadata fields**

Update `packages/mcp/package.json` to:

```json
{
  "name": "@magnetlab/mcp",
  "version": "0.1.0",
  "description": "MCP server for MagnetLab - control your lead magnets, funnels, content pipeline, and analytics from Claude Code",
  "type": "module",
  "main": "dist/index.js",
  "exports": {
    ".": "./dist/index.js"
  },
  "bin": {
    "magnetlab-mcp": "./dist/index.js"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["mcp", "claude", "magnetlab", "lead-magnet", "funnel", "content-pipeline", "claude-code", "model-context-protocol"],
  "author": "MagnetLab",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/modernagencysales/magnetlab",
    "directory": "packages/mcp"
  },
  "homepage": "https://magnetlab.ai",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "commander": "^12.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Step 2: Verify build works**

Run from `packages/mcp/`:
```bash
npm run build
```
Expected: Clean compile, no errors.

**Step 3: Commit**

```bash
git add packages/mcp/package.json
git commit -m "chore(mcp): prepare package.json for npm publishing"
```

---

### Task 2: Write MCP package README

**Files:**
- Create: `packages/mcp/README.md`

**Step 1: Write the README**

The README should cover:
- What the MCP server does (one-liner)
- Quick setup for Claude Code (`.mcp.json` config)
- Quick setup for Claude Desktop (`claude_desktop_config.json` config)
- Getting your API key (Settings → API Keys in MagnetLab)
- Available tool categories (Lead Magnets, Funnels, Leads, Analytics, Brand Kit, Email Sequences, Content Pipeline, Swipe File, Libraries, Qualification Forms)
- Example prompts ("Create a landing page for my free SEO audit", etc.)
- Environment variables (`MAGNETLAB_API_KEY`, `MAGNETLAB_BASE_URL`)

Content:

```markdown
# @magnetlab/mcp

MCP server for [MagnetLab](https://magnetlab.ai) — create lead magnets, build funnels, manage leads, and run your content pipeline from Claude.

## Quick Start

### 1. Get your API key

Go to **Settings → API Keys** in MagnetLab and create a new key. Copy it — it starts with `ml_live_`.

### 2. Add to Claude Code

Add to your project's `.mcp.json` (or `~/.claude/.mcp.json` for global):

```json
{
  "mcpServers": {
    "magnetlab": {
      "command": "npx",
      "args": ["-y", "@magnetlab/mcp", "serve"],
      "env": {
        "MAGNETLAB_API_KEY": "ml_live_your_key_here"
      }
    }
  }
}
```

### 3. Add to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "magnetlab": {
      "command": "npx",
      "args": ["-y", "@magnetlab/mcp", "serve"],
      "env": {
        "MAGNETLAB_API_KEY": "ml_live_your_key_here"
      }
    }
  }
}
```

### 4. Try it

Ask Claude:
- "Create a landing page called 'Free SEO Audit' with a dark theme"
- "List my funnels and show me their conversion rates"
- "Generate an email sequence for my latest lead magnet"
- "Show me my leads from the last 7 days"

## Available Tools

| Category | Tools | What you can do |
|----------|-------|-----------------|
| Lead Magnets | 7 | Create, list, delete, get stats, analyze competitors/transcripts |
| Funnels | 9 | Create, update, publish/unpublish, generate opt-in copy |
| Leads | 2 | List leads (filtered), export as CSV |
| Analytics | 1 | Funnel performance stats |
| Brand Kit | 3 | Get/update brand kit, extract business context |
| Email Sequences | 4 | Generate, update, activate drip sequences |
| Content Pipeline | 30+ | Transcripts, knowledge base, ideas, posts, scheduling, autopilot |
| Swipe File | 3 | Browse community posts and lead magnets |
| Libraries | 7 | Create/manage content libraries |
| Qualification Forms | 5 | Create forms and survey questions |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MAGNETLAB_API_KEY` | Yes | Your MagnetLab API key (starts with `ml_live_`) |
| `MAGNETLAB_BASE_URL` | No | API base URL (default: `https://magnetlab.ai/api`) |

## CLI Usage

```bash
# Via npx (recommended)
MAGNETLAB_API_KEY=ml_live_... npx @magnetlab/mcp serve

# Or with flags
npx @magnetlab/mcp serve --api-key ml_live_... --base-url https://magnetlab.ai/api
```
```

**Step 2: Commit**

```bash
git add packages/mcp/README.md
git commit -m "docs(mcp): add README for npm package"
```

---

### Task 3: Publish to npm

**Step 1: Ensure npm auth**

```bash
npm whoami
```

If not logged in: `npm login`

**Step 2: Do a dry run**

From `packages/mcp/`:
```bash
npm publish --dry-run
```

Expected: Shows only `dist/` files and `README.md`. No `src/`, `node_modules/`, or `tsconfig.json`.

**Step 3: Publish**

```bash
npm publish --access public
```

Expected: Package published at `https://www.npmjs.com/package/@magnetlab/mcp`

**Step 4: Verify it works**

```bash
npx @magnetlab/mcp --help
```

Expected: Shows CLI help with `serve` command and `--api-key` / `--base-url` options.

**Step 5: Commit version bump if needed**

If npm bumped the version, commit the change.

---

## Phase 2: Docs Hub Infrastructure

### Task 4: Create docs layout with sidebar

**Files:**
- Create: `src/app/(dashboard)/docs/layout.tsx`
- Modify: `src/app/(dashboard)/docs/page.tsx` (replace redirect stub)
- Create: `src/components/docs/DocsLayout.tsx`
- Create: `src/components/docs/DocsSidebar.tsx`

**Step 1: Create the sidebar component**

File: `src/components/docs/DocsSidebar.tsx`

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Plug, Zap, Settings, Bot, ChevronRight } from 'lucide-react';

interface DocSection {
  title: string;
  items: { href: string; label: string }[];
  icon: React.ElementType;
}

const sections: DocSection[] = [
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
    <nav className="w-64 shrink-0 border-r bg-card/50 p-4 overflow-y-auto hidden lg:block">
      <Link
        href="/docs"
        className="flex items-center gap-2 mb-6 px-2 text-sm font-semibold text-foreground"
      >
        <BookOpen className="h-4 w-4" />
        Documentation
      </Link>
      {sections.map((section) => (
        <div key={section.title} className="mb-5">
          <div className="flex items-center gap-2 px-2 mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <section.icon className="h-3.5 w-3.5" />
            {section.title}
          </div>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {isActive && <ChevronRight className="h-3 w-3" />}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
```

**Step 2: Create the docs layout**

File: `src/app/(dashboard)/docs/layout.tsx`

```tsx
import { DocsSidebar } from '@/components/docs/DocsSidebar';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <DocsSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-4xl px-6 py-8 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

**Step 3: Replace the docs hub page**

File: `src/app/(dashboard)/docs/page.tsx` (replace the redirect stub)

```tsx
import { Metadata } from 'next';
import Link from 'next/link';
import { Zap, Plug, Settings, Bot } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Docs | MagnetLab',
  description: 'Guides for creating landing pages, connecting email lists, and using MagnetLab with AI.',
};

const cards = [
  {
    title: 'Quick Start',
    description: 'Create a landing page and start capturing leads in minutes.',
    icon: Zap,
    href: '/docs/create-landing-page',
    color: 'text-green-500',
  },
  {
    title: 'Connect Your Email List',
    description: 'Send leads to Zapier, Make, n8n, or your own API.',
    icon: Plug,
    href: '/docs/connect-email-list',
    color: 'text-blue-500',
  },
  {
    title: 'Advanced Setup',
    description: 'Customize funnels, set up email drips, and add tracking.',
    icon: Settings,
    href: '/docs/customize-funnel',
    color: 'text-orange-500',
  },
  {
    title: 'Create Pages with Claude',
    description: 'Use the MagnetLab MCP server to build and manage pages from Claude.',
    icon: Bot,
    href: '/docs/mcp-setup',
    color: 'text-violet-500',
  },
];

export default function DocsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Documentation</h1>
        <p className="mt-2 text-muted-foreground">
          Everything you need to create landing pages, capture leads, and connect to your tools.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-lg border bg-card p-5 transition-colors hover:border-violet-500/50 hover:bg-violet-500/5"
          >
            <card.icon className={`h-6 w-6 mb-3 ${card.color}`} />
            <h2 className="text-lg font-semibold group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
              {card.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Verify build**

```bash
npm run build
```

Expected: Clean build, no errors.

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/docs/ src/components/docs/
git commit -m "feat(docs): add docs hub with sidebar layout"
```

---

### Task 5: Add docs nav item to sidebar

**Files:**
- Modify: `src/components/dashboard/DashboardNav.tsx`

**Step 1: Add `BookOpen` icon import and nav item**

Add `BookOpen` to the lucide-react import:

```tsx
import { ..., BookOpen } from 'lucide-react';
```

Add to `bottomNav` array (above Settings):

```tsx
const bottomNav = [
  { href: '/docs', label: 'Docs', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];
```

**Step 2: Verify it renders**

```bash
npm run dev
```

Navigate to any dashboard page — "Docs" should appear in the bottom section of the sidebar above "Settings".

**Step 3: Commit**

```bash
git add src/components/dashboard/DashboardNav.tsx
git commit -m "feat(docs): add Docs link to dashboard sidebar"
```

---

### Task 6: Create dynamic [slug] route

**Files:**
- Create: `src/app/(dashboard)/docs/[slug]/page.tsx`
- Create: `src/components/docs/guides/index.ts` (guide registry)

**Step 1: Create the guide registry**

File: `src/components/docs/guides/index.ts`

```tsx
import { ComponentType } from 'react';

export interface GuideMetadata {
  title: string;
  description: string;
  tier: 'quick-start' | 'advanced' | 'mcp';
}

// Lazy-loaded guide components — each guide is its own file
// Added in subsequent tasks
export const guides: Record<string, { metadata: GuideMetadata; component: ComponentType }> = {};

export function registerGuide(
  slug: string,
  metadata: GuideMetadata,
  component: ComponentType
) {
  guides[slug] = { metadata, component };
}
```

**Step 2: Create the [slug] page**

File: `src/app/(dashboard)/docs/[slug]/page.tsx`

```tsx
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { guides } from '@/components/docs/guides';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = guides[slug];
  if (!guide) return { title: 'Not Found | MagnetLab Docs' };
  return {
    title: `${guide.metadata.title} | MagnetLab Docs`,
    description: guide.metadata.description,
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = guides[slug];
  if (!guide) notFound();

  const GuideComponent = guide.component;
  return <GuideComponent />;
}
```

**Step 3: Verify build**

```bash
npm run build
```

Expected: Clean build. Navigating to `/docs/nonexistent` should 404.

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/docs/\[slug\]/ src/components/docs/guides/
git commit -m "feat(docs): add dynamic [slug] routing for guide pages"
```

---

## Phase 3: Tier 1 Guides — Client Quick-Start

### Task 7: "Create Your Landing Page" guide

**Files:**
- Create: `src/components/docs/guides/create-landing-page.tsx`
- Modify: `src/components/docs/guides/index.ts` (register it)

**Step 1: Write the guide component**

File: `src/components/docs/guides/create-landing-page.tsx`

This guide covers the Quick Page Creator flow:
1. Go to **Create** → **Quick Page**
2. Enter your lead magnet title and a short description of what it delivers
3. AI generates your opt-in page copy (headline, subline, button text)
4. Preview your page in the funnel builder
5. Customize (optional): adjust headline, colors, theme, add your logo
6. Hit **Publish** — your page is live at `magnetlab.ai/p/your-username/your-slug`
7. Share the URL

Include these sections:
- "Before You Start" (need an account + username set in Settings)
- "Create Your Page (2 minutes)" — numbered steps
- "Customize Your Page (optional)" — theme, colors, logo, social proof
- "Publish & Share" — publish button, copy URL
- "What's Next?" — link to "Connect to Your Email List" guide

Use consistent component patterns:
- `<h1>` for page title
- `<h2>` for major sections
- `<h3>` for sub-sections
- Ordered lists for steps
- `rounded-lg border bg-muted/30 p-4` for callout boxes
- `rounded-lg bg-muted p-3 font-mono text-sm` for code/URL examples

**Step 2: Register in the guide index**

Add import and registration to `src/components/docs/guides/index.ts`.

**Step 3: Verify**

```bash
npm run dev
```

Navigate to `/docs/create-landing-page` — should render the guide.

**Step 4: Commit**

```bash
git add src/components/docs/guides/
git commit -m "docs: add 'Create Your Landing Page' guide"
```

---

### Task 8: "Connect to Your Email List" guide

**Files:**
- Create: `src/components/docs/guides/connect-email-list.tsx`
- Modify: `src/components/docs/guides/index.ts` (register it)

**Step 1: Write the guide**

Sections:
- **How It Works** — when someone fills your form, MagnetLab sends a webhook (HTTP POST) with their info. You connect this to your email platform using an automation tool.
- **Step 1: Create a Webhook** — go to Settings → Webhooks → Add webhook. Name it (e.g., "Mailchimp sync"), paste the URL from your automation tool.
- **Step 2: Test It** — click the test button, verify your automation tool receives the test payload.
- **Step 3: Map the Fields** — in your automation tool, map `data.email` → email, `data.name` → name, etc.
- **Choose Your Tool** — cards linking to Zapier, Make, n8n, Direct API sub-guides.
- **Webhook Payload Reference** — the full JSON payload with field descriptions. Include the "Copy to clipboard" button.

**Step 2: Register and commit** (same pattern as Task 7)

---

### Task 9: Integration sub-guides (Zapier, Make, n8n, Direct API)

**Files:**
- Create: `src/components/docs/guides/zapier.tsx`
- Create: `src/components/docs/guides/make.tsx`
- Create: `src/components/docs/guides/n8n.tsx`
- Create: `src/components/docs/guides/direct-api.tsx`
- Modify: `src/components/docs/guides/index.ts` (register all 4)

**Step 1: Zapier guide**

Sections:
- Create a Zap → trigger: "Webhooks by Zapier" → "Catch Hook"
- Copy the webhook URL Zapier gives you
- Paste it into MagnetLab Settings → Webhooks
- Test — click test in MagnetLab, then "Test trigger" in Zapier
- Add action: your email platform (Mailchimp, ConvertKit, ActiveCampaign, etc.)
- Map fields: `data.email`, `data.name`, `data.leadMagnetTitle`
- Turn on the Zap

**Step 2: Make guide**

Sections:
- Create a scenario → trigger module: "Webhooks" → "Custom webhook"
- Copy the webhook URL Make gives you
- Paste it into MagnetLab Settings → Webhooks
- Test — click test in MagnetLab, then "Run once" in Make
- Add module: your email platform
- Map fields from the webhook data
- Activate the scenario

**Step 3: n8n guide**

Sections:
- Create a workflow → add "Webhook" trigger node
- Set method to POST, copy the production webhook URL
- Paste into MagnetLab Settings → Webhooks
- Test with the test button
- Add your email platform node
- Map fields: `{{ $json.data.email }}`, `{{ $json.data.name }}`
- Activate the workflow

**Step 4: Direct API guide**

Sections:
- Webhook format: POST request, JSON body, headers (`X-Webhook-Event`, `X-Webhook-Id`, `X-Webhook-Attempt`)
- Full payload schema with types and descriptions
- Events: `lead.created` (on opt-in), `lead.qualified` (after survey)
- Retry behavior: 3 attempts, exponential backoff, 10s timeout
- Example: receiving webhook in Express.js
- Example: receiving webhook in Python/Flask
- Security: verify `X-Webhook-Id` for idempotency

**Step 5: Register all 4 and commit**

```bash
git add src/components/docs/guides/
git commit -m "docs: add Zapier, Make, n8n, and Direct API integration guides"
```

---

### Task 10: AI-Friendly Webhook Reference

**Files:**
- Create: `src/components/docs/guides/webhook-reference-ai.tsx`
- Modify: `src/components/docs/guides/index.ts`

This is a special page: a self-contained, copy-pasteable reference document designed to be given to an AI assistant. It should have a prominent "Copy to Clipboard" button at the top.

**Step 1: Write the component**

The copyable content block should start with:

```
You are helping someone connect their MagnetLab landing page to their email marketing platform.

## What MagnetLab Does
MagnetLab sends a webhook (HTTP POST) to a URL you configure whenever someone opts into a landing page.

## Webhook Configuration
- Go to Settings → Webhooks in MagnetLab (magnetlab.ai)
- Add a new webhook with the URL from your automation tool
- Webhooks must use HTTPS

## Events
- `lead.created` — fired when someone submits their email
- `lead.qualified` — fired after they complete the qualification survey (if configured)

## Payload (lead.created)
{
  "event": "lead.created",
  "timestamp": "2025-01-26T12:00:00Z",
  "data": {
    "leadId": "uuid — unique lead identifier",
    "email": "lead@example.com — the lead's email address",
    "name": "John Doe — the lead's name (may be empty)",
    "isQualified": null,
    "qualificationAnswers": null,
    "surveyAnswers": null,
    "leadMagnetTitle": "Your Lead Magnet — name of the lead magnet they opted into",
    "funnelPageSlug": "your-page — URL slug of the funnel page",
    "utmSource": "linkedin — UTM source parameter (may be null)",
    "utmMedium": "social — UTM medium parameter (may be null)",
    "utmCampaign": "launch — UTM campaign parameter (may be null)",
    "createdAt": "2025-01-26T12:00:00Z"
  }
}

## Payload (lead.qualified)
Same structure as lead.created, but with qualification data filled in:
- isQualified: true/false
- qualificationAnswers: { "question_id": "answer_value", ... }
- surveyAnswers: { "question_slug": "answer_value", ... }

## Headers Sent
- X-Webhook-Event: "lead.created" or "lead.qualified"
- X-Webhook-Id: unique delivery ID (use for idempotency)
- X-Webhook-Attempt: "1", "2", or "3"
- Content-Type: application/json

## Retry Behavior
- 3 attempts with exponential backoff
- 10-second timeout per attempt
- Your endpoint should return 2xx to acknowledge receipt

## Common Integration Patterns
- Zapier: Use "Webhooks by Zapier" trigger → "Catch Hook"
- Make: Use "Webhooks" module → "Custom webhook"
- n8n: Use "Webhook" trigger node, method: POST
- Direct: Accept POST at your endpoint, parse JSON body, return 200
```

The component renders this in a styled `<pre>` block with a copy button. Also shows the reference inline with proper formatting for reading on the page.

**Step 2: Add a link to this from the "Connect to Your Email List" guide.**

In the connect-email-list guide, add a callout box at the bottom:

> **Need help from an AI assistant?** Copy our [AI-friendly webhook reference](/docs/webhook-reference-ai) and paste it into ChatGPT, Claude, or any AI tool — it has everything needed to help you set up the integration.

**Step 3: Register and commit**

```bash
git add src/components/docs/guides/
git commit -m "docs: add AI-friendly webhook reference (copy-paste block)"
```

---

## Phase 4: Tier 2 Guides — Agency Owner

### Task 11: "Customize Your Funnel" guide

**Files:**
- Create: `src/components/docs/guides/customize-funnel.tsx`
- Modify: `src/components/docs/guides/index.ts`

Sections:
- **Theme** — dark/light, primary color, background style (solid/gradient/pattern), logo upload
- **Opt-in Page** — headline, subline, button text, social proof text
- **Thank-You Page** — headline, subline, VSL video URL, Cal.com booking link
- **Qualification Questions** — add yes/no, text, multiple choice questions. Explain qualified vs. unqualified routing.
- **Page Sections** — add testimonials, feature bullets, etc. above or below the form
- **Content Page** — the hosted lead magnet content page, AI polish feature

Register and commit.

---

### Task 12: "Email Sequences" guide

**Files:**
- Create: `src/components/docs/guides/email-sequences.tsx`
- Modify: `src/components/docs/guides/index.ts`

Sections:
- **What are email sequences?** — built-in 5-email drip, no external tool needed
- **Setup** — go to funnel builder → Email tab → Generate sequence (AI-powered)
- **Customize** — edit subject lines, body, timing
- **Activate** — toggle the sequence on
- **Custom email domain** — Settings → Resend integration (optional, defaults to sends.magnetlab.app)

Register and commit.

---

### Task 13: "Tracking & Attribution" guide

**Files:**
- Create: `src/components/docs/guides/tracking.tsx`
- Modify: `src/components/docs/guides/index.ts`

Sections:
- **Meta Pixel** — Settings → Tracking → Meta Pixel ID + Access Token. Server-side Conversions API.
- **LinkedIn Insight Tag** — Settings → Tracking → LinkedIn Partner ID + Access Token. Server-side CAPI.
- **UTM Parameters** — append `?utm_source=...&utm_medium=...&utm_campaign=...` to your page URL. These are captured and included in webhook payloads and lead records.

Register and commit.

---

### Task 14: "Troubleshooting" guide

**Files:**
- Create: `src/components/docs/guides/troubleshooting.tsx`
- Modify: `src/components/docs/guides/index.ts`

Sections:
- **Webhook not firing** — check webhook is active, URL is HTTPS, use the test button
- **Leads not appearing in email platform** — check automation tool is active, field mapping is correct, check automation tool logs
- **Page not publishing** — must have username set in Settings
- **Page shows 404** — check slug, check it's published
- **Qualification not working** — need at least one yes/no or multiple choice question

Register and commit.

---

## Phase 5: Tier 3 Guides — MCP / Power User

### Task 15: "Create Pages with Claude" (MCP setup guide)

**Files:**
- Create: `src/components/docs/guides/mcp-setup.tsx`
- Modify: `src/components/docs/guides/index.ts`

Sections:
- **What is MCP?** — Model Context Protocol lets AI assistants (like Claude) interact with MagnetLab directly. Create pages, manage leads, run your content pipeline — all from a conversation.
- **Step 1: Get Your API Key** — Settings → API Keys → Create key → copy `ml_live_...`
- **Step 2: Install** — show both Claude Code and Claude Desktop configs (same as README)

```json
{
  "mcpServers": {
    "magnetlab": {
      "command": "npx",
      "args": ["-y", "@magnetlab/mcp", "serve"],
      "env": {
        "MAGNETLAB_API_KEY": "ml_live_your_key_here"
      }
    }
  }
}
```

- **Step 3: Try It** — example prompts with expected outcomes:
  - "Create a landing page called 'Free SEO Audit'" → creates lead magnet + funnel
  - "Publish my latest funnel" → publishes and returns the live URL
  - "Show me my leads from this week" → lists recent leads
  - "Generate an email sequence for my lead magnet" → creates 5-email drip

Register and commit.

---

### Task 16: MCP Tool Reference guide

**Files:**
- Create: `src/components/docs/guides/mcp-tools.tsx`
- Modify: `src/components/docs/guides/index.ts`

Table of all 60+ tools organized by category, with tool name, required params, and one-line description. Use collapsible sections (`<details>`) per category to keep the page scannable.

Categories (from the actual tool files):
1. **Lead Magnets** (7 tools)
2. **Ideation** (6 tools)
3. **Funnels** (9 tools)
4. **Leads** (2 tools)
5. **Analytics** (1 tool)
6. **Brand Kit** (3 tools)
7. **Email Sequences** (4 tools)
8. **Content Pipeline** (30+ tools)
9. **Swipe File** (3 tools)
10. **Libraries** (7 tools)
11. **Qualification Forms** (5 tools)

Register and commit.

---

### Task 17: MCP Workflows guide

**Files:**
- Create: `src/components/docs/guides/mcp-workflows.tsx`
- Modify: `src/components/docs/guides/index.ts`

3-4 example workflows with the exact prompts and expected outcomes:

**Workflow 1: "Landing Page in 60 Seconds"**
```
You: "Create a lead magnet called 'The 5-Step SEO Audit Framework' as a focused-toolkit"
Claude: Creates lead magnet, returns ID
You: "Create a funnel for that lead magnet with a dark theme and publish it"
Claude: Creates funnel, publishes, returns live URL
```

**Workflow 2: "Full Funnel with Qualification + Email Drip"**
```
You: "Create a funnel for lead magnet [ID] with qualification questions: 'Are you a B2B founder?' (yes/no) and 'What's your monthly revenue?' (multiple choice: <$10k, $10k-$50k, $50k+)"
Claude: Creates funnel with qualification form
You: "Generate and activate an email sequence for this lead magnet"
Claude: Generates 5 emails, activates the sequence
You: "Publish the funnel"
Claude: Publishes, returns URL
```

**Workflow 3: "Weekly Lead Review"**
```
You: "Show me all leads from the last 7 days with their qualification status"
Claude: Lists leads with email, name, qualified/unqualified, lead magnet title
You: "Export those as CSV"
Claude: Returns CSV download
```

**Workflow 4: "Content Pipeline from Transcript"**
```
You: "I just had a sales call. Here's the transcript: [paste]. Extract knowledge and content ideas."
Claude: Processes transcript, extracts knowledge entries, generates content ideas
You: "Write a LinkedIn post from the best idea"
Claude: Writes post, returns draft for review
```

Register and commit.

---

## Phase 6: Contextual Links

### Task 18: Add docs links to LeadDeliveryInfo

**Files:**
- Modify: `src/components/funnel/LeadDeliveryInfo.tsx`

**Step 1: Add link to the no-webhook warning state**

In the yellow warning panel (no webhooks configured), add after the existing text:

```tsx
<Link href="/docs/connect-email-list" className="text-sm text-violet-600 dark:text-violet-400 hover:underline mt-2 inline-block">
  Step-by-step integration guide →
</Link>
```

**Step 2: Add link to the has-webhook state**

In the green panel footer, add:

```tsx
<Link href="/docs/connect-email-list" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
  Integration guides →
</Link>
```

**Step 3: Commit**

```bash
git add src/components/funnel/LeadDeliveryInfo.tsx
git commit -m "feat(docs): add integration guide links to LeadDeliveryInfo"
```

---

### Task 19: Add docs link to WebhookSettings

**Files:**
- Modify: `src/components/settings/WebhookSettings.tsx`

**Step 1: Add link below the webhook payload info block**

After the `<pre>` block showing the payload (around line 326), add:

```tsx
<div className="mt-3 flex items-center gap-4">
  <Link href="/docs/connect-email-list" className="text-sm text-violet-600 dark:text-violet-400 hover:underline">
    Integration guides (Zapier, Make, n8n) →
  </Link>
  <Link href="/docs/webhook-reference-ai" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
    AI-friendly reference →
  </Link>
</div>
```

**Step 2: Commit**

```bash
git add src/components/settings/WebhookSettings.tsx
git commit -m "feat(docs): add integration guide links to WebhookSettings"
```

---

### Task 20: Add docs link to PublishControls post-publish state

**Files:**
- Modify: `src/components/funnel/PublishControls.tsx`

**Step 1: Add link after the public URL section**

In the published state (after the Copy/Open buttons), add:

```tsx
<div className="mt-4 pt-4 border-t">
  <p className="text-sm text-muted-foreground">
    Next: <Link href="/docs/connect-email-list" className="text-violet-600 dark:text-violet-400 hover:underline">connect your email list</Link> to receive leads in real-time.
  </p>
</div>
```

**Step 2: Commit**

```bash
git add src/components/funnel/PublishControls.tsx
git commit -m "feat(docs): add email list guide link to post-publish state"
```

---

## Phase 7: Final Verification

### Task 21: Full build + manual verification

**Step 1: Build**

```bash
npm run build
```

Expected: Clean build, no errors.

**Step 2: Type check**

```bash
npm run typecheck
```

Expected: No type errors.

**Step 3: Manual verification checklist**

- [ ] `/docs` shows hub page with 4 cards
- [ ] Sidebar navigation shows all sections and guides
- [ ] Each guide page renders at `/docs/{slug}`
- [ ] Unknown slugs show 404
- [ ] "Docs" link appears in dashboard sidebar
- [ ] LeadDeliveryInfo shows integration guide link
- [ ] WebhookSettings shows integration guide and AI reference links
- [ ] PublishControls post-publish shows email list guide link
- [ ] AI-friendly reference "Copy to clipboard" button works
- [ ] `npx @magnetlab/mcp serve --help` works (if published)

**Step 4: Final commit**

```bash
git add -A
git commit -m "docs: complete client onboarding docs hub with MCP guides"
```
