# AI Admin Panel — Design Doc

**Date:** 2026-02-24
**Status:** Approved
**Scope:** Internal super-admin panel for viewing, editing, and versioning all AI prompts + learning observability dashboard

---

## Problem

All AI prompts in magnetlab's content pipeline are hardcoded in TypeScript files. Admins cannot see, edit, or recover prompts without code deploys. The self-learning system (edit tracking → pattern classification → voice evolution) has no visibility — there's no way to tell if it's working or what it has learned.

## Decision

**Approach A: Full Prompt Registry** — All 14+ AI prompts migrated from hardcoded TypeScript into a DB-backed registry. Runtime-editable via admin UI. Full version history with diffs and one-click rollback. Hardcoded defaults retained as fallback safety net.

---

## Database Schema

### `ai_prompt_templates`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | |
| `slug` | text UNIQUE | e.g. `post-writer-freeform`, `knowledge-extractor` |
| `name` | text | Human-readable: "Post Writer (Freeform)" |
| `category` | text | `content_writing`, `knowledge`, `learning`, `email`, `scoring` |
| `description` | text | What this prompt does, when it fires |
| `system_prompt` | text | Full system prompt template with `{{variable}}` placeholders |
| `user_prompt` | text | Full user prompt template with `{{variable}}` placeholders |
| `model` | text | e.g. `claude-sonnet-4-6` |
| `temperature` | float | Default 1.0 |
| `max_tokens` | int | |
| `variables` | jsonb | `[{name, description, example}]` |
| `is_active` | bool | Inactive = falls back to hardcoded default |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `ai_prompt_versions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | |
| `prompt_id` | uuid FK → ai_prompt_templates | |
| `version` | int | Auto-incrementing per prompt |
| `system_prompt` | text | Snapshot |
| `user_prompt` | text | Snapshot |
| `model` | text | Snapshot |
| `temperature` | float | Snapshot |
| `max_tokens` | int | Snapshot |
| `change_note` | text | Optional commit message |
| `changed_by` | text | Admin email/name |
| `created_at` | timestamptz | |

No RLS — protected by super-admin route check.

---

## Prompt Registry Service

### `src/lib/services/prompt-registry.ts`

**`getPrompt(slug)`**
1. Check in-memory cache (Map, keyed by slug)
2. Cache miss → fetch from `ai_prompt_templates` where `slug` and `is_active = true`
3. No active DB row → fall back to hardcoded default from `prompt-defaults.ts`
4. Cache TTL: 5 minutes

**`interpolatePrompt(template, variables)`**
- Simple `{{variable}}` → value replacement
- Variable values prepared by calling code (voice sections, knowledge context, etc.)
- Section headers included in variable values when conditional (e.g. `knowledge_context` is either `"## Knowledge Context\n<content>"` or `""`)

**`savePrompt(slug, updates, changedBy, changeNote)`**
1. Update `ai_prompt_templates` row
2. Insert `ai_prompt_versions` snapshot
3. Invalidate cache for slug

---

## Prompt Inventory (14+ prompts)

| Slug | Source File | Category |
|------|-------------|----------|
| `post-writer-freeform` | `post-writer.ts` | content_writing |
| `post-writer-template` | `post-writer.ts` | content_writing |
| `post-writer-auto-template` | `post-writer.ts` | content_writing |
| `post-rewrite-section` | `post-writer.ts` | content_writing |
| `post-polish-rewrite` | `post-polish.ts` | content_writing |
| `email-newsletter` | `email-writer.ts` | email |
| `knowledge-extractor` | `knowledge-extractor.ts` | knowledge |
| `content-brief-angles` | `briefing-agent.ts` | knowledge |
| `edit-classifier` | `edit-classifier.ts` | learning |
| `style-evolution` | `evolve-writing-style.ts` | learning |
| `topic-summarizer` | `topic-summarizer.ts` | knowledge |
| `style-guidelines` | `post-writer.ts` (getBaseStyleGuidelines) | content_writing |
| `banned-ai-phrases` | `post-polish.ts` (80-item list) | scoring |
| `hook-scoring-weights` | `post-polish.ts` (scoreHook) | scoring |

---

## Admin UI

### Access Control

- `is_super_admin` boolean column on profiles table
- Layout-level gate at `src/app/(dashboard)/admin/layout.tsx`
- No sidebar nav link rendered for non-super-admins

### Routes

**`/admin/prompts`** — Prompt list grouped by category. Cards show name, slug, model, last edited, active badge. Search/filter bar.

**`/admin/prompts/[slug]`** — Prompt editor:
- Left panel (70%): Tabbed textareas for system prompt + user prompt. Monospace, line numbers, `{{variable}}` highlighting.
- Right panel (30%): Variable reference sidebar, model config (dropdown + sliders), active toggle with warning.
- Bottom bar: Change note input, Test button (dry-run interpolation preview), Save button.
- Version history tab: Timeline of all versions. Click any → side-by-side diff. Restore button copies into editor (requires explicit Save).

**`/admin/learning`** — Learning observability:
- Edit activity chart (edits/day, grouped by profile)
- Pattern frequency (top detected patterns, bar chart)
- Voice evolution timeline (per profile, diffs of voice_profile JSON)
- Weekly cron status (last run, profiles processed)
- Raw edit history table (searchable, with original/edited text + patterns)

### Component Structure

```
src/app/(dashboard)/admin/
  layout.tsx              ← super-admin gate
  page.tsx                ← redirects to /admin/prompts
  prompts/
    page.tsx              ← prompt list
    [slug]/
      page.tsx            ← editor + version history
  learning/
    page.tsx              ← learning dashboard
```

### Reusable Components

- `PromptEditor` — textarea with `{{variable}}` highlighting
- `VersionTimeline` — version list with diff viewer
- `PromptDiffViewer` — side-by-side text diff (using `diff` npm package)
- `VariableReference` — sidebar showing available placeholders

---

## Migration Strategy

Zero-downtime, gradual rollout:

1. **Deploy infrastructure** — Create tables + registry service + `prompt-defaults.ts` (hardcoded prompts as fallback map). No runtime change.
2. **Seed DB** — SQL migration inserts all 14+ prompts with `is_active = false`. Admin UI can browse, production unchanged.
3. **Deploy admin UI** — Browse, edit, version prompts. All inactive, production unaffected.
4. **Activate gradually** — Flip prompts active one at a time, starting with low-risk (topic-summarizer, edit-classifier), then high-impact (post-writer-freeform). Toggle off = instant rollback.
5. **Steady state** — All prompts active in DB. Hardcoded defaults remain as permanent factory-reset safety net.

### What stays in code

- Variable preparation logic (building voice sections, knowledge context)
- Response parsing and validation
- Algorithmic scoring (hook scoring math, AI pattern regex)

---

## Tech Notes

- **Diff library:** `diff` npm package for side-by-side version comparison
- **Cache:** Simple in-memory Map with 5-min TTL (no Redis needed — single Vercel serverless instance per request, cache is per-cold-start convenience, not critical)
- **No templating engine:** Simple `{{variable}}` string replacement. Conditionals handled by variable preparation code. Avoids Handlebars/Mustache complexity.
- **No RLS:** Tables have no row-level security. Protected by super-admin route gate only.
