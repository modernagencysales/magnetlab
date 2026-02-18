# Whitelabel Email Domains Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable teams to verify their own email domain via Resend API (in-app) so transactional emails send from their domain instead of `sends.magnetlab.app`.

**Architecture:** New `team_email_domains` table stores domain + Resend domain ID + DNS records. Resend Domains API (platform account) handles domain registration and DNS verification. `getSenderInfo()` in the email trigger service resolves team email domain before falling back to default. Loops integration removed (dead code).

**Tech Stack:** Resend Domains API, Supabase PostgreSQL, Next.js API routes, React

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260219100000_team_email_domains.sql`

**Step 1: Write the migration**

```sql
-- Team email domain verification for whitelabel email sending
-- Allows teams to verify their own domain via Resend API

-- 1. Create team_email_domains table
CREATE TABLE IF NOT EXISTS team_email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  resend_domain_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  dns_records JSONB,
  region TEXT NOT NULL DEFAULT 'us-east-1',
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_team_email_domains_team_id UNIQUE (team_id),
  CONSTRAINT uq_team_email_domains_domain UNIQUE (domain)
);

-- 2. Status check constraint
ALTER TABLE team_email_domains
  ADD CONSTRAINT chk_team_email_domains_status
  CHECK (status IN ('pending', 'verified', 'failed'));

-- 3. Index for domain uniqueness lookups
CREATE INDEX idx_team_email_domains_domain ON team_email_domains(domain);

-- 4. Add custom_from_email to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS custom_from_email TEXT;

-- 5. RLS
ALTER TABLE team_email_domains ENABLE ROW LEVEL SECURITY;

-- Owner CRUD: team owner can manage their email domain
CREATE POLICY team_email_domains_owner_crud ON team_email_domains
  FOR ALL
  USING (
    team_id IN (
      SELECT id FROM teams WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT id FROM teams WHERE owner_id = auth.uid()
    )
  );

-- 6. updated_at trigger
CREATE TRIGGER update_team_email_domains_updated_at
  BEFORE UPDATE ON team_email_domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Step 2: Verify migration syntax**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run typecheck`
Expected: No errors (migration is SQL, not TS, but verify nothing broke)

**Step 3: Commit**

```bash
git add supabase/migrations/20260219100000_team_email_domains.sql
git commit -m "feat: add team_email_domains table and custom_from_email column"
```

---

### Task 2: Resend Domains API Client

**Files:**
- Create: `src/lib/integrations/resend-domains.ts`

**Step 1: Write the Resend Domains API client**

Create `src/lib/integrations/resend-domains.ts` with these exports:

```typescript
import { logError, logInfo } from '@/lib/utils/logger';

interface ResendDomainRecord {
  record: string;      // "SPF" | "DKIM" | "DMARC" | "MX"
  name: string;        // DNS record name
  type: string;        // "TXT" | "MX" | "CNAME"
  value: string;       // DNS record value
  ttl: string;         // "Auto" or numeric
  status: string;      // "not_started" | "pending" | "verified" | "failed"
  priority?: number;   // For MX records
}

interface ResendDomainResponse {
  id: string;
  name: string;
  status: string;
  region: string;
  records: ResendDomainRecord[];
  created_at: string;
  error?: { message: string; name: string };
}

// Use platform RESEND_API_KEY
function getApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not set');
  return key;
}

async function resendFetch<T>(path: string, options?: RequestInit): Promise<T & { error?: { message: string } }> {
  const res = await fetch(`https://api.resend.com${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return res.json();
}

export async function createResendDomain(domain: string): Promise<ResendDomainResponse> {
  // POST /domains — register domain on platform Resend account
  // Returns domain ID + DNS records (SPF, DKIM, MX)
}

export async function getResendDomain(resendDomainId: string): Promise<ResendDomainResponse> {
  // GET /domains/{id} — get current status + per-record statuses
}

export async function verifyResendDomain(resendDomainId: string): Promise<{ id: string }> {
  // POST /domains/{id}/verify — trigger async verification
}

export async function deleteResendDomain(resendDomainId: string): Promise<{ deleted: boolean }> {
  // DELETE /domains/{id} — remove domain from Resend
}
```

Each function should:
- Call the Resend API via `resendFetch`
- Log errors via `logError('integrations/resend-domains', ...)`
- Return typed responses
- Handle API errors gracefully (return error in response, don't throw)

**Step 2: Typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/integrations/resend-domains.ts
git commit -m "feat: add Resend Domains API client for email domain verification"
```

---

### Task 3: Team Email Domain API Routes

**Files:**
- Create: `src/app/api/settings/team-email-domain/route.ts`
- Create: `src/app/api/settings/team-email-domain/verify/route.ts`

**Step 1: Write the main route**

Create `src/app/api/settings/team-email-domain/route.ts` with GET, POST, DELETE handlers.

Follow the exact pattern from `src/app/api/settings/team-domain/route.ts` (the page domain route):
- Same auth pattern: `auth()` from `@/lib/auth`, `ApiErrors` from `@/lib/api/errors`
- Same plan gating: `getUserPlan()`, free users get 403
- Same team lookup: `teams` table where `owner_id = session.user.id`
- Same domain validation regex

**GET**: Return `{ emailDomain: row || null }` from `team_email_domains` where `team_id = team.id`

**POST**:
1. Plan check, validate domain format
2. `createResendDomain(domain)` → get DNS records
3. Upsert `team_email_domains` with status `pending`, store `resend_domain_id` and `dns_records`
4. Return `{ emailDomain: row, dnsRecords: records }`

**DELETE**:
1. Get domain row
2. `deleteResendDomain(resend_domain_id)`
3. Delete DB row
4. Clear `custom_from_email` on teams: `.update({ custom_from_email: null }).eq('id', team.id)`
5. Return `{ success: true }`

**Step 2: Write the verify route**

Create `src/app/api/settings/team-email-domain/verify/route.ts` with POST handler:

1. Auth, get team, get domain row
2. `verifyResendDomain(resend_domain_id)` — triggers async check
3. `getResendDomain(resend_domain_id)` — gets updated status + per-record statuses
4. Determine overall status: if Resend domain status is `'verified'` → `verified`, else `pending`
5. Update DB: `status`, `dns_records` (with updated per-record statuses), `last_checked_at`
6. Return `{ status, verified: boolean, records: [] }`

**Step 3: Typecheck**

Run: `npm run typecheck`

**Step 4: Commit**

```bash
git add src/app/api/settings/team-email-domain/
git commit -m "feat: add team email domain API routes (CRUD + verify)"
```

---

### Task 4: From Email API Route

**Files:**
- Create: `src/app/api/settings/team-email-domain/from-email/route.ts`

**Step 1: Write the from-email route**

POST handler that saves `custom_from_email` on the `teams` table:

1. Auth + plan check
2. Parse `{ fromEmail }` from body
3. Get team
4. Get team's email domain from `team_email_domains` — must be status `verified`
5. Validate `fromEmail` ends with `@{verified_domain}` — reject if domain doesn't match
6. Update `teams.custom_from_email = fromEmail`
7. Return `{ success: true }`

**Step 2: Typecheck**

Run: `npm run typecheck`

**Step 3: Commit**

```bash
git add src/app/api/settings/team-email-domain/from-email/route.ts
git commit -m "feat: add from-email endpoint with domain suffix validation"
```

---

### Task 5: Wire Into Email Sending

**Files:**
- Modify: `src/lib/services/email-sequence-trigger.ts`

**Step 1: Modify getSenderInfo to resolve team email domain**

The current `getSenderInfo(userId)` only checks `brand_kits.sender_name`. Update it to:

1. Keep existing brand kit lookup
2. Add: look up the user's team (`teams` where `owner_id = userId`)
3. If team found, check `team_email_domains` where `team_id = team.id` AND `status = 'verified'`
4. If verified email domain exists, also fetch `teams.custom_from_email` and `teams.custom_email_sender_name`
5. Return `{ senderName, senderEmail }` where:
   - `senderEmail` = `custom_from_email` if set (validated against verified domain), otherwise undefined
   - `senderName` = `custom_email_sender_name` || `brand_kits.sender_name` || `'MagnetLab'`

The resolution in `triggerEmailSequenceIfActive` already handles priority correctly:
```typescript
senderName: resendConfig?.fromName || senderName,  // user Resend > team config > default
senderEmail: resendConfig?.fromEmail || senderEmail, // user Resend > team config > default
```

So if a user has their own Resend account connected, it takes priority. If not, the team email domain kicks in. If neither, the platform default is used.

**Step 2: Typecheck**

Run: `npm run typecheck`

**Step 3: Commit**

```bash
git add src/lib/services/email-sequence-trigger.ts
git commit -m "feat: resolve team email domain in sender info for transactional emails"
```

---

### Task 6: Settings UI — Email Domain Card

**Files:**
- Modify: `src/components/settings/WhiteLabelSettings.tsx`

**Step 1: Add email domain section to WhiteLabelSettings**

Below the existing branding section (after the `my-6 border-t` separator), add another separator and an "Email Domain" section. Follow the exact same pattern as the custom (page) domain card above it:

**Structure:**
- Section header: `<h3>` with `Mail` icon from lucide-react
- **No domain**: domain input + "Add Domain" button
- **Pending**: domain display + amber "Pending" badge + expandable DNS panel + "Verify" button + auto-poll (10s × 12)
- **Verified**: domain display + green "Verified" badge + trash button with confirmation + from-email input

**DNS records panel** (expandable, same pattern as page domain):
- Each record shows: Record type (SPF/DKIM/MX), Name, Type (TXT/MX), Value, Status indicator (green check or amber dot)
- Copy-to-clipboard on each value field

**From email input** (only shown when domain is verified):
- Text input for the full address, e.g. `hello@clientbrand.com`
- Validated client-side: must end with `@{verified_domain}`
- "Save" button → `POST /api/settings/team-email-domain/from-email`

**State**: New state variables for email domain (separate from page domain state):
- `emailDomain`, `emailDomainInput`, `emailDnsRecords`, `emailDnsExpanded`
- `emailDomainLoading`, `emailDomainSaving`, `emailDomainVerifying`, `emailDomainDeleting`
- `emailDomainError`, `emailDomainSuccess`
- `fromEmail`, `fromEmailSaving`, `fromEmailSaved`
- `isEmailPolling`, email poll timer ref

**Fetching**: On mount, also call `GET /api/settings/team-email-domain` alongside the existing domain + whitelabel fetches.

Also fetch `custom_from_email` from the whitelabel GET response — add it to the whitelabel API GET handler to include `custom_from_email` in the select.

**Step 2: Typecheck**

Run: `npm run typecheck`

**Step 3: Commit**

```bash
git add src/components/settings/WhiteLabelSettings.tsx
git commit -m "feat: add email domain verification UI to White Label settings"
```

---

### Task 7: Update Whitelabel API to Include custom_from_email

**Files:**
- Modify: `src/app/api/settings/whitelabel/route.ts`

**Step 1: Add custom_from_email to the GET select**

In the GET handler, add `custom_from_email` to the `.select()` string:

```typescript
.select('id, whitelabel_enabled, hide_branding, custom_favicon_url, custom_site_name, custom_email_sender_name, custom_from_email')
```

No changes to PATCH — `custom_from_email` is saved via the dedicated from-email endpoint (with domain validation).

**Step 2: Typecheck**

Run: `npm run typecheck`

**Step 3: Commit**

```bash
git add src/app/api/settings/whitelabel/route.ts
git commit -m "feat: include custom_from_email in whitelabel GET response"
```

---

### Task 8: Remove Loops Integration

**Files:**
- Delete: `src/lib/integrations/loops.ts`
- Modify: `src/app/api/integrations/verify/route.ts` (remove loops case)
- Modify: `src/lib/types/email.ts` (remove Loops types)
- Modify: `src/lib/services/email-sequence-trigger.ts` (remove loops_synced_at from select)
- Modify: `src/app/api/email-sequence/generate/route.ts` (remove loops columns from select)
- Modify: `src/app/api/email-sequence/[leadMagnetId]/route.ts` (remove loops columns + reset logic)
- Modify: `src/app/api/email-sequence/[leadMagnetId]/activate/route.ts` (remove loops columns from select)

**Step 1: Delete loops.ts**

Delete the file `src/lib/integrations/loops.ts`.

**Step 2: Remove loops case from verify route**

In `src/app/api/integrations/verify/route.ts`:
- Remove the `import { LoopsClient } from '@/lib/integrations/loops';` line
- Remove the entire `case 'loops': { ... }` block from the switch statement

**Step 3: Clean Loops types from email.ts**

In `src/lib/types/email.ts`:
- Remove `loopsSyncedAt` and `loopsTransactionalIds` from `EmailSequence` interface
- Remove entire `LoopsLeadSync` interface
- Remove `loops_synced_at` and `loops_transactional_ids` from `EmailSequenceRow` interface
- Remove entire `LoopsLeadSyncRow` interface
- Remove `loopsSyncedAt` and `loopsTransactionalIds` from `emailSequenceFromRow()`
- Remove entire `loopsLeadSyncFromRow()` function
- Remove `LoopsContact`, `LoopsEvent`, `LoopsTransactionalEmail`, `LoopsApiResponse` interfaces
- Remove the `LOOPS LEAD SYNC` and `LOOPS API TYPES` sections entirely

**Step 4: Clean Loops columns from select queries**

In all files that select `loops_synced_at, loops_transactional_ids`:
- `email-sequence-trigger.ts` line 33: Remove these two columns from `.select()`
- `email-sequence/generate/route.ts` line 117: Remove from `.select()`
- `email-sequence/[leadMagnetId]/activate/route.ts` line 30: Remove from `.select()`
- `email-sequence/[leadMagnetId]/route.ts` line 43: Remove from `.select()`
- `email-sequence/[leadMagnetId]/route.ts` lines 136-137: Remove the `updateData.loops_synced_at = null` and `updateData.loops_transactional_ids = []` lines

**Step 5: Typecheck**

Run: `npm run typecheck`
Expected: No errors — all Loops references removed

**Step 6: Commit**

```bash
git add -u  # stages all deletions and modifications
git commit -m "chore: remove Loops integration (dead code)"
```

---

### Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add whitelabel email domains section**

In the "Custom Domains & White-Label" section of CLAUDE.md, add a subsection for email domains:

- `team_email_domains` table description
- `custom_from_email` column on teams
- Key files: `resend-domains.ts`, API routes, wire-up in trigger service
- Sender resolution priority: user Resend > team email domain > default
- Note Loops removal

Also remove any `LOOPS_API_KEY` references from env vars if present.

**Step 2: Full build test**

Run: `npm run build`
Expected: Build succeeds

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add whitelabel email domains and note Loops removal in CLAUDE.md"
```

---

## Task Dependency Graph

```
Task 1 (migration) → Task 2 (Resend API client) → Task 3 (API routes) → Task 4 (from-email route)
                                                  → Task 5 (wire into sending)
Task 3 + Task 7 → Task 6 (settings UI)
Task 8 (Loops removal) — independent, can run anytime
Task 5 + Task 6 + Task 8 → Task 9 (docs + build test)
```

Tasks 2 and 8 can run in parallel (independent).
Tasks 3 and 5 can run in parallel after Task 2.
Task 6 depends on Tasks 3 and 7.
Task 9 is the final task after everything else.
