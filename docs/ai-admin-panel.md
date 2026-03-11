# AI Admin Panel

Super-admin only. `/admin/prompts` (prompt management), `/admin/learning` (edit activity, voice evolution). Gate: `users.is_super_admin`.

## Data

`ai_prompt_templates` — 14 prompts, `{{variable}}` placeholders | `ai_prompt_versions` — snapshot on save, diff, restore

## Registry

`getPrompt(slug)` with 5-min cache. Falls back to `prompt-defaults.ts`. All AI modules read from registry.
