# Unipile Migration Analysis: LeadShark → Unipile

## Why Migrate

**LeadShark problem**: Each team member needs their own LeadShark account ($$$). With Unipile, one API subscription manages unlimited LinkedIn accounts — the cost scales by connected accounts, not per-seat SaaS licenses.

**Unipile advantage**: Direct LinkedIn API access (posts, DMs, comments, reactions, profiles, search, invitations) through a single unified API key. Team members connect their LinkedIn accounts to YOUR Unipile instance.

---

## Feature Mapping: LeadShark → Unipile

| Feature | LeadShark | Unipile | Migration Complexity |
|---------|-----------|---------|---------------------|
| **Schedule/Publish Posts** | `createScheduledPost()` — native scheduling | `POST /api/v1/posts` — instant publish only, no native scheduling | **Medium** — must build scheduling layer |
| **Post Statistics** | `listPostStats()` — likes, comments, shares, views | `GET /api/v1/posts/{id}` — engagement counters (comments, impressions, reactions, reposts) | **Low** — direct mapping |
| **Comment→DM Automation** | Native automation engine (keywords, auto-connect, auto-like, follow-ups) | No built-in automations — must build with webhooks + custom logic | **High** — rebuild entire automation engine |
| **Auto-Connect on Comment** | Toggle per automation | `POST /api/v1/users/{id}/invite` + comment webhook monitoring | **High** — part of automation rebuild |
| **Auto-Like Comments** | Toggle per automation | `POST /api/v1/posts/{id}/reactions` + comment monitoring | **High** — part of automation rebuild |
| **Profile Enrichment** | `enrichPerson()` / `enrichCompany()` | `GET /api/v1/users/{id}` / `GET /api/v1/linkedin/companies/{id}` | **Low** — direct mapping |
| **LinkedIn Search** | `searchLinkedIn()` | `POST /api/v1/linkedin/search` | **Low** — direct mapping |
| **Profile Bookmarks** | Native bookmark system | No equivalent — use internal DB | **Low** — already in our DB |
| **Send DMs** | Via automation templates | `POST /api/v1/chats` (new) or `POST /api/v1/chats/{id}/messages` (existing) | **Low** — direct API |
| **Webhook Events** | `new_lead`, `dm_sent`, `connection_accepted`, `follow_up_sent` | `new_relation`, new message webhook, account status | **Medium** — different event model |
| **InMail** | Not available | `POST /api/v1/chats` with `inmail: true` | **New capability** |
| **Comment with Mentions** | Not available | `POST /api/v1/posts/{id}/comments` with mentions array | **New capability** |
| **Post Reactions** | Not available | `POST /api/v1/posts/{id}/reactions` | **New capability** |
| **Connection Requests** | Via auto-connect only | Full invitation management (send, cancel, accept, list) | **New capability** |

---

## Architecture Design

### 1. New Integration Layer: `src/lib/integrations/unipile.ts`

Replace `leadshark.ts` with a Unipile client that wraps all API calls:

```
UnipileClient
├── accounts
│   ├── list()
│   ├── connect(credentials)
│   ├── reconnect(accountId)
│   ├── delete(accountId)
│   └── solveCheckpoint(accountId, code)
├── posts
│   ├── create(accountId, text, media?)
│   ├── get(postId, accountId)
│   ├── listForUser(identifier, accountId)
│   ├── getComments(postId, accountId)
│   ├── addComment(postId, accountId, text, options?)
│   ├── getReactions(postId, accountId)
│   └── addReaction(postId, accountId, type)
├── messaging
│   ├── startChat(accountId, attendeeIds, text)
│   ├── sendMessage(chatId, text, attachments?)
│   ├── listChats(accountId)
│   └── getMessages(chatId)
├── users
│   ├── getProfile(identifier, accountId)
│   ├── getOwnProfile(accountId)
│   ├── sendInvitation(providerId, accountId, message?)
│   ├── listRelations(accountId)
│   ├── listSentInvitations(accountId)
│   └── cancelInvitation(invitationId, accountId)
├── search
│   ├── people(accountId, filters)
│   └── companies(accountId, filters)
└── webhooks
    ├── create(source, url, name)
    ├── list()
    └── delete(webhookId)
```

### 2. Scheduling Layer (replaces LeadShark native scheduling)

LeadShark has built-in scheduling. Unipile only does instant publish. We need to build our own scheduler:

**Approach**: Use existing `cp_pipeline_posts` table + Trigger.dev scheduled task

```
Trigger.dev Task: "publish-scheduled-post"
├── Cron: every 1 minute (or use scheduleFor with Trigger.dev)
├── Query: cp_pipeline_posts WHERE status='scheduled' AND scheduled_time <= NOW()
├── For each post:
│   ├── Get team member's Unipile account_id
│   ├── POST /api/v1/posts with text + media
│   ├── Store returned post social_id
│   └── Update status → 'published', published_at = NOW()
└── Error handling: status → 'failed', error logged
```

**We already have most of this!** The `auto-publish-check.ts` task runs hourly and checks for posts ready to publish. We just need to:
1. Change the publish call from LeadShark → Unipile
2. Optionally increase frequency from hourly to every 5 min for more precise timing

### 3. Comment→DM Automation Engine (replaces LeadShark automations)

This is the biggest build. LeadShark handles this natively. With Unipile we need:

**Architecture**:
```
                    Unipile Webhook
                    (new_message on post comments)
                           │
                           ▼
              magnetlab webhook endpoint
              /api/webhooks/unipile
                           │
                           ▼
                   Comment Processor
                   (Trigger.dev task)
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Keyword      Auto-Like    Auto-Connect
         Match?       Comment      (if not 1st degree)
              │            │            │
              ▼            ▼            ▼
         Send DM      React to     Send Invitation
         via Chat     Comment      with message
              │
              ▼
         Schedule Follow-up
         (if enabled, delayed task)
```

**New DB table**: `linkedin_automations`
```sql
CREATE TABLE linkedin_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  post_social_id TEXT, -- urn:li:activity:XXX
  linkedin_post_url TEXT,
  keywords TEXT[], -- trigger keywords
  dm_template TEXT,
  auto_connect BOOLEAN DEFAULT false,
  auto_like BOOLEAN DEFAULT false,
  comment_reply_templates TEXT[],
  non_first_degree_reply_templates TEXT[],
  enable_follow_up BOOLEAN DEFAULT false,
  follow_up_template TEXT,
  follow_up_delay_minutes INTEGER DEFAULT 1440,
  status TEXT DEFAULT 'draft', -- draft, running, paused
  unipile_account_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE linkedin_automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES linkedin_automations(id),
  event_type TEXT, -- comment_detected, dm_sent, connection_sent, follow_up_sent
  commenter_name TEXT,
  commenter_provider_id TEXT,
  commenter_profile_url TEXT,
  comment_text TEXT,
  action_taken TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. Account Management (Multi-User)

**New DB table**: `linkedin_accounts`
```sql
CREATE TABLE linkedin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  unipile_account_id TEXT UNIQUE NOT NULL,
  linkedin_name TEXT,
  linkedin_headline TEXT,
  linkedin_profile_url TEXT,
  linkedin_provider_id TEXT,
  status TEXT DEFAULT 'connected', -- connected, disconnected, checkpoint
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_synced_at TIMESTAMPTZ
);
```

**Connection flow for team members**:
1. User clicks "Connect LinkedIn" in magnetlab
2. We call `POST /hosted/request-link` → get redirect URL
3. User authenticates via Unipile hosted auth
4. Webhook callback confirms connection → store in `linkedin_accounts`
5. All subsequent API calls use their `unipile_account_id`

### 5. Post Stats Tracking

Replace LeadShark `listPostStats()` with periodic polling:

**Trigger.dev Task**: `sync-post-stats`
- Cron: every 6 hours
- For each published post (last 30 days):
  - `GET /api/v1/posts/{social_id}?account_id={account_id}`
  - Update `cp_pipeline_posts.engagement_stats` with: comments, impressions, reactions, reposts

### 6. Webhook Handler

**New endpoint**: `/api/webhooks/unipile`

Unipile webhooks to register:
1. **Account status** (`source: "accounts"`) — Handle disconnection/reconnection
2. **New messages** (`source: "messages"`) — For comment detection on posts (comment→DM automation)
3. **New relation** (`source: "users"`) — Track accepted connections

---

## Migration Plan (Phased)

### Phase 1: Core Publishing (Replace LeadShark posting)
**Files to modify**:
- `src/lib/integrations/unipile.ts` — NEW: Unipile API client
- `src/lib/integrations/linkedin-accounts.ts` — NEW: Account management helpers
- `src/lib/services/autopilot.ts` — Update publish calls from LeadShark → Unipile
- `src/trigger/auto-publish-check.ts` — Update publish call
- `src/app/api/linkedin/schedule/route.ts` — Update to use Unipile
- `src/app/api/leadshark/scheduled-posts/[id]/route.ts` — Rename/update to Unipile
- DB migration: `linkedin_accounts` table

**What this gives you**: Team members can post to LinkedIn through magnetlab using their own connected accounts, without individual LeadShark subscriptions.

### Phase 2: Account Connection UI
**Files to create/modify**:
- `src/app/api/linkedin/connect/route.ts` — NEW: Hosted auth flow
- `src/app/api/webhooks/unipile/route.ts` — NEW: Webhook handler
- `src/components/settings/LinkedInAccountConnect.tsx` — NEW: Connection UI
- Register Unipile webhooks (account status, new messages, new relations)

### Phase 3: Comment→DM Automation Engine
**Files to create/modify**:
- DB migration: `linkedin_automations` + `linkedin_automation_events` tables
- `src/lib/services/linkedin-automation.ts` — NEW: Automation engine
- `src/trigger/process-linkedin-comment.ts` — NEW: Comment processing task
- `src/trigger/send-follow-up-dm.ts` — NEW: Delayed follow-up task
- `src/app/api/linkedin/automations/route.ts` — NEW: CRUD API
- `src/app/api/linkedin/automations/[id]/route.ts` — NEW: Individual automation management
- Update webhook handler to route comment events to automation engine

### Phase 4: Enhanced Features (New Capabilities)
- Comment with mentions
- Post reactions (like/celebrate/etc.)
- InMail support for premium accounts
- Connection request management
- LinkedIn search integration
- Profile enrichment replacing LeadShark enrichment

### Phase 5: Cleanup
- Remove `src/lib/integrations/leadshark.ts`
- Remove `src/app/api/leadshark/` routes
- Remove `src/app/api/webhooks/leadshark/` handler
- Update all references
- Remove LeadShark webhook from dashboard

---

## Key Differences to Understand

### 1. No Native Scheduling
LeadShark: "Schedule this post for Tuesday 9am" → done.
Unipile: "Publish this post NOW" → you must build the scheduling layer.
**Impact**: Low — we already have `cp_posting_slots` + `scheduled_time` + Trigger.dev tasks.

### 2. No Native Automations
LeadShark: "When someone comments 'guide', DM them" → done.
Unipile: You get raw webhook events. You build the matching, DM sending, follow-up logic.
**Impact**: High — this is the biggest build item. ~500-800 lines of new code.

### 3. Account-per-connection vs Account-per-seat
LeadShark: Each person needs a LeadShark account.
Unipile: One API subscription, add LinkedIn accounts via API. Each connected LinkedIn account counts toward your plan.
**Impact**: This is the whole point — massive cost savings for teams.

### 4. social_id Required for All Post Interactions
Every post interaction (comment, react, get stats) requires the `social_id` (URN format), not a simple numeric ID. Must store and use `urn:li:activity:XXX` format.

### 5. Rate Limits are LinkedIn's, Not Unipile's
Unipile doesn't add its own rate limits — it passes through LinkedIn's:
- ~100 actions/day per LinkedIn account
- 80-100 connection requests/day (paid)
- 200 connection requests/week
- Profile views: ~100/day

---

## Environment Variables Needed

```env
# Unipile
UNIPILE_DSN=api1.unipile.com:13111
UNIPILE_ACCESS_TOKEN=...
UNIPILE_WEBHOOK_SECRET=... # if they support signing

# Set in:
# - Vercel (magnetlab)
# - Trigger.dev (magnetlab project)
```

---

## Cost Comparison

| Scenario | LeadShark | Unipile |
|----------|-----------|---------|
| 1 user | ~$99/mo (1 LeadShark seat) | ~$79/mo (Starter plan, 5 accounts) |
| 5-person team | ~$495/mo (5 seats) | ~$79/mo (same Starter plan) |
| 10-person team | ~$990/mo (10 seats) | ~$159/mo (Pro plan, 20 accounts) |
| 20-person team | ~$1,980/mo | ~$159/mo (same Pro plan) |

*Unipile pricing is per-connected-account, not per-user. Verify current pricing at unipile.com.*
