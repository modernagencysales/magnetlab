# Tool-as-Lead-Magnet System — Design

**Date**: 2026-02-27
**Status**: Draft
**Scope**: copy-of-gtm-os (invite codes) + magnetlab (funnels/email sequences)

## Problem

We have 13 AI tools in the bootcamp portal, each valuable enough to serve as a standalone lead magnet. We need magnetlab funnels that capture emails and deliver access to these tools via invite codes. Manual creation of 13 funnels would be tedious and inconsistent.

## Solution

An automation script that programmatically creates, for each AI tool:
1. A shared invite code (unlimited uses, "Lead Magnet" access, 10 credits)
2. A magnetlab lead magnet + funnel page
3. AI-generated email sequence delivering the tool access link
4. Thank-you page with qualification survey + call booking CTA
5. Branding applied from MAS brand kit

## Architecture

```
For each of the 13 AI tools:

┌──────────────┐     ┌───────────────────────────┐     ┌──────────────────┐
│  Opt-in Page │     │  Thank-You Page            │     │  Email Sequence   │
│              │     │                             │     │                  │
│  "Free Post  │     │  Qualification Survey       │     │  Day 0: Welcome  │
│   Generator" │────▶│  ↓                          │     │  + registration  │
│              │     │  Calendly / Book a Call CTA │     │  link with code  │
│  Captures    │     │                             │     │                  │
│  email       │     │                             │     │  Day 1-4:        │
└──────────────┘     └───────────────────────────────┘     │  Nurture +      │
                                                          │  remind of tool │
                                                          └──────────────────┘
                                                                │
                                                                ▼
                                                    ┌──────────────────┐
                                                    │  Bootcamp Portal │
                                                    │  /register?code= │
                                                    │  POSTGEN          │
                                                    │  → 10 credits    │
                                                    └──────────────────┘
```

### Flow

1. Lead visits magnetlab opt-in page (e.g., `magnetlab.app/p/mas/free-post-generator`)
2. Enters email → captured as funnel lead (+ fires webhooks, email provider syncs)
3. Thank-you page shows qualification survey + booking CTA (same as all MAS funnels)
4. Email sequence Day 0 delivers the registration link: `modernagencysales.com/bootcamp/register?code=POSTGEN`
5. Days 1-4 nurture emails reinforce tool value + include registration link
6. Lead registers on bootcamp → gets "Lead Magnet" access + 10 credits for that specific tool

## Tool Catalog (13 tools)

| # | Tool Slug | Lead Magnet Title | Invite Code | Funnel Slug |
|---|-----------|-------------------|-------------|-------------|
| 1 | `offer-generator` | Free AI Offer Generator | `OFFERGEN` | `free-offer-generator` |
| 2 | `niche-finder` | Free AI Niche Finder | `NICHEFIND` | `free-niche-finder` |
| 3 | `lead-magnet-ideator` | Free Lead Magnet Ideator | `LMIDEATE` | `free-lead-magnet-ideator` |
| 4 | `lead-magnet-creator` | Free Lead Magnet Creator | `LMCREATE` | `free-lead-magnet-creator` |
| 5 | `lead-magnet-post-creator` | Free Lead Magnet Post Writer | `LMPOST` | `free-lead-magnet-post-writer` |
| 6 | `lead-magnet-email` | Free Lead Magnet Email Writer | `LMEMAIL` | `free-lead-magnet-email-writer` |
| 7 | `ty-page-vsl` | Free Thank-You Page VSL Builder | `TYVSL` | `free-ty-page-vsl-builder` |
| 8 | `profile-optimizer` | Free LinkedIn Profile Optimizer | `PROFILE` | `free-profile-optimizer` |
| 9 | `transcript-post-idea-grabber` | Free Transcript Idea Extractor | `IDEAGRAB` | `free-transcript-idea-extractor` |
| 10 | `post-generator` | Free LinkedIn Post Generator | `POSTGEN` | `free-post-generator` |
| 11 | `post-finalizer` | Free LinkedIn Post Finalizer | `POSTFINAL` | `free-post-finalizer` |
| 12 | `dm-chat-helper` | Free LinkedIn DM Script GPT | `DMHELP` | `free-dm-script-gpt` |
| 13 | `cold-email-mastermind` | Free Cold Email Mastermind | `COLDEMAIL` | `free-cold-email-mastermind` |

### Invite Code Config (each tool)

- **Access level**: "Lead Magnet"
- **Tool grants**: `[{ toolSlug: "<tool-slug>", credits: 10 }]`
- **Max uses**: 5000 (generous cap, can be increased)
- **Status**: Active
- **Expires**: Never
- **Cohort**: Needs to be determined (existing or new "Lead Magnet" cohort)

## Script Architecture

### Auth Strategy

The script needs to call two systems:

1. **Supabase** (direct, service role key) — for invite codes + querying ai_tools
2. **Magnetlab external APIs** — for lead magnets, funnels, branding, quiz, thank-you, email sequences

Magnetlab has two auth patterns:
- **Bearer token** (`EXTERNAL_API_KEY`): `apply-branding`, `generate-quiz`, `setup-thankyou`
- **HMAC signature** (`GTM_SERVICE_SECRET`): `lead-magnets`, `funnels`, `funnels/[id]/publish`
- **Session auth**: `email-sequence/generate`, `email-sequence/[id]/activate`

**Approach**: Add Bearer token fallback to the HMAC-only external auth middleware. This is a one-line change in `src/lib/middleware/external-auth.ts` and avoids needing the HMAC secret in the script. For email sequence routes (session-only), add a new external endpoint.

### Prerequisite Code Changes (magnetlab)

1. **Add Bearer token fallback to `authenticateExternal()`** — if `x-gtm-signature` headers are missing, check for `Authorization: Bearer` token matching `EXTERNAL_API_KEY`
2. **Add external email sequence endpoints**:
   - `POST /api/external/email-sequence/generate` — wraps existing generate logic
   - `POST /api/external/email-sequence/[leadMagnetId]/activate` — wraps existing activate logic

### Script Steps (per tool)

```
1. Query ai_tools table → get tool name, slug, description
2. Insert invite code → bootcamp_invite_codes (Supabase direct)
3. Create lead magnet → POST /api/external/lead-magnets
   Body: { title, archetype: "prompt", externalUrl: registration link }
4. Create funnel → POST /api/external/funnels
   Body: { leadMagnetId, slug, optinHeadline, optinSubline, optinButtonText }
5. Apply branding → POST /api/external/apply-branding
   Body: { userId, funnelPageId }
6. Generate quiz → POST /api/external/generate-quiz
   Body: { userId, funnelPageId }
7. Setup thank-you → POST /api/external/setup-thankyou
   Body: { userId, funnelPageId, bookingUrl }
8. Generate email sequence → POST /api/external/email-sequence/generate
   Body: { leadMagnetId }
9. Customize email sequence → inject registration link into Day 0 email
10. Activate email sequence → POST /api/external/email-sequence/activate
11. Publish funnel → POST /api/external/funnels/[id]/publish
```

### Email Sequence Content

Each tool gets a 5-email sequence with the registration link embedded. The AI generates the sequence using the tool's name and description as context. Day 0 email always includes:

```
🔗 Get your free [Tool Name] access:
https://www.modernagencysales.com/bootcamp/register?code=[CODE]
```

### Script Location

`/Users/timlife/Documents/claude code/magnetlab/scripts/generate-tool-leadmagnets.ts`

Run with: `npx tsx scripts/generate-tool-leadmagnets.ts`

### Environment Variables Needed

```
SUPABASE_URL=https://qvawbxpijxlwdkolmjrs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from .env.local>
EXTERNAL_API_KEY=<from .env.local>
MAGNETLAB_URL=http://localhost:3000  (or https://magnetlab.app)
MAS_USER_ID=<Modern Agency Sales user ID in magnetlab>
BOOKING_URL=<Cal.com booking URL>
COHORT_ID=<bootcamp cohort ID for lead magnet codes>
```

## Data Flow Summary

```
Script runs (once)
  │
  ├── For each of 13 tools:
  │   ├── Supabase: INSERT bootcamp_invite_codes
  │   ├── Magnetlab: Create lead_magnet
  │   ├── Magnetlab: Create funnel_page + sections
  │   ├── Magnetlab: Apply brand kit
  │   ├── Magnetlab: Generate qualification quiz
  │   ├── Magnetlab: Setup thank-you page
  │   ├── Magnetlab: Generate email sequence (AI)
  │   ├── Magnetlab: Customize + activate sequence
  │   └── Magnetlab: Publish funnel
  │
  └── Output: 13 live funnel URLs + 13 invite codes

Runtime (ongoing):
  Lead opts in → funnel captures email → email sequence delivers code
  Lead registers → bootcamp grants tool access (10 credits)
```

## What We Get

- **13 live funnel pages** at `magnetlab.app/p/mas/free-<tool>`
- **13 invite codes** in the bootcamp admin (visible at `/admin/courses/invite-codes`)
- **13 AI-generated email sequences** (5 emails each, active)
- **Consistent branding** across all funnels (MAS brand kit)
- **Qualification surveys** on each thank-you page
- **Call booking CTAs** on each thank-you page
- All lead data captured in magnetlab's `funnel_leads` table
- All integrations fire (email providers, webhooks, HeyReach, GoHighLevel)

## Open Questions

1. Which bootcamp cohort should the invite codes belong to? (Existing cohort or create a new "Lead Magnet" cohort?)
2. What Cal.com booking URL to use on the thank-you pages?
3. What's the MAS team user_id in magnetlab? (Needed for API calls)
4. Should we set an expiration on the invite codes or leave them permanent?
