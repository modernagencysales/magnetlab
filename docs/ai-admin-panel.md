<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## AI Admin Panel

Internal super-admin panel for managing all AI prompt templates and observing the self-learning system.

### Access

- Route: `/admin/prompts` (prompt management) and `/admin/learning` (learning observability)
- Gate: `is_super_admin` boolean on `users` table — set via SQL: `UPDATE users SET is_super_admin = true WHERE email = 'your@email.com'`
- Conditionally shown in sidebar nav for super-admins only

### Data Model

- `ai_prompt_templates` — 14 prompt templates with `{{variable}}` placeholders, model config, active/inactive toggle
- `ai_prompt_versions` — full snapshot on every save, supports diff comparison and one-click restore
- Prompts seeded with `is_active = false` — activate one at a time to override hardcoded defaults

### Prompt Registry

- `src/lib/services/prompt-registry.ts` — `getPrompt(slug)` with 5-min cache, `interpolatePrompt()`, `savePrompt()`
- Falls back to hardcoded defaults in `src/lib/ai/content-pipeline/prompt-defaults.ts`
- All AI modules read from registry: post-writer, post-polish, email-writer, knowledge-extractor, briefing-agent, edit-classifier, topic-summarizer, style-evolution

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/ai/content-pipeline/prompt-defaults.ts` | Hardcoded fallback prompts (14 entries) |
| `src/lib/services/prompt-registry.ts` | Registry service (cache, interpolation, save, versioning) |
| `src/lib/auth/super-admin.ts` | `isSuperAdmin()` auth helper |
| `src/app/(dashboard)/admin/layout.tsx` | Admin route gate |
| `src/app/(dashboard)/admin/prompts/page.tsx` | Prompt list page |
| `src/app/(dashboard)/admin/prompts/[slug]/page.tsx` | Prompt editor page |
| `src/app/(dashboard)/admin/learning/page.tsx` | Learning dashboard |
| `src/components/admin/PromptEditor.tsx` | Editor with save, test, version history |
| `src/components/admin/PromptDiffViewer.tsx` | Side-by-side diff viewer |
| `src/components/admin/VersionTimeline.tsx` | Version history with restore |
| `src/components/admin/LearningDashboard.tsx` | Edit activity, pattern frequency, voice evolution |
| `src/app/api/admin/prompts/` | CRUD + versioning + restore + test APIs |
| `src/app/api/admin/learning/` | Learning data API |
