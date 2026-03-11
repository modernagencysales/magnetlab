# GTM Accelerator Phase 4 — M5/M6 Agents, Billing Enforcement, Enrollment Flow

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the agent roster with M5 (LinkedIn Ads) and M6 (Operating System) specialist agents, add Stripe-powered enrollment/billing enforcement so only paying users can access the accelerator, and wire M5/M6 metrics + diagnostics into the existing Phase 3 infrastructure.

**Architecture:** Two new sub-agent prompt builders follow the established `buildXxxAgentPrompt(sops, userContext)` pattern. A new enrollment API route creates a Stripe checkout session for a one-time $997 payment; the existing webhook handler is extended with a `checkout.session.completed` branch that creates the enrollment. An `enforceAcceleratorAccess()` guard is added to the copilot chat route to reject unenrolled users. New actions let agents check enrollment status and usage. M5/M6 benchmarks and diagnostic rules are added to the existing metrics and troubleshooter infrastructure.

**Tech Stack:** Next.js 15, Supabase PostgreSQL, Stripe (one-time payment checkout), Claude API, Jest

**Builds on:** Phase 1 (core state, M0/M1/M7 agents) + Phase 2 (providers, M2/M3/M4 agents) + Phase 3 (metrics, troubleshooter, scheduler, digest)

---

## Deferred to Phase 5+

These items are intentionally NOT in Phase 4:
- **Admin dashboard UI** — all interaction through copilot chat
- **Community features** — shared playbooks, peer benchmarking
- **Support ticket escalation system** — troubleshooter handles diagnostics
- **Metrics archival / retention policy** — 12-month live data is sufficient
- **LinkedIn Ads API integration** — M5 agent guides users through LinkedIn Campaign Manager manually (guided provider pattern)
- **Subscription-based billing** — accelerator is one-time purchase; recurring billing not needed yet
- **Free trial / freemium gating** — binary access: paid or not paid

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/lib/ai/copilot/sub-agents/linkedin-ads-agent.ts` | M5 LinkedIn Ads agent prompt builder |
| `src/lib/ai/copilot/sub-agents/operating-system-agent.ts` | M6 Operating System agent prompt builder |
| `src/lib/services/accelerator-enrollment.ts` | Enrollment creation + access check service |
| `src/app/api/accelerator/enroll/route.ts` | Stripe checkout creation for accelerator purchase |
| `src/lib/actions/enrollment.ts` | Agent actions: enroll_user, get_enrollment_status, check_usage |
| `scripts/seed-diagnostic-rules-m5m6.ts` | Seeds M5/M6 diagnostic rules |
| `src/__tests__/lib/ai/copilot/sub-agents/linkedin-ads-agent.test.ts` | M5 agent prompt tests |
| `src/__tests__/lib/ai/copilot/sub-agents/operating-system-agent.test.ts` | M6 agent prompt tests |
| `src/__tests__/lib/services/accelerator-enrollment.test.ts` | Enrollment service tests |
| `src/__tests__/api/accelerator/enroll.test.ts` | Enrollment route tests |
| `src/__tests__/lib/actions/enrollment.test.ts` | Enrollment action tests |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/types/accelerator.ts` | Add `'linkedin_ads' \| 'operating_system'` to SubAgentType, add M5/M6 DeliverableTypes and MetricKeys |
| `src/lib/ai/copilot/sub-agents/config.ts` | Wire M5/M6 agents, update AGENT_MODULE_MAP, add switch cases |
| `src/lib/services/accelerator-metrics.ts` | Add M5/M6 entries to METRIC_BENCHMARKS |
| `src/lib/actions/index.ts` | Import enrollment actions |
| `src/lib/actions/program.ts` | Add M5/M6 deliverable types to create_deliverable enum |
| `src/lib/actions/metrics.ts` | Add M5/M6 metric keys to get_metric_history enum |
| `src/server/services/stripe.service.ts` | Handle accelerator checkout.session.completed |
| `src/app/api/copilot/chat/route.ts` | Add enrollment access check before processing |
| `src/app/api/stripe/webhook/route.ts` | No change (delegates to stripe.service) |
| `scripts/seed-sops.ts` | Already has M5/M6 dirs (no change needed) |

### Test Files

| Test File | Covers |
|-----------|--------|
| `src/__tests__/lib/ai/copilot/sub-agents/linkedin-ads-agent.test.ts` | M5 prompt builder |
| `src/__tests__/lib/ai/copilot/sub-agents/operating-system-agent.test.ts` | M6 prompt builder |
| `src/__tests__/lib/services/accelerator-enrollment.test.ts` | Enrollment service |
| `src/__tests__/api/accelerator/enroll.test.ts` | Enrollment API route |
| `src/__tests__/lib/actions/enrollment.test.ts` | Enrollment + usage actions |

---

## Chunk 1: Types + M5/M6 Agents

### Task 1: Expand Accelerator Types for Phase 4

**Files:**
- Modify: `src/lib/types/accelerator.ts`

- [ ] **Step 1: Read the current types file**

Read `src/lib/types/accelerator.ts` fully.

- [ ] **Step 2: Add M5/M6 SubAgentType variants**

In the `SubAgentType` union, add `'linkedin_ads'` and `'operating_system'`:

```typescript
export type SubAgentType =
  | 'icp'
  | 'lead_magnet'
  | 'content'
  | 'tam'
  | 'outreach'
  | 'troubleshooter'
  | 'linkedin_ads'
  | 'operating_system';
```

- [ ] **Step 3: Add M5/M6 DeliverableTypes**

In the `DeliverableType` union, add after `'diagnostic_report'`:

```typescript
export type DeliverableType =
  | 'icp_definition'
  | 'lead_magnet'
  | 'funnel'
  | 'email_sequence'
  | 'tam_list'
  | 'outreach_campaign'
  | 'tam_segment'
  | 'dm_campaign'
  | 'email_campaign'
  | 'email_infrastructure'
  | 'content_plan'
  | 'post_drafts'
  | 'metrics_digest'
  | 'diagnostic_report'
  | 'ad_campaign'
  | 'ad_targeting'
  | 'weekly_ritual'
  | 'operating_playbook';
```

- [ ] **Step 4: Add M5/M6 MetricKeys**

In the `MetricKey` union, add after `'funnel_page_views'`:

```typescript
export type MetricKey =
  | 'email_sent'
  | 'email_open_rate'
  | 'email_reply_rate'
  | 'email_bounce_rate'
  | 'dm_sent'
  | 'dm_acceptance_rate'
  | 'dm_reply_rate'
  | 'tam_size'
  | 'tam_email_coverage'
  | 'content_posts_published'
  | 'content_avg_impressions'
  | 'content_avg_engagement'
  | 'funnel_opt_in_rate'
  | 'funnel_page_views'
  | 'ads_spend'
  | 'ads_cpl'
  | 'ads_ctr'
  | 'ads_roas'
  | 'os_weekly_reviews'
  | 'os_daily_sessions';
```

- [ ] **Step 5: Add AcceleratorDisplayHint for enrollment**

In the `AcceleratorDisplayHint` union, add `'enrollment_card'`:

```typescript
export type AcceleratorDisplayHint =
  | 'task_board'
  | 'deliverable_card'
  | 'approval_card'
  | 'quality_check'
  | 'metrics_card'
  | 'onboarding_intake'
  | 'enrollment_card';
```

Also add `'enrollment_card'` to the `displayHint` union in `src/lib/actions/types.ts`.

- [ ] **Step 6: Run typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/accelerator.ts src/lib/actions/types.ts
git commit -m "feat(accelerator): expand types for Phase 4 — M5/M6 agents, billing, enrollment"
```

---

### Task 2: LinkedIn Ads Agent (M5) — Tests + Implementation

**Files:**
- Create: `src/__tests__/lib/ai/copilot/sub-agents/linkedin-ads-agent.test.ts`
- Create: `src/lib/ai/copilot/sub-agents/linkedin-ads-agent.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */

import { buildLinkedInAdsAgentPrompt } from '@/lib/ai/copilot/sub-agents/linkedin-ads-agent';

describe('buildLinkedInAdsAgentPrompt', () => {
  const baseSops = [
    { title: 'SOP 5.1: Campaign Strategy', content: 'Define campaign objective...', quality_bars: [] },
    { title: 'SOP 5.2: Audience Targeting', content: 'Build matched audiences...', quality_bars: [] },
  ];

  const baseContext = {
    intake_data: {
      business_description: 'B2B SaaS for agencies',
      target_audience: 'Agency owners',
      revenue_range: 'under_5k' as const,
      linkedin_frequency: 'daily' as const,
      channels_of_interest: ['LinkedIn Ads'],
      primary_goal: 'Generate leads via ads',
    },
    coaching_mode: 'guide_me' as const,
  };

  it('includes identity section', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('LinkedIn Ads specialist');
    expect(prompt).toContain('GTM Accelerator');
  });

  it('includes do_it coaching mode', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, {
      ...baseContext,
      coaching_mode: 'do_it',
    });
    expect(prompt).toContain('Mode: Do It For Me');
    expect(prompt).toContain('campaign structure');
  });

  it('includes guide_me coaching mode', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Mode: Guide Me');
  });

  it('includes teach_me coaching mode', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, {
      ...baseContext,
      coaching_mode: 'teach_me',
    });
    expect(prompt).toContain('Mode: Teach Me');
    expect(prompt).toContain('auction');
  });

  it('includes campaign strategy section', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Campaign Strategy');
    expect(prompt).toContain('Lead Gen Form');
  });

  it('includes audience targeting section', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Audience Targeting');
    expect(prompt).toContain('Matched Audiences');
  });

  it('includes budget optimization section', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Budget');
    expect(prompt).toContain('$50/day');
  });

  it('includes A/B testing section', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('A/B');
    expect(prompt).toContain('creative');
  });

  it('includes user context when intake data present', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('B2B SaaS for agencies');
    expect(prompt).toContain('Agency owners');
  });

  it('omits user context section when no intake data', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, {
      ...baseContext,
      intake_data: null,
    });
    expect(prompt).not.toContain('User Context');
  });

  it('includes SOPs when provided', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('SOP 5.1: Campaign Strategy');
    expect(prompt).toContain('Define campaign objective');
  });

  it('handles empty SOPs', () => {
    const prompt = buildLinkedInAdsAgentPrompt([], baseContext);
    expect(prompt).not.toContain('Module SOPs');
  });

  it('includes output protocol with correct module and deliverable types', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('"module_id": "m5"');
    expect(prompt).toContain('"ad_campaign"');
    expect(prompt).toContain('"ad_targeting"');
  });

  it('includes metric interpretation guidance', () => {
    const prompt = buildLinkedInAdsAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('CTR');
    expect(prompt).toContain('CPL');
    expect(prompt).toContain('ROAS');
  });
});
```

- [ ] **Step 2: Run tests (should fail — module not found)**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="linkedin-ads-agent" --no-coverage
```

- [ ] **Step 3: Implement the agent**

```typescript
/** LinkedIn Ads Agent (M5).
 *  Guides users through LinkedIn Campaign Manager setup, audience targeting,
 *  budget optimization, A/B creative testing, and metric interpretation.
 *  LinkedIn Ads API is NOT integrated — all guidance is manual/guided.
 *  Never imports NextRequest, NextResponse, or cookies. */

import type { IntakeData, CoachingMode } from '@/lib/types/accelerator';

// ─── Types ──────────────────────────────────────────────

interface SopData {
  title: string;
  content: string;
  quality_bars: unknown[];
}

interface UserContext {
  intake_data: IntakeData | null;
  coaching_mode: CoachingMode;
}

// ─── Prompt Builder ─────────────────────────────────────

export function buildLinkedInAdsAgentPrompt(sops: SopData[], ctx: UserContext): string {
  const sections: string[] = [];

  // ─── Identity ─────────────────────────────────────────
  sections.push(`You are the LinkedIn Ads specialist in the GTM Accelerator program.
Your job is to help the user set up and optimize LinkedIn advertising campaigns. You guide them through LinkedIn Campaign Manager — you do NOT have API access to LinkedIn Ads, so all setup is manual with your step-by-step guidance.`);

  // ─── Coaching Mode ────────────────────────────────────
  if (ctx.coaching_mode === 'do_it') {
    sections.push(`## Mode: Do It For Me
Generate the complete campaign structure, targeting criteria, ad copy, and budget plan.
Present each as a deliverable for the user to copy into LinkedIn Campaign Manager.
Provide exact click-by-click instructions for each setup step.`);
  } else if (ctx.coaching_mode === 'guide_me') {
    sections.push(`## Mode: Guide Me
Walk through each step together. Explain what you're configuring and why.
Ask clarifying questions about their ICP before defining audiences.
Review their Campaign Manager setup at each checkpoint.`);
  } else {
    sections.push(`## Mode: Teach Me
Explain how the LinkedIn Ads auction works, why certain targeting is better,
and the economics behind CPL, CTR, and ROAS. Help the user build intuition
for when ads make sense vs. organic + outreach.
Quiz them on targeting logic before building audiences.`);
  }

  // ─── Campaign Strategy ────────────────────────────────
  sections.push(`## Campaign Strategy

### Objective Selection
LinkedIn offers several campaign objectives. For B2B lead generation:
- **Lead Gen Form** (recommended): Native forms with pre-filled LinkedIn data. Highest conversion, lowest friction.
- **Website Visits**: Drive to landing page/funnel. Better for content-heavy offers.
- **Engagement**: Boost content visibility. Good for warming audiences before direct campaigns.

### Campaign Structure
Always follow this hierarchy:
1. **Campaign Group** = One per offer/funnel (e.g., "Blueprint Lead Magnet")
2. **Campaign** = One per audience segment (e.g., "Agency Owners - US")
3. **Ads** = 2-3 variations per campaign for A/B testing

### Ad Format Priority
1. **Single Image** — fastest to produce, easiest to A/B test
2. **Document Ads** (carousel) — higher engagement, good for frameworks
3. **Video** — highest engagement but most production effort
4. **Text Ads** — cheap but low volume, good for retargeting`);

  // ─── Audience Targeting ───────────────────────────────
  sections.push(`## Audience Targeting

### Core Targeting (from ICP)
Build audiences using these LinkedIn targeting dimensions:
- **Job Title**: Exact titles from ICP (not job function — too broad)
- **Company Size**: Match ICP company size bands
- **Industry**: 2-3 primary industries max
- **Seniority**: Director+ for decision makers, Manager for influencers
- **Geography**: Start narrow (1-2 countries), expand if CPL allows

### Matched Audiences (advanced)
- **Website retargeting**: Install LinkedIn Insight Tag, retarget visitors
- **Contact list upload**: Upload TAM list emails for direct targeting
- **Lookalike audiences**: Build from best customers or highest-engagement contacts
- **Engagement retargeting**: Target people who engaged with previous ads or company page

### Audience Size Guidelines
- Minimum: 20,000 (below this, delivery is inconsistent)
- Sweet spot: 50,000-300,000
- Maximum: Don't go above 500,000 (too broad, CPL increases)

### Exclusions (critical)
- ALWAYS exclude current customers
- ALWAYS exclude competitors
- ALWAYS exclude your own employees`);

  // ─── Budget Optimization ──────────────────────────────
  sections.push(`## Budget & Bidding

### Starting Budget
- **Minimum test budget**: $50/day per campaign ($1,500/month)
- **Recommended starting**: $100/day ($3,000/month) for meaningful data
- **Scale phase**: $200+/day only after proven CPL

### Bidding Strategy
- **Start with**: Maximum delivery (let LinkedIn optimize)
- **After 1000 impressions**: Switch to manual CPC if CPL too high
- **Target CPC**: $8-15 for B2B (varies by audience competition)

### Budget Rules
- Never change budget by more than 20% in a single day
- Let campaigns run 7 days minimum before judging performance
- Pause underperforming ads (CTR < 0.3%) after 1000 impressions
- Scale winning ads by duplicating campaigns, not increasing budget`);

  // ─── A/B Testing ──────────────────────────────────────
  sections.push(`## A/B Creative Testing

### What to Test (in priority order)
1. **Headlines**: Test value prop vs. curiosity vs. social proof
2. **Images**: Test person photo vs. graphic vs. screenshot
3. **CTA copy**: Test action verbs (Get, Download, Learn, See)
4. **Ad format**: Test single image vs. document ad

### Testing Rules
- Only test ONE variable at a time
- Each variation needs minimum 1,000 impressions before declaring winner
- Winner = highest CTR with acceptable CPL
- Kill losers after 2,000 impressions if CTR < 0.3%
- Never run more than 3 variations per campaign simultaneously`);

  // ─── Metric Interpretation ────────────────────────────
  sections.push(`## Metric Interpretation

### Key Metrics & Benchmarks
| Metric | Poor | Average | Good |
|--------|------|---------|------|
| CTR (Click-Through Rate) | < 0.3% | 0.3-0.6% | > 0.6% |
| CPL (Cost Per Lead) | > $150 | $50-150 | < $50 |
| CPC (Cost Per Click) | > $15 | $8-15 | < $8 |
| ROAS (Return on Ad Spend) | < 1x | 1-3x | > 3x |
| Conversion Rate (form) | < 5% | 5-15% | > 15% |

### Diagnostic Framework
- **High impressions, low CTR**: Creative problem — test new headlines/images
- **Good CTR, low conversions**: Landing page problem or form too long
- **Good CTR, high CPL**: Audience too competitive — narrow targeting
- **Low impressions**: Audience too small or bid too low — expand or increase budget`);

  // ─── User Context ─────────────────────────────────────
  if (ctx.intake_data) {
    const intake = ctx.intake_data;
    sections.push(`## User Context
Business: ${intake.business_description || 'Not provided'}
Target Audience: ${intake.target_audience || 'Not provided'}
Primary Goal: ${intake.primary_goal || 'Not provided'}`);
  }

  // ─── SOPs ─────────────────────────────────────────────
  if (sops.length > 0) {
    sections.push('## Module SOPs (Reference)');
    for (const sop of sops) {
      sections.push(
        `### ${sop.title}\n${sop.content.slice(0, 500)}${sop.content.length > 500 ? '...' : ''}`
      );
    }
  }

  // ─── Output Protocol ──────────────────────────────────
  sections.push(`## Output Protocol
When you complete campaign setup deliverables, create them:
- type: "ad_campaign" for the complete campaign configuration
- type: "ad_targeting" for audience targeting definitions

Report progress via update_module_progress with module_id="m5".

When finished, return a handoff JSON block:
\`\`\`json
{
  "deliverables_created": [{"type": "ad_campaign"}, {"type": "ad_targeting"}],
  "progress_updates": [{"module_id": "m5", "step": "campaign_launched"}],
  "validation_results": [],
  "needs_escalation": false,
  "summary": "Campaign structure defined: X campaigns, Y audiences, Z ad variations"
}
\`\`\``);

  return sections.join('\n\n');
}
```

- [ ] **Step 4: Run tests (should pass)**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="linkedin-ads-agent" --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/copilot/sub-agents/linkedin-ads-agent.ts src/__tests__/lib/ai/copilot/sub-agents/linkedin-ads-agent.test.ts
git commit -m "feat(accelerator): add M5 LinkedIn Ads agent prompt + tests"
```

---

### Task 3: Operating System Agent (M6) — Tests + Implementation

**Files:**
- Create: `src/__tests__/lib/ai/copilot/sub-agents/operating-system-agent.test.ts`
- Create: `src/lib/ai/copilot/sub-agents/operating-system-agent.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */

import { buildOperatingSystemAgentPrompt } from '@/lib/ai/copilot/sub-agents/operating-system-agent';

describe('buildOperatingSystemAgentPrompt', () => {
  const baseSops = [
    { title: 'SOP 6.1: Weekly Review Ritual', content: 'Every Friday, review pipeline...', quality_bars: [] },
    { title: 'SOP 6.2: Daily Standup', content: 'Start each day with 15-min review...', quality_bars: [] },
  ];

  const baseContext = {
    intake_data: {
      business_description: 'B2B consulting firm',
      target_audience: 'VP Sales at mid-market',
      revenue_range: '5k_10k' as const,
      linkedin_frequency: 'weekly' as const,
      channels_of_interest: ['LinkedIn', 'Cold Email'],
      primary_goal: 'Systematize outreach',
    },
    coaching_mode: 'guide_me' as const,
  };

  it('includes identity section', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Operating System specialist');
    expect(prompt).toContain('GTM Accelerator');
  });

  it('includes do_it coaching mode', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, {
      ...baseContext,
      coaching_mode: 'do_it',
    });
    expect(prompt).toContain('Mode: Do It For Me');
  });

  it('includes guide_me coaching mode', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Mode: Guide Me');
  });

  it('includes teach_me coaching mode', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, {
      ...baseContext,
      coaching_mode: 'teach_me',
    });
    expect(prompt).toContain('Mode: Teach Me');
    expect(prompt).toContain('compound');
  });

  it('includes daily rhythm section', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Daily Rhythm');
    expect(prompt).toContain('morning');
  });

  it('includes weekly review section', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Weekly Review');
    expect(prompt).toContain('pipeline');
  });

  it('includes pipeline review cadence section', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Pipeline Review');
    expect(prompt).toContain('stage');
  });

  it('includes metrics dashboard section', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('Metrics Dashboard');
    expect(prompt).toContain('KPI');
  });

  it('includes user context when intake data present', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('B2B consulting firm');
    expect(prompt).toContain('VP Sales at mid-market');
  });

  it('omits user context section when no intake data', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, {
      ...baseContext,
      intake_data: null,
    });
    expect(prompt).not.toContain('User Context');
  });

  it('includes SOPs when provided', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('SOP 6.1: Weekly Review Ritual');
    expect(prompt).toContain('Every Friday, review pipeline');
  });

  it('handles empty SOPs', () => {
    const prompt = buildOperatingSystemAgentPrompt([], baseContext);
    expect(prompt).not.toContain('Module SOPs');
  });

  it('includes output protocol with correct module and deliverable types', () => {
    const prompt = buildOperatingSystemAgentPrompt(baseSops, baseContext);
    expect(prompt).toContain('"module_id": "m6"');
    expect(prompt).toContain('"weekly_ritual"');
    expect(prompt).toContain('"operating_playbook"');
  });
});
```

- [ ] **Step 2: Run tests (should fail — module not found)**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="operating-system-agent" --no-coverage
```

- [ ] **Step 3: Implement the agent**

```typescript
/** Operating System Agent (M6).
 *  Helps users build GTM operating rhythms: daily standups, weekly reviews,
 *  pipeline review cadences, metrics dashboards, and operating playbooks.
 *  This is about business operating rhythms, NOT computer operating systems.
 *  Never imports NextRequest, NextResponse, or cookies. */

import type { IntakeData, CoachingMode } from '@/lib/types/accelerator';

// ─── Types ──────────────────────────────────────────────

interface SopData {
  title: string;
  content: string;
  quality_bars: unknown[];
}

interface UserContext {
  intake_data: IntakeData | null;
  coaching_mode: CoachingMode;
}

// ─── Prompt Builder ─────────────────────────────────────

export function buildOperatingSystemAgentPrompt(sops: SopData[], ctx: UserContext): string {
  const sections: string[] = [];

  // ─── Identity ─────────────────────────────────────────
  sections.push(`You are the Operating System specialist in the GTM Accelerator program.
Your job is to help the user build a repeatable GTM operating rhythm — daily habits, weekly reviews, pipeline management cadences, and metrics dashboards that keep their go-to-market machine running consistently.`);

  // ─── Coaching Mode ────────────────────────────────────
  if (ctx.coaching_mode === 'do_it') {
    sections.push(`## Mode: Do It For Me
Generate the complete operating playbook: daily checklist, weekly review template,
pipeline review framework, and metrics dashboard specification.
Present each as a deliverable ready to implement.`);
  } else if (ctx.coaching_mode === 'guide_me') {
    sections.push(`## Mode: Guide Me
Walk through each operating rhythm together. Help the user customize templates
to their specific workflow. Ask about their current habits before prescribing new ones.
Build incrementally — start with the daily rhythm, then add weekly and monthly.`);
  } else {
    sections.push(`## Mode: Teach Me
Explain why operating rhythms matter and how they compound over time.
Cover the science of habit formation, the impact of consistency on pipeline velocity,
and how top performers structure their days and weeks.
Help the user understand the "why" before building the "what".`);
  }

  // ─── Daily Rhythm ─────────────────────────────────────
  sections.push(`## Daily Rhythm (The GTM Morning Routine)

Every day should start with a 15-20 minute GTM session:

### Morning Block (15-20 min)
1. **Check replies** (5 min): Review LinkedIn DM replies + email replies. Respond to warm leads immediately.
2. **Send outreach** (5 min): Execute daily outreach quota (DMs, connection requests, cold emails).
3. **Publish content** (5 min): Post or schedule today's LinkedIn content.
4. **Log metrics** (2 min): Update daily tracker with sends, replies, meetings booked.

### End-of-Day Review (5 min)
1. Log any meetings booked
2. Note any replies that need follow-up tomorrow
3. Check if daily quotas were met

### Daily Targets (Baseline)
| Activity | Minimum | Target |
|----------|---------|--------|
| LinkedIn DMs | 10 | 20 |
| Connection Requests | 15 | 25 |
| Cold Emails | 20 | 30 |
| Content Posts | 1 | 1 |
| Reply Response Time | < 4 hours | < 1 hour |`);

  // ─── Weekly Review ────────────────────────────────────
  sections.push(`## Weekly Review (Friday Power Hour)

Block 60 minutes every Friday for the weekly GTM review:

### Agenda Template
1. **Metrics Review** (15 min)
   - Compare this week vs. last week vs. benchmarks
   - Flag any metrics trending below benchmark
   - Celebrate wins (above-benchmark metrics)

2. **Pipeline Review** (20 min)
   - Review every active deal by stage
   - Identify stuck deals (no activity in 7+ days)
   - Set next actions for each deal

3. **Content Review** (10 min)
   - Which posts performed best this week?
   - What topics resonated?
   - Plan next week's content themes

4. **Next Week Planning** (15 min)
   - Set specific targets for outreach volume
   - Schedule any follow-up meetings
   - Identify any blockers to address

### Weekly Scorecard
Track these 5 numbers every week:
1. Total outreach sent (DMs + emails)
2. Reply rate (replies / sent)
3. Meetings booked
4. Content engagement rate
5. Pipeline value change (+/- from last week)`);

  // ─── Pipeline Review ──────────────────────────────────
  sections.push(`## Pipeline Review Cadence

### Deal Stages
Every prospect moves through these stages:
1. **Cold** — In TAM, no outreach yet
2. **Contacted** — First outreach sent
3. **Engaged** — Replied or connected
4. **Meeting Booked** — Discovery call scheduled
5. **Qualified** — Fits ICP, has budget, has timeline
6. **Proposal Sent** — Pricing/scope delivered
7. **Closed Won** / **Closed Lost**

### Stage Velocity Benchmarks
| Stage Transition | Target Days |
|-----------------|-------------|
| Contacted → Engaged | 3-7 |
| Engaged → Meeting | 5-14 |
| Meeting → Qualified | 1-3 |
| Qualified → Proposal | 3-7 |
| Proposal → Close | 7-21 |

### Stale Deal Rules
- **No activity in 7 days**: Flag for follow-up
- **No activity in 14 days**: Escalate or re-engage
- **No activity in 30 days**: Move to nurture or close lost`);

  // ─── Metrics Dashboard ────────────────────────────────
  sections.push(`## Metrics Dashboard

### Leading Indicators (KPI — track daily/weekly)
These predict future results:
- Daily outreach volume (DMs + emails sent)
- Connection/acceptance rate
- Reply rate
- Content post frequency
- Meetings booked this week

### Lagging Indicators (track monthly)
These confirm results:
- Revenue closed
- Pipeline value
- Customer acquisition cost (CAC)
- Time to first meeting (from first touch)
- Win rate (closed won / proposals sent)

### Dashboard Setup
Create a simple spreadsheet or Notion dashboard with:
- Row per week
- Columns for each leading indicator
- Conditional formatting: green (above target), yellow (at target), red (below)
- Trend arrows showing week-over-week direction`);

  // ─── User Context ─────────────────────────────────────
  if (ctx.intake_data) {
    const intake = ctx.intake_data;
    sections.push(`## User Context
Business: ${intake.business_description || 'Not provided'}
Target Audience: ${intake.target_audience || 'Not provided'}
Primary Goal: ${intake.primary_goal || 'Not provided'}`);
  }

  // ─── SOPs ─────────────────────────────────────────────
  if (sops.length > 0) {
    sections.push('## Module SOPs (Reference)');
    for (const sop of sops) {
      sections.push(
        `### ${sop.title}\n${sop.content.slice(0, 500)}${sop.content.length > 500 ? '...' : ''}`
      );
    }
  }

  // ─── Output Protocol ──────────────────────────────────
  sections.push(`## Output Protocol
When you complete operating system deliverables, create them:
- type: "weekly_ritual" for the weekly review template and daily routine
- type: "operating_playbook" for the complete operating system document

Report progress via update_module_progress with module_id="m6".

When finished, return a handoff JSON block:
\`\`\`json
{
  "deliverables_created": [{"type": "weekly_ritual"}, {"type": "operating_playbook"}],
  "progress_updates": [{"module_id": "m6", "step": "playbook_complete"}],
  "validation_results": [],
  "needs_escalation": false,
  "summary": "Operating playbook created: daily rhythm, weekly review, pipeline cadence, metrics dashboard"
}
\`\`\``);

  return sections.join('\n\n');
}
```

- [ ] **Step 4: Run tests (should pass)**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="operating-system-agent" --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/copilot/sub-agents/operating-system-agent.ts src/__tests__/lib/ai/copilot/sub-agents/operating-system-agent.test.ts
git commit -m "feat(accelerator): add M6 Operating System agent prompt + tests"
```

---

### Task 4: Wire M5/M6 into Config

**Files:**
- Modify: `src/lib/ai/copilot/sub-agents/config.ts`
- Modify: `src/lib/actions/program.ts`
- Modify: `src/lib/actions/metrics.ts`
- Modify: `src/app/api/copilot/chat/route.ts`

- [ ] **Step 1: Read current config.ts**

Read `src/lib/ai/copilot/sub-agents/config.ts` fully.

- [ ] **Step 2: Add imports for M5/M6 agents**

Add after the existing agent imports at the top of config.ts:

```typescript
import { buildLinkedInAdsAgentPrompt } from './linkedin-ads-agent';
import { buildOperatingSystemAgentPrompt } from './operating-system-agent';
```

- [ ] **Step 3: Update AGENT_MODULE_MAP**

Replace the existing `AGENT_MODULE_MAP`:

```typescript
const AGENT_MODULE_MAP: Record<SubAgentType, ModuleId> = {
  icp: 'm0',
  lead_magnet: 'm1',
  content: 'm7',
  tam: 'm2',
  outreach: 'm3', // Covers M3 (LinkedIn) + M4 (Cold Email)
  troubleshooter: 'm0', // Troubleshooter is cross-module, default to m0
  linkedin_ads: 'm5',
  operating_system: 'm6',
};
```

- [ ] **Step 4: Add switch cases for M5/M6**

In the `switch (agentType)` block, add before the `default:` case:

```typescript
    case 'linkedin_ads':
      systemPrompt = buildLinkedInAdsAgentPrompt(sopData, userContext);
      break;
    case 'operating_system':
      systemPrompt = buildOperatingSystemAgentPrompt(sopData, userContext);
      break;
```

- [ ] **Step 5: Update troubleshooter to include M5/M6 modules**

In the `troubleshooter` case, update the module list:

```typescript
      for (const mod of ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'] as const) {
```

- [ ] **Step 6: Update dispatch_sub_agent tool enum in chat route**

Read `src/app/api/copilot/chat/route.ts`. In the `dispatch_sub_agent` tool definition, update the `agent_type` enum:

```typescript
            agent_type: {
              type: 'string',
              enum: ['icp', 'lead_magnet', 'content', 'troubleshooter', 'tam', 'outreach', 'linkedin_ads', 'operating_system'],
              description: 'Which specialist to dispatch',
            },
```

- [ ] **Step 7: Update create_deliverable enum in program.ts**

Read `src/lib/actions/program.ts`. In the `create_deliverable` action parameters, add the new types to the `deliverable_type` enum:

```typescript
      deliverable_type: {
        type: 'string',
        enum: [
          'icp_definition',
          'lead_magnet',
          'funnel',
          'email_sequence',
          'tam_list',
          'tam_segment',
          'outreach_campaign',
          'dm_campaign',
          'email_campaign',
          'email_infrastructure',
          'content_plan',
          'post_drafts',
          'metrics_digest',
          'diagnostic_report',
          'ad_campaign',
          'ad_targeting',
          'weekly_ritual',
          'operating_playbook',
        ],
      },
```

- [ ] **Step 8: Update get_metric_history enum in metrics.ts**

Read `src/lib/actions/metrics.ts`. In the `get_metric_history` action parameters, add M5/M6 metric keys:

```typescript
      metric_key: {
        type: 'string',
        enum: [
          'email_sent',
          'email_open_rate',
          'email_reply_rate',
          'email_bounce_rate',
          'dm_sent',
          'dm_acceptance_rate',
          'dm_reply_rate',
          'tam_size',
          'tam_email_coverage',
          'content_posts_published',
          'content_avg_impressions',
          'content_avg_engagement',
          'funnel_opt_in_rate',
          'funnel_page_views',
          'ads_spend',
          'ads_cpl',
          'ads_ctr',
          'ads_roas',
          'os_weekly_reviews',
          'os_daily_sessions',
        ],
      },
```

- [ ] **Step 9: Run typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck
```

- [ ] **Step 10: Run all tests**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test --no-coverage
```

- [ ] **Step 11: Commit**

```bash
git add src/lib/ai/copilot/sub-agents/config.ts src/lib/actions/program.ts src/lib/actions/metrics.ts src/app/api/copilot/chat/route.ts
git commit -m "feat(accelerator): wire M5/M6 agents into config, actions, and dispatch"
```

---

## Chunk 2: Enrollment + Billing Enforcement

### Task 5: Enrollment Service — Tests + Implementation

**Files:**
- Create: `src/__tests__/lib/services/accelerator-enrollment.test.ts`
- Create: `src/lib/services/accelerator-enrollment.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */

const mockFrom = jest.fn();
jest.mock('@/lib/utils/supabase-server', () => ({
  getSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

function createChain(data: unknown = null, error: unknown = null) {
  const result = { data, error };
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);
  chain.then = jest.fn((resolve: (v: typeof result) => void) => Promise.resolve(resolve(result)));
  return chain;
}

import {
  hasAcceleratorAccess,
  getEnrollmentByPaymentId,
  createPaidEnrollment,
} from '@/lib/services/accelerator-enrollment';

describe('accelerator-enrollment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hasAcceleratorAccess', () => {
    it('returns true when user has active enrollment', async () => {
      mockFrom.mockReturnValue(
        createChain({ id: 'e1', status: 'active' })
      );

      const result = await hasAcceleratorAccess('user-1');
      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('program_enrollments');
    });

    it('returns false when no enrollment exists', async () => {
      mockFrom.mockReturnValue(
        createChain(null, { code: 'PGRST116' })
      );

      const result = await hasAcceleratorAccess('user-2');
      expect(result).toBe(false);
    });

    it('returns false on database error', async () => {
      mockFrom.mockReturnValue(
        createChain(null, { code: 'UNKNOWN', message: 'DB error' })
      );

      const result = await hasAcceleratorAccess('user-3');
      expect(result).toBe(false);
    });
  });

  describe('getEnrollmentByPaymentId', () => {
    it('returns enrollment when found', async () => {
      const enrollment = { id: 'e1', stripe_customer_id: 'cus_123', status: 'active' };
      mockFrom.mockReturnValue(createChain(enrollment));

      const result = await getEnrollmentByPaymentId('pi_123');
      expect(result).toEqual(enrollment);
    });

    it('returns null when not found', async () => {
      mockFrom.mockReturnValue(createChain(null, { code: 'PGRST116' }));

      const result = await getEnrollmentByPaymentId('pi_not_found');
      expect(result).toBeNull();
    });
  });

  describe('createPaidEnrollment', () => {
    it('creates enrollment with all modules and stripe fields', async () => {
      const enrollment = {
        id: 'e1',
        user_id: 'user-1',
        status: 'active',
        selected_modules: ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'],
        stripe_customer_id: 'cus_123',
      };

      // First call: insert enrollment
      const insertChain = createChain(enrollment);
      // Second call: insert module rows
      const moduleChain = createChain([]);

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? insertChain : moduleChain;
      });

      const result = await createPaidEnrollment('user-1', 'cus_123', 'pi_123');
      expect(result).toEqual(enrollment);
    });

    it('returns null on insert error', async () => {
      mockFrom.mockReturnValue(
        createChain(null, { message: 'Unique constraint' })
      );

      const result = await createPaidEnrollment('user-1', 'cus_123', 'pi_123');
      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests (should fail — module not found)**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="accelerator-enrollment" --no-coverage
```

- [ ] **Step 3: Implement the service**

```typescript
/** Accelerator Enrollment Service.
 *  Creates enrollments from Stripe payments, checks access.
 *  Separate from accelerator-program.ts to keep billing logic isolated.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import type { ProgramEnrollment, ModuleId, ModuleStatus } from '@/lib/types/accelerator';
import { MODULE_IDS, ENROLLMENT_COLUMNS } from '@/lib/types/accelerator';

const LOG_CTX = 'accelerator-enrollment';

// ─── Constants ──────────────────────────────────────────

/** All modules included in the accelerator purchase. */
const ALL_MODULES: ModuleId[] = [...MODULE_IDS];

/** Stripe product ID for the accelerator. Set via env var. */
export const ACCELERATOR_STRIPE_PRODUCT_ID = process.env.ACCELERATOR_STRIPE_PRODUCT_ID || '';

/** Stripe price ID for the accelerator. Set via env var. */
export const ACCELERATOR_STRIPE_PRICE_ID = process.env.ACCELERATOR_STRIPE_PRICE_ID || '';

// ─── Access Check ───────────────────────────────────────

/** Check if a user has an active accelerator enrollment. */
export async function hasAcceleratorAccess(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('program_enrollments')
    .select('id, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return false; // not found
    logError(LOG_CTX, error, { userId });
    return false;
  }

  return !!data;
}

// ─── Read ───────────────────────────────────────────────

/** Look up an enrollment by its Stripe payment intent ID (stored in intake_data). */
export async function getEnrollmentByPaymentId(
  paymentIntentId: string
): Promise<ProgramEnrollment | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('program_enrollments')
    .select(ENROLLMENT_COLUMNS)
    .eq('stripe_subscription_id', paymentIntentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logError(LOG_CTX, error, { paymentIntentId });
    return null;
  }

  return data;
}

// ─── Create ─────────────────────────────────────────────

/** Create a paid enrollment with all modules unlocked. */
export async function createPaidEnrollment(
  userId: string,
  stripeCustomerId: string,
  paymentIntentId: string
): Promise<ProgramEnrollment | null> {
  const supabase = getSupabaseAdminClient();

  const { data: enrollment, error: enrollError } = await supabase
    .from('program_enrollments')
    .insert({
      user_id: userId,
      selected_modules: ALL_MODULES,
      coaching_mode: 'guide_me',
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: paymentIntentId, // reusing field for payment intent ID
      status: 'active',
    })
    .select(ENROLLMENT_COLUMNS)
    .single();

  if (enrollError || !enrollment) {
    logError(LOG_CTX, enrollError, { userId, stripeCustomerId });
    return null;
  }

  // Create module rows for all modules
  const moduleRows = ALL_MODULES.map((moduleId) => ({
    enrollment_id: enrollment.id,
    module_id: moduleId,
    status: 'not_started' as ModuleStatus,
  }));

  const { error: modError } = await supabase.from('program_modules').insert(moduleRows);

  if (modError) {
    logError(LOG_CTX, modError, { enrollmentId: enrollment.id });
    // Non-fatal: enrollment exists, modules can be created later
  }

  return enrollment;
}
```

- [ ] **Step 4: Run tests (should pass)**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="accelerator-enrollment" --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/accelerator-enrollment.ts src/__tests__/lib/services/accelerator-enrollment.test.ts
git commit -m "feat(accelerator): add enrollment service — access check + paid enrollment creation"
```

---

### Task 6: Accelerator Enrollment API Route — Tests + Implementation

**Files:**
- Create: `src/__tests__/api/accelerator/enroll.test.ts`
- Create: `src/app/api/accelerator/enroll/route.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */

import { POST } from '@/app/api/accelerator/enroll/route';

// Mock auth
const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

// Mock stripe integration
const mockGetOrCreateCustomer = jest.fn();
const mockCreateCheckoutSession = jest.fn();
jest.mock('@/lib/integrations/stripe', () => ({
  getOrCreateCustomer: (...args: unknown[]) => mockGetOrCreateCustomer(...args),
  createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args),
}));

// Mock enrollment service
const mockHasAccess = jest.fn();
jest.mock('@/lib/services/accelerator-enrollment', () => ({
  hasAcceleratorAccess: (...args: unknown[]) => mockHasAccess(...args),
  ACCELERATOR_STRIPE_PRICE_ID: 'price_test_accel',
}));

// Mock Supabase (for subscription lookup)
jest.mock('@/lib/utils/supabase-server', () => ({
  getSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    })),
  })),
}));

// Mock API errors
jest.mock('@/lib/api/errors', () => ({
  ApiErrors: {
    unauthorized: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    validationError: (msg: string) =>
      new Response(JSON.stringify({ error: msg }), { status: 400 }),
    internalError: (msg: string) =>
      new Response(JSON.stringify({ error: msg }), { status: 500 }),
  },
  logApiError: jest.fn(),
}));

function makeRequest(body: Record<string, unknown> = {}): Request {
  return new Request('http://localhost:3000/api/accelerator/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/accelerator/enroll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(makeRequest());
    expect(response.status).toBe(401);
  });

  it('returns 400 when user already has access', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
    });
    mockHasAccess.mockResolvedValue(true);

    const response = await POST(makeRequest());
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('already enrolled');
  });

  it('creates checkout session for new user', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
    });
    mockHasAccess.mockResolvedValue(false);
    mockGetOrCreateCustomer.mockResolvedValue({ id: 'cus_123' });
    mockCreateCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/session_123',
    });

    const response = await POST(makeRequest());
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.url).toContain('checkout.stripe.com');
  });

  it('passes correct metadata to checkout session', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
    });
    mockHasAccess.mockResolvedValue(false);
    mockGetOrCreateCustomer.mockResolvedValue({ id: 'cus_123' });
    mockCreateCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.com/x' });

    await POST(makeRequest());

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          userId: 'user-1',
          product: 'accelerator',
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run tests (should fail — route not found)**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="accelerator/enroll" --no-coverage
```

- [ ] **Step 3: Implement the route**

```typescript
// POST /api/accelerator/enroll — create Stripe checkout for accelerator purchase

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getOrCreateCustomer, createCheckoutSession } from '@/lib/integrations/stripe';
import {
  hasAcceleratorAccess,
  ACCELERATOR_STRIPE_PRICE_ID,
} from '@/lib/services/accelerator-enrollment';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) return ApiErrors.unauthorized();

    const userId = session.user.id;

    // Check if already enrolled
    const alreadyEnrolled = await hasAcceleratorAccess(userId);
    if (alreadyEnrolled) {
      return ApiErrors.validationError('You are already enrolled in the GTM Accelerator.');
    }

    if (!ACCELERATOR_STRIPE_PRICE_ID) {
      logApiError('accelerator/enroll', new Error('ACCELERATOR_STRIPE_PRICE_ID not configured'));
      return ApiErrors.internalError('Accelerator purchase is not configured.');
    }

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer(
      userId,
      session.user.email,
      session.user.name ?? undefined
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create one-time payment checkout (mode: 'payment', not 'subscription')
    const checkoutSession = await createCheckoutSession({
      customerId: customer.id,
      priceId: ACCELERATOR_STRIPE_PRICE_ID,
      successUrl: `${appUrl}/accelerator?enrolled=success`,
      cancelUrl: `${appUrl}/accelerator?enrolled=canceled`,
      metadata: {
        userId,
        product: 'accelerator',
      },
      mode: 'payment',
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    logApiError('accelerator/enroll', error);
    return ApiErrors.internalError('Failed to create checkout session.');
  }
}
```

**Note:** The `createCheckoutSession` helper in `src/lib/integrations/stripe.ts` currently defaults to `mode: 'subscription'`. You will need to add an optional `mode` parameter to its interface. Read the file and add:

In the `CreateCheckoutParams` interface (or equivalent), add:

```typescript
mode?: 'payment' | 'subscription';
```

And in the `createCheckoutSession` function body, use:

```typescript
mode: params.mode || 'subscription',
```

- [ ] **Step 4: Run tests (should pass)**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="accelerator/enroll" --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/accelerator/enroll/route.ts src/__tests__/api/accelerator/enroll.test.ts src/lib/integrations/stripe.ts
git commit -m "feat(accelerator): add enrollment API route — Stripe checkout for one-time purchase"
```

---

### Task 7: Stripe Webhook Handler for Accelerator Checkout Completion

**Files:**
- Modify: `src/server/services/stripe.service.ts`

- [ ] **Step 1: Read current stripe.service.ts**

Read `src/server/services/stripe.service.ts` fully.

- [ ] **Step 2: Add accelerator enrollment import**

Add at the top of stripe.service.ts:

```typescript
import {
  createPaidEnrollment,
  ACCELERATOR_STRIPE_PRODUCT_ID,
} from '@/lib/services/accelerator-enrollment';
```

- [ ] **Step 3: Extend handleWebhookEvent for accelerator checkout**

In the `handleWebhookEvent` function, replace the existing `checkout.session.completed` case:

```typescript
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      // Check if this is an accelerator purchase (one-time payment)
      if (
        session.mode === 'payment' &&
        session.metadata?.product === 'accelerator' &&
        session.metadata?.userId
      ) {
        const userId = session.metadata.userId;
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : (session.customer as Stripe.Customer)?.id || '';
        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent as Stripe.PaymentIntent)?.id || '';

        await createPaidEnrollment(userId, customerId, paymentIntentId);

        try {
          getPostHogServerClient()?.capture({
            distinctId: userId,
            event: 'accelerator_enrolled',
            properties: { payment_intent: paymentIntentId },
          });
        } catch {
          // PostHog capture must never affect the webhook flow
        }
      }
      // Subscription checkouts are handled by subscription.created event
      break;
    }
```

- [ ] **Step 4: Run existing Stripe webhook tests (should still pass)**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="stripe/webhook" --no-coverage
```

- [ ] **Step 5: Run typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/server/services/stripe.service.ts
git commit -m "feat(accelerator): handle accelerator checkout.session.completed in Stripe webhook"
```

---

### Task 8: Enrollment Access Gate in Copilot Chat Route

**Files:**
- Modify: `src/app/api/copilot/chat/route.ts`

- [ ] **Step 1: Read current chat route**

Read `src/app/api/copilot/chat/route.ts` fully.

- [ ] **Step 2: Add enrollment check**

Add import at top:

```typescript
import { hasAcceleratorAccess } from '@/lib/services/accelerator-enrollment';
```

After the auth check (`if (!session?.user?.id)`) and before the conversation creation, add the enrollment gate:

```typescript
    // ─── Enrollment Access Check ────────────────────────
    // Accelerator features require a paid enrollment.
    // Non-accelerator copilot usage (page-context help) is not gated.
    const isAcceleratorRequest =
      body.message?.toLowerCase().includes('accelerator') ||
      body.message?.toLowerCase().includes('module') ||
      body.pageContext?.page?.includes('accelerator');

    if (isAcceleratorRequest) {
      const hasAccess = await hasAcceleratorAccess(userId);
      if (!hasAccess) {
        return new Response(
          JSON.stringify({
            error: 'GTM Accelerator requires enrollment.',
            code: 'ENROLLMENT_REQUIRED',
            enrollUrl: '/api/accelerator/enroll',
          }),
          { status: 403 }
        );
      }
    }
```

**Design note:** This is a soft gate. The copilot chat still works for non-accelerator help (content pipeline, lead magnets, funnels). The gate only triggers when the user's message or page context indicates accelerator usage. The dispatch_sub_agent tool will also check access internally before dispatching an accelerator agent. This avoids breaking existing copilot functionality for SaaS users who haven't purchased the accelerator.

- [ ] **Step 3: Add enrollment check to sub-agent dispatch**

In the same file, in the `dispatch_sub_agent` handler block, add before the `buildSubAgentConfig` call:

```typescript
                    // Verify enrollment before dispatching accelerator sub-agents
                    const enrollCheck = await import('@/lib/services/accelerator-enrollment');
                    const hasEnrollment = await enrollCheck.hasAcceleratorAccess(userId);
                    if (!hasEnrollment) {
                      result = {
                        success: false,
                        error: 'Accelerator enrollment required. Purchase at /api/accelerator/enroll',
                        displayHint: 'text' as const,
                      };
                    } else {
```

And close the else block after the existing `dispatchSubAgent` call.

- [ ] **Step 4: Run typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/copilot/chat/route.ts
git commit -m "feat(accelerator): add enrollment access gate to copilot chat route"
```

---

## Chunk 3: Metrics + Diagnostics for M5/M6

### Task 9: Add M5/M6 Benchmarks to METRIC_BENCHMARKS

**Files:**
- Modify: `src/lib/services/accelerator-metrics.ts`

- [ ] **Step 1: Read current metrics service**

Read `src/lib/services/accelerator-metrics.ts` fully.

- [ ] **Step 2: Add M5/M6 benchmarks**

Add the following entries to the `METRIC_BENCHMARKS` record:

```typescript
export const METRIC_BENCHMARKS: Record<MetricKey, { low: number; high: number }> = {
  // ... existing entries ...
  email_sent: { low: 20, high: 50 },
  email_open_rate: { low: 40, high: 65 },
  email_reply_rate: { low: 3, high: 10 },
  email_bounce_rate: { low: 0, high: 5 },
  dm_sent: { low: 15, high: 30 },
  dm_acceptance_rate: { low: 30, high: 60 },
  dm_reply_rate: { low: 10, high: 25 },
  tam_size: { low: 500, high: 5000 },
  tam_email_coverage: { low: 40, high: 75 },
  content_posts_published: { low: 3, high: 7 },
  content_avg_impressions: { low: 500, high: 3000 },
  content_avg_engagement: { low: 2, high: 8 },
  funnel_opt_in_rate: { low: 15, high: 40 },
  funnel_page_views: { low: 50, high: 500 },
  // M5: LinkedIn Ads
  ads_spend: { low: 1500, high: 5000 },     // Monthly spend in USD
  ads_cpl: { low: 20, high: 150 },           // Cost per lead in USD (lower is better, but below 20 is unusual)
  ads_ctr: { low: 0.3, high: 1.0 },          // Click-through rate in %
  ads_roas: { low: 1, high: 5 },             // Return on ad spend multiplier
  // M6: Operating System
  os_weekly_reviews: { low: 3, high: 4 },     // Weekly reviews completed per month
  os_daily_sessions: { low: 15, high: 25 },   // Daily GTM sessions per month (out of ~22 work days)
};
```

- [ ] **Step 3: Run typecheck (ensures new MetricKey values are covered)**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck
```

- [ ] **Step 4: Run existing metrics tests**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="accelerator-metrics" --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/accelerator-metrics.ts
git commit -m "feat(accelerator): add M5/M6 metric benchmarks — ads and operating system"
```

---

### Task 10: Seed M5/M6 Diagnostic Rules

**Files:**
- Create: `scripts/seed-diagnostic-rules-m5m6.ts`

- [ ] **Step 1: Write the seed script**

```typescript
/** Seed M5/M6 Diagnostic Rules.
 *  Run: npx tsx scripts/seed-diagnostic-rules-m5m6.ts */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface DiagnosticRuleSeed {
  symptom: string;
  module_id: string;
  metric_key: string | null;
  threshold_operator: string | null;
  threshold_value: number | null;
  diagnostic_questions: string[];
  common_causes: Array<{ cause: string; fix: string; severity: string }>;
  priority: number;
}

const M5_RULES: DiagnosticRuleSeed[] = [
  {
    symptom: 'LinkedIn Ads CTR below 0.3%',
    module_id: 'm5',
    metric_key: 'ads_ctr',
    threshold_operator: '<',
    threshold_value: 0.3,
    diagnostic_questions: [
      'What ad format are you using (single image, carousel, video)?',
      'Does your headline clearly state the value proposition?',
      'Is your audience size between 50K-300K?',
      'Are you running at least 2 ad variations?',
    ],
    common_causes: [
      { cause: 'Weak headline — not specific enough', fix: 'Rewrite headline with concrete outcome or number', severity: 'critical' },
      { cause: 'Audience too broad', fix: 'Narrow targeting: add job title + seniority + industry filters', severity: 'critical' },
      { cause: 'Generic creative', fix: 'Use person photo instead of stock image, add social proof', severity: 'warning' },
    ],
    priority: 10,
  },
  {
    symptom: 'LinkedIn Ads CPL above $150',
    module_id: 'm5',
    metric_key: 'ads_cpl',
    threshold_operator: '>',
    threshold_value: 150,
    diagnostic_questions: [
      'What is your current daily budget per campaign?',
      'Are you using Lead Gen Forms or sending to a landing page?',
      'How many campaigns are running simultaneously?',
      'Have you tested different audiences?',
    ],
    common_causes: [
      { cause: 'Landing page friction', fix: 'Switch to LinkedIn Lead Gen Forms (pre-filled data = higher conversion)', severity: 'critical' },
      { cause: 'Audience too competitive', fix: 'Test smaller niche audiences or lookalike audiences', severity: 'warning' },
      { cause: 'Budget spread too thin', fix: 'Consolidate budget into 1-2 best-performing campaigns', severity: 'warning' },
    ],
    priority: 20,
  },
  {
    symptom: 'LinkedIn Ads ROAS below 1x',
    module_id: 'm5',
    metric_key: 'ads_roas',
    threshold_operator: '<',
    threshold_value: 1,
    diagnostic_questions: [
      'What is your average deal value?',
      'What is your current close rate from ad-generated leads?',
      'Are you following up with ad leads within 24 hours?',
      'Do you have a nurture sequence for ad leads?',
    ],
    common_causes: [
      { cause: 'No follow-up sequence', fix: 'Set up immediate email + LinkedIn DM follow-up for every ad lead', severity: 'critical' },
      { cause: 'Wrong offer for cold traffic', fix: 'Use lead magnet (free value) instead of direct sales pitch', severity: 'critical' },
      { cause: 'Slow follow-up', fix: 'Set up instant notification + response template for new leads', severity: 'warning' },
    ],
    priority: 15,
  },
];

const M6_RULES: DiagnosticRuleSeed[] = [
  {
    symptom: 'Weekly reviews not happening consistently',
    module_id: 'm6',
    metric_key: 'os_weekly_reviews',
    threshold_operator: '<',
    threshold_value: 3,
    diagnostic_questions: [
      'Do you have a recurring calendar block for weekly reviews?',
      'What usually causes you to skip the review?',
      'Do you have a review template/checklist ready?',
      'Is anyone else involved in the review (accountability partner)?',
    ],
    common_causes: [
      { cause: 'No calendar block', fix: 'Block 60 min every Friday 2-3pm — non-negotiable, treat like a client meeting', severity: 'critical' },
      { cause: 'Review feels overwhelming', fix: 'Use the 5-number scorecard: just track 5 metrics, nothing else', severity: 'warning' },
      { cause: 'No accountability', fix: 'Share weekly scorecard with a peer or post in community', severity: 'info' },
    ],
    priority: 10,
  },
  {
    symptom: 'Daily GTM sessions below 15 per month',
    module_id: 'm6',
    metric_key: 'os_daily_sessions',
    threshold_operator: '<',
    threshold_value: 15,
    diagnostic_questions: [
      'Do you have a morning GTM routine scheduled?',
      'What time do you typically start your GTM work?',
      'Is your GTM session the FIRST thing you do or after other work?',
      'How long is your typical daily GTM session?',
    ],
    common_causes: [
      { cause: 'GTM not first priority', fix: 'Move GTM to first 30 min of workday — before email, before Slack', severity: 'critical' },
      { cause: 'Session too long/ambitious', fix: 'Shorten to 15 min: check replies (5), send outreach (5), post content (5)', severity: 'warning' },
      { cause: 'No tracking system', fix: 'Use a simple daily checkbox — just mark done/not done', severity: 'info' },
    ],
    priority: 20,
  },
];

async function seedRules() {
  console.log('Seeding M5/M6 diagnostic rules...\n');
  const allRules = [...M5_RULES, ...M6_RULES];
  let inserted = 0;

  for (const rule of allRules) {
    // Check if rule already exists (by symptom + module_id)
    const { data: existing } = await supabase
      .from('diagnostic_rules')
      .select('id')
      .eq('symptom', rule.symptom)
      .eq('module_id', rule.module_id)
      .single();

    if (existing) {
      console.log(`  Skipping (exists): ${rule.symptom}`);
      continue;
    }

    const { error } = await supabase.from('diagnostic_rules').insert(rule);
    if (error) {
      console.error(`  ERROR: ${rule.symptom} — ${error.message}`);
    } else {
      console.log(`  Inserted: ${rule.symptom}`);
      inserted++;
    }
  }

  console.log(`\nDone! ${inserted} rules inserted.`);
}

seedRules().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed-diagnostic-rules-m5m6.ts
git commit -m "feat(accelerator): add M5/M6 diagnostic rules seed script"
```

---

### Task 11: M5/M6 Metrics Collection Notes

**Design Note (No Code Change):**

LinkedIn Ads metrics are entered manually by users (the M5 agent guides them to check LinkedIn Campaign Manager and report numbers). Operating System metrics (weekly reviews completed, daily sessions logged) are tracked through the existing `program_usage_events` table — when the user starts a session, `session_start` events are recorded, and weekly review completions are tracked via `deliverable_created` events with type `weekly_ritual`.

The existing `accelerator-collect-metrics` Trigger.dev task (from Phase 3) can be extended later to:
1. Count `session_start` events per month for `os_daily_sessions`
2. Count `weekly_ritual` deliverables per month for `os_weekly_reviews`
3. Accept manual ad metric entry via a new `record_ad_metrics` action

This is a future enhancement. For now, M5/M6 metrics are entered through the agent conversation using the existing `record_metrics` infrastructure from Phase 3.

---

## Chunk 4: Actions + Integration

### Task 12: Enrollment + Usage Actions — Tests + Implementation

**Files:**
- Create: `src/__tests__/lib/actions/enrollment.test.ts`
- Create: `src/lib/actions/enrollment.ts`
- Modify: `src/lib/actions/index.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */

jest.mock('@/lib/services/accelerator-enrollment');
jest.mock('@/lib/services/accelerator-program');
jest.mock('@/lib/services/accelerator-usage');

import { getAction } from '@/lib/actions/registry';

// Import the module to trigger registerAction calls
import '@/lib/actions/enrollment';

import { hasAcceleratorAccess } from '@/lib/services/accelerator-enrollment';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';
import { checkUsageAllocation } from '@/lib/services/accelerator-usage';
import type { ProgramEnrollment } from '@/lib/types/accelerator';

const mockHasAccess = hasAcceleratorAccess as jest.MockedFunction<typeof hasAcceleratorAccess>;
const mockGetEnrollment = getEnrollmentByUserId as jest.MockedFunction<typeof getEnrollmentByUserId>;
const mockCheckUsage = checkUsageAllocation as jest.MockedFunction<typeof checkUsageAllocation>;

const ctx = { userId: 'user-1' };

describe('enrollment actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get_enrollment_status', () => {
    it('is registered', () => {
      const action = getAction('get_enrollment_status');
      expect(action).toBeDefined();
      expect(action!.name).toBe('get_enrollment_status');
    });

    it('returns enrolled status when user has access', async () => {
      mockHasAccess.mockResolvedValue(true);
      mockGetEnrollment.mockResolvedValue({
        id: 'e1',
        status: 'active',
        selected_modules: ['m0', 'm1'],
        coaching_mode: 'guide_me',
      } as unknown as ProgramEnrollment);

      const action = getAction('get_enrollment_status')!;
      const result = await action.handler(ctx, {});
      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({ enrolled: true, status: 'active' })
      );
    });

    it('returns not enrolled when no access', async () => {
      mockHasAccess.mockResolvedValue(false);

      const action = getAction('get_enrollment_status')!;
      const result = await action.handler(ctx, {});
      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({ enrolled: false })
      );
    });
  });

  describe('check_usage', () => {
    it('is registered', () => {
      const action = getAction('check_usage');
      expect(action).toBeDefined();
    });

    it('returns usage data for enrolled user', async () => {
      mockGetEnrollment.mockResolvedValue({
        id: 'e1',
        status: 'active',
      } as unknown as ProgramEnrollment);
      mockCheckUsage.mockResolvedValue({
        withinLimits: true,
        usage: { sessions: 5, deliverables: 2, api_calls: 50 },
        limits: { sessions: 30, deliverables: 15, api_calls: 500 },
      });

      const action = getAction('check_usage')!;
      const result = await action.handler(ctx, {});
      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({ withinLimits: true })
      );
    });

    it('returns error when not enrolled', async () => {
      mockGetEnrollment.mockResolvedValue(null);

      const action = getAction('check_usage')!;
      const result = await action.handler(ctx, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('No active enrollment');
    });
  });
});
```

- [ ] **Step 2: Run tests (should fail — module not found)**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="actions/enrollment" --no-coverage
```

- [ ] **Step 3: Implement the actions**

```typescript
/** Enrollment & Usage Actions.
 *  Actions for agents to check enrollment status and usage allocation.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { registerAction } from './registry';
import { hasAcceleratorAccess } from '@/lib/services/accelerator-enrollment';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';
import { checkUsageAllocation } from '@/lib/services/accelerator-usage';

// ─── Read Actions ────────────────────────────────────────

registerAction({
  name: 'get_enrollment_status',
  description:
    "Check if the user is enrolled in the GTM Accelerator. Returns enrollment status, selected modules, and coaching mode.",
  parameters: { properties: {} },
  handler: async (ctx) => {
    const hasAccess = await hasAcceleratorAccess(ctx.userId);
    if (!hasAccess) {
      return {
        success: true,
        data: {
          enrolled: false,
          message: 'Not enrolled in the GTM Accelerator. Purchase at /api/accelerator/enroll.',
        },
        displayHint: 'enrollment_card',
      };
    }

    const enrollment = await getEnrollmentByUserId(ctx.userId);
    return {
      success: true,
      data: {
        enrolled: true,
        status: enrollment?.status || 'active',
        selected_modules: enrollment?.selected_modules || [],
        coaching_mode: enrollment?.coaching_mode || 'guide_me',
        onboarding_completed: !!enrollment?.onboarding_completed_at,
      },
      displayHint: 'enrollment_card',
    };
  },
});

registerAction({
  name: 'check_usage',
  description:
    "Check the user's current usage against their monthly allocation. Shows sessions, deliverables, and API calls used.",
  parameters: { properties: {} },
  handler: async (ctx) => {
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) {
      return { success: false, error: 'No active enrollment found.' };
    }

    const usage = await checkUsageAllocation(enrollment.id);
    return {
      success: true,
      data: usage,
      displayHint: 'metrics_card',
    };
  },
});
```

- [ ] **Step 4: Register in actions index**

Add to `src/lib/actions/index.ts`:

```typescript
import './enrollment';
```

- [ ] **Step 5: Run tests (should pass)**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="actions/enrollment" --no-coverage
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/enrollment.ts src/__tests__/lib/actions/enrollment.test.ts src/lib/actions/index.ts
git commit -m "feat(accelerator): add enrollment + usage actions for agent access"
```

---

### Task 13: Update Config Tool List for Enrollment Actions

**Files:**
- Modify: `src/lib/ai/copilot/sub-agents/config.ts`

- [ ] **Step 1: Read config.ts**

Read `src/lib/ai/copilot/sub-agents/config.ts` fully.

- [ ] **Step 2: Add enrollment actions to relevant tools list**

In the `relevantToolNames` array, add:

```typescript
    'get_enrollment_status',
    'check_usage',
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/copilot/sub-agents/config.ts
git commit -m "feat(accelerator): add enrollment actions to sub-agent tool list"
```

---

### Task 14: E2E Verification — Typecheck + Tests + Build

**Files:** None (verification only)

- [ ] **Step 1: Run full typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck
```

- [ ] **Step 2: Run all tests**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test --no-coverage
```

- [ ] **Step 3: Run build**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm build
```

- [ ] **Step 4: Fix any errors from steps 1-3**

If typecheck or tests fail, fix the issues and re-run. Common issues:
- Missing MetricKey entries in METRIC_BENCHMARKS (TypeScript exhaustiveness)
- Import paths for new modules
- Mock setup in tests not matching new function signatures
- `displayHint` value `'enrollment_card'` not in the union in `types.ts`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix(accelerator): resolve Phase 4 typecheck and test issues"
```

---

## Environment Variables Required

| Variable | Where | Value |
|----------|-------|-------|
| `ACCELERATOR_STRIPE_PRODUCT_ID` | Vercel + .env.local | Create in Stripe Dashboard (one-time product, $997) |
| `ACCELERATOR_STRIPE_PRICE_ID` | Vercel + .env.local | Create in Stripe Dashboard (one-time price, $997) |

### Stripe Product Setup (Manual)

Before testing, create the Stripe product:

1. Go to Stripe Dashboard > Products > Add Product
2. Name: "GTM Accelerator"
3. Pricing: One-time, $997.00
4. Copy the Product ID (`prod_xxx`) to `ACCELERATOR_STRIPE_PRODUCT_ID`
5. Copy the Price ID (`price_xxx`) to `ACCELERATOR_STRIPE_PRICE_ID`
6. Add both to `.env.local` and Vercel environment variables

---

## Summary of Changes

| Area | What Changed |
|------|-------------|
| Types | SubAgentType +2, DeliverableType +4, MetricKey +6, AcceleratorDisplayHint +1 |
| Agents | 2 new agents (linkedin-ads-agent.ts, operating-system-agent.ts) |
| Config | AGENT_MODULE_MAP +2 entries, switch +2 cases, dispatch enum +2 |
| Services | 1 new service (accelerator-enrollment.ts), 1 modified (accelerator-metrics.ts) |
| Routes | 1 new route (/api/accelerator/enroll), 1 modified (copilot/chat — access gate) |
| Actions | 1 new file (enrollment.ts) with 2 actions, 2 modified (program.ts, metrics.ts) |
| Stripe | stripe.service.ts extended for accelerator checkout completion |
| Scripts | 1 new seed script (seed-diagnostic-rules-m5m6.ts) |
| Tests | 5 new test files, 14 tasks total |
