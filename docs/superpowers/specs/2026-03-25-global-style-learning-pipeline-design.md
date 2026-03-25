# Global Style Learning Pipeline

> Spec: `magnetlab/docs/superpowers/specs/2026-03-25-global-style-learning-pipeline-design.md`
> Status: Draft
> Date: 2026-03-25

## Problem

Humans consistently fix the same AI generation mistakes — placeholder text, aggressive CTAs, jargon, dense formatting, overly formal tone. These corrections are captured in `cp_edit_history` (33 edits, 80+ classified patterns) but never fed back into generation prompts. The AI keeps making the same mistakes.

## Solution

A three-stage pipeline: aggregate edit patterns weekly, propose prompt rules for admin review, compile approved rules into a `{{global_style_rules}}` variable injected into every content generation prompt.

### Key Decisions

- **Hybrid storage:** Individual `cp_style_rules` rows for granular management (approve/reject/edit each rule), compiled into a single `ai_prompt_templates` row (`global-style-rules`) for zero-overhead runtime injection.
- **Human-in-the-loop:** Rules are proposed by AI, reviewed and approved by admin. Never auto-applied.
- **Approval-gated edit capture:** Only the diff between AI original and final approved content is captured as training signal. Intermediate edits by different editors are ignored. (Already implemented — `ai_original_content` column + `approved_by` on `cp_edit_history`.)
- **Designed for per-client extension:** Same table, scoped by `team_id`. Phase 2 adds per-team rules with no schema changes.

## Architecture

```
cp_edit_history (captured edits with classified patterns)
  │
  ▼ Weekly Trigger.dev task: propose-style-rules
  │
cp_style_rules (proposed rules with status: proposed/approved/rejected)
  │
  ▼ Admin reviews on /admin/learning page
  │
  ▼ On approve/reject → compile step
  │
ai_prompt_templates row: global-style-rules (compiled text of all approved rules)
  │
  ▼ getGlobalStyleRules() helper
  │
  ▼ Injected as {{global_style_rules}} into every generation prompt
  │
post-writer, post-polish, email-newsletter, mixer, email-sequence-generator, lead-magnet-content
```

## Data Model

### New Table: `cp_style_rules`

```sql
CREATE TABLE cp_style_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'team')),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  pattern_name TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  source_edit_ids UUID[] DEFAULT '{}',
  frequency INT NOT NULL DEFAULT 1,
  confidence NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected')),
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'global' AND team_id IS NULL) OR
    (scope = 'team' AND team_id IS NOT NULL)
  )
);

ALTER TABLE cp_style_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on cp_style_rules"
  ON cp_style_rules FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_cp_style_rules_scope_status ON cp_style_rules(scope, status);
CREATE INDEX idx_cp_style_rules_pattern ON cp_style_rules(pattern_name);
```

**Enforced invariant:** `team_id` must be NULL when `scope = 'global'`, must be set when `scope = 'team'` (CHECK constraint). RLS enabled — service role only (admin routes use service role client).

**Note on `source_edit_ids`:** PostgreSQL does not support FK constraints on array elements. These are evidence references only — the UI must handle missing source edits gracefully ("source edit no longer available").

### Prompt Registry Row

Slug: `global-style-rules`
Category: `learning`
`user_prompt`: Compiled text of all approved global rules, numbered list format.

Example compiled output:

```
When generating any content, follow these rules learned from human editing patterns:

1. Never include placeholder text like [INSERT TIP], [Resource 1], [DOWNLOAD LINK], or [YOUR BEST VIDEO LINK]. If you don't have specific content for a section, omit it entirely. Generic placeholders are worse than no content.

2. Use consultative CTAs instead of directive ones. Write "Out of curiosity..." or "Feel free to..." instead of "Hit reply!" or "Let me know!" Soft asks consistently outperform hard asks.

3. Prefer commas and parentheses over em dashes. Em dashes create dramatic pauses that feel overwrought in professional content. Use them sparingly, not as default punctuation.

4. Use concrete, everyday language. Replace words like "authority-calibrated", "reflexive", "composure" with simpler alternatives ("natural", "confidence"). If a word wouldn't be used in casual conversation, find a simpler one.

5. For LinkedIn posts, break dense paragraphs into single-statement lines. Each key idea gets its own line. Use bullet lists for sequential steps. Optimize for scan-readability.
```

### No Changes to Existing Tables

`cp_edit_history` and `team_profiles.voice_profile` stay as-is. The `approved_by` column on `cp_edit_history` (added today) supports the approval-gated capture.

## Stage 1: Aggregate (Weekly Trigger.dev Task)

**Task:** `propose-style-rules`
**Schedule:** Weekly, Sunday (alongside existing `weeklyStyleEvolution`)

### Process

1. Query `cp_edit_history` for edits since the last proposal run (track via a simple `cp_style_rules.proposed_at` max query).
2. Extract all patterns from `auto_classified_changes.patterns` across all qualifying edits.
3. Group by `pattern_name`, sum frequency, collect source `edit_ids`, take the most descriptive `description`.
4. Filter out patterns that already exist in `cp_style_rules` (any status — never re-propose rejected patterns).
5. Filter to patterns with frequency >= 2 (minimum signal threshold).
6. For each qualifying pattern, call Claude Haiku to draft a concrete prompt rule:
   - Input: pattern name, all descriptions for that pattern, 1-2 example before/after diffs from source edits
   - Output: A single, specific prompt instruction (1-3 sentences)
   - Prompt template: `style-rule-drafter` in prompt registry
7. Insert into `cp_style_rules` with `status: 'proposed'`.

### Rule Drafting Prompt

The drafter prompt should produce rules that are:
- **Specific** — "Never include [INSERT TIP] placeholders" not "Be more specific"
- **Actionable** — tells the AI what to do, not what pattern was detected
- **Scoped** — applies to the right content types (some rules are email-only, some are universal)

### Deduplication

Pattern names come from AI classification and are not normalized — Claude may classify the same behavior as `"placeholder_removal"` one week and `"template_placeholder_cleanup"` the next. At current edit volume (33 edits/month), strict string matching is acceptable. Admins handle semantic duplicates during review (reject the duplicate). If volume grows significantly, consider adding embedding-based similarity matching in the dedup step.

### Edge Cases

- If no new patterns qualify, the task is a no-op.
- If a pattern exists as `rejected`, it is never re-proposed. Admin can manually create a new rule with corrected text via `POST /api/admin/style-rules`.
- The task is idempotent — running it twice in the same period produces no duplicates.

## Stage 2: Review (Admin UI)

Extend the existing `/admin/learning` page with two new sections at the top.

### Proposed Rules Section

Rendered above existing edit activity content. Shows all rules with `status = 'proposed'`.

Each proposal card displays:
- **Pattern name** as title
- **Rule text** in an editable text area (admin can refine before approving)
- **Evidence:** frequency count ("Seen in 5 edits") + one expandable before/after example from source edits
- **Actions:** Approve, Reject buttons

### Active Rules Section

Below proposals. Shows all rules with `status = 'approved'`.

Each active rule card displays:
- **Rule text** (editable inline for refinement)
- **Frequency and confidence**
- **Approved date** and by whom
- **Deactivate** button (sets status to `rejected`, triggers recompile)

### API Routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/admin/style-rules` | List rules. Query params: `status` (proposed/approved/rejected/all), `scope` (global/team) |
| `POST` | `/api/admin/style-rules` | Manually create a rule (for rules not derived from edit patterns). Body: `{ rule_text, scope, team_id? }` |
| `PATCH` | `/api/admin/style-rules/[id]` | Update rule: change `status`, edit `rule_text`. Triggers recompile on status change. |
| `POST` | `/api/admin/style-rules/compile` | Manual recompile trigger (safety valve). |

All routes are super-admin only (same auth as existing `/admin/*` routes).

The POST create route serves as the escape hatch for rejected patterns — rather than "re-proposing" a rejected rule, admins create a new rule manually with corrected text.

### PATCH Behavior

When `status` changes to `approved` or `rejected`:
1. Update the row (`status`, `reviewed_at`, `reviewed_by`, optionally `rule_text`)
2. Trigger compile (Stage 3)

When only `rule_text` changes (on an already-approved rule):
1. Update the row
2. Trigger compile (to refresh the compiled output)

## Stage 3: Compile

Triggered automatically on every PATCH that changes status or rule text. Also available as manual `POST /api/admin/style-rules/compile`.

### Process

1. Query `cp_style_rules` WHERE `scope = 'global'` AND `status = 'approved'` ORDER BY `frequency DESC`.
2. Build numbered list from `rule_text` values.
3. Wrap in a preamble: "When generating any content, follow these rules learned from human editing patterns:"
4. Upsert into `ai_prompt_templates`:
   - `slug`: `global-style-rules`
   - `user_prompt`: the compiled text
   - `category`: `learning`
   - `name`: `Global Style Rules`
   - `is_active`: true
5. Prompt registry cache (5-min TTL) handles invalidation naturally.

### Compile Strategy

The `global-style-rules` row must be seeded by the migration (empty `user_prompt`). The compile step uses the existing `updatePromptTemplate()` function (update-only, never insert). This avoids adding an upsert function — the migration guarantees the row exists.

### Empty State

If zero approved rules exist, the compiled text is an empty string. `getGlobalStyleRules()` returns `""` and generation prompts behave as they do today.

### Relationship to `evolve-writing-style` Task

Both `propose-style-rules` and the existing `evolve-writing-style` task read from `cp_edit_history`. They operate independently:
- `evolve-writing-style` uses the `processed` flag (marks edits as processed after consuming them for per-profile voice evolution).
- `propose-style-rules` uses time-windowed queries (`created_at` since last proposal run). It does NOT touch the `processed` flag.

Both tasks consume the same edits for different purposes — this is intentional. The `processed` flag means "consumed by voice evolution," not "consumed by all downstream tasks." Both tasks should include a comment documenting this.

## Injection Points

### Helper Function

```typescript
/** Load compiled global style rules from prompt registry. Returns empty string if none exist. */
export async function getGlobalStyleRules(): Promise<string> {
  try {
    const template = await getPrompt('global-style-rules');
    return template.user_prompt || '';
  } catch (err) {
    logError('style-rules', err, { slug: 'global-style-rules' });
    return '';
  }
}
```

Lives in `src/lib/services/style-rules.ts`.

### Generation Points to Wire

| File | Template/Prompt | How to Inject |
|---|---|---|
| `src/lib/ai/content-pipeline/post-writer.ts` | `post-writer-freeform` registry template | Add `global_style_rules` to interpolation variables, add `{{global_style_rules}}` to template after `{{style_guidelines}}` |
| `src/lib/ai/content-pipeline/post-polish.ts` | `post-polish` registry template | Add `global_style_rules` to interpolation, add `{{global_style_rules}}` to template |
| `src/lib/ai/content-pipeline/email-writer.ts` | `email-newsletter` registry template | Add `global_style_rules` to interpolation, add `{{global_style_rules}}` to template |
| `src/lib/ai/content-pipeline/mixer-prompt-builder.ts` | Assembled prompt string | Caller fetches rules and passes as parameter (preserves pure function contract) |
| `src/lib/ai/email-sequence-generator.ts` | Hardcoded system prompt | Append `getGlobalStyleRules()` result to system prompt |
| `src/lib/ai/generate-lead-magnet-content.ts` | Hardcoded system prompt | Append `getGlobalStyleRules()` result to system prompt |

### Registry Template Updates

For the 3 templates using the registry (`post-writer-freeform`, `post-polish`, `email-newsletter`), add `{{global_style_rules}}` to the template text via admin panel or migration. Position: after existing style guidelines, before content-specific instructions.

## Per-Client Extension (Phase 2)

No schema changes needed. Phase 2 adds:

1. **Per-team aggregation pass** in `propose-style-rules`: after global pass, run a second pass grouped by `team_id`. Only propose team rules for patterns that diverge from global patterns.
2. **Team filter in admin UI:** dropdown on the rules section to view/manage per-team rules.
3. **`{{client_style_rules}}`** interpolation variable: `getTeamStyleRules(teamId)` helper, same pattern as global. Compiled into per-team prompt registry rows: `team-style-rules-{team_id}`.
4. **Precedence:** client rules override global rules when they conflict. The compiled client block includes a note: "These client-specific rules take precedence over global rules."

## Testing

### Unit Tests

| What | Coverage |
|---|---|
| `compileStyleRules(rules[])` | Builds numbered list from rules, handles empty set, orders by frequency |
| `getGlobalStyleRules()` | Returns compiled text from registry, returns empty string when no template exists |
| Proposal deduplication | Skips patterns already in `cp_style_rules` (any status) |
| Frequency threshold | Only proposes patterns with frequency >= 2 |

### API Route Tests

| Route | Cases |
|---|---|
| `GET /api/admin/style-rules` | 401 unauthenticated, 403 non-admin, filters by status, returns all fields |
| `POST /api/admin/style-rules` | 401/403 auth, creates rule with required fields, validates scope/team_id constraint |
| `PATCH /api/admin/style-rules/[id]` | 401/403 auth, validates status values, triggers recompile on approve/reject, allows rule_text edit on approved rules |
| `POST /api/admin/style-rules/compile` | 401/403 auth, compiles approved rules into prompt registry row, handles empty set |

### Integration Test

Insert proposed rule → approve via PATCH → verify `ai_prompt_templates` row updated → verify `getGlobalStyleRules()` returns the rule text.

## Files to Create

| File | Purpose |
|---|---|
| `supabase/migrations/2026XXXX_style_rules.sql` | Create `cp_style_rules` table + seed `global-style-rules` prompt template |
| `src/server/repositories/style-rules.repo.ts` | CRUD for `cp_style_rules` |
| `src/server/services/style-rules.service.ts` | Business logic: propose, approve/reject, compile |
| `src/lib/services/style-rules.ts` | `getGlobalStyleRules()` helper |
| `src/lib/validations/style-rules.ts` | Zod schemas for API requests |
| `src/app/api/admin/style-rules/route.ts` | GET (list) + POST (create) |
| `src/app/api/admin/style-rules/[id]/route.ts` | PATCH (update) |
| `src/app/api/admin/style-rules/compile/route.ts` | POST (manual compile) |
| `src/trigger/propose-style-rules.ts` | Weekly aggregation + rule drafting task |
| `src/components/admin/StyleRulesSection.tsx` | Proposed + Active rules UI for learning dashboard |

## Files to Modify

| File | Change |
|---|---|
| `src/lib/ai/content-pipeline/post-writer.ts` | Call `getGlobalStyleRules()`, pass as interpolation variable |
| `src/lib/ai/content-pipeline/post-polish.ts` | Same |
| `src/lib/ai/content-pipeline/email-writer.ts` | Same |
| `src/lib/ai/content-pipeline/mixer-prompt-builder.ts` | Add `globalStyleRules` parameter (pure function — caller passes the rules in) |
| `src/lib/ai/email-sequence-generator.ts` | Append global rules to hardcoded system prompt |
| `src/lib/ai/generate-lead-magnet-content.ts` | Append global rules to hardcoded system prompt |
| `src/components/admin/LearningDashboard.tsx` | Add `StyleRulesSection` at top |
| `src/app/(dashboard)/admin/learning/page.tsx` | Fetch style rules data, pass to dashboard |

## What's NOT In Scope

- Per-client rules (Phase 2 — architecture supports it, no schema changes needed)
- Per-approver style profiles (Phase 3)
- Evals framework (Phase 3 — the edit capture loop IS the eval for now: if humans stop making the same corrections, the rules worked)
- Voice profile evolution changes (existing `evolve-writing-style` task continues independently)
- Backfilling rules from existing 33 edits (run the proposal task once manually after deployment to seed initial proposals)
