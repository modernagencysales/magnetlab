# Postmortem: Lead Magnet Migration (2026-02-05/06)

## Summary

Migrated 19 lead magnets into MagnetLab via browser console scripts and Node.js scrapers. All 19 items were successfully created, populated with content, and published. A code review afterward surfaced 10 bugs across 7 files, ranging from server crashes to performance issues.

## Process Challenges

### 1. Cookie auth redaction
Browser console scripts required manually copying session cookies. Claude Code redacted auth tokens on paste, requiring the user to paste credentials into a separate file and reference them indirectly.

### 2. Paste corruption
Large script blocks pasted into the browser console occasionally had characters dropped or modified, causing silent data corruption in lead magnet titles and slugs.

### 3. Vercel webhook break after repo transfer
After transferring the GitHub repo from `kimprobably/magnetlab` to `modernagencysales/magnetlab`, the Vercel deployment webhook stopped firing. Required manual re-link in Vercel project settings.

### 4. DB migration not applied
New columns added to `funnel_pages` (e.g. `target_type`, `library_id`, `external_resource_id`) existed in migration files but hadn't been applied to the production Supabase instance. Caused 400 errors on funnel creation until the migration was run manually.

### 5. Truncated UUIDs
Early scripts stored only the first 8 characters of UUIDs (e.g. `a76c0d3b`) for readability. This caused lookup failures when scripts tried to use them as full IDs. Fixed by storing full UUIDs in all subsequent scripts.

## Code Bugs Found

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | P0 | `lead-magnet/[id]/content/route.ts` | `section.introduction.split()` crashes on null |
| 2 | P0 | 3 route files | Missing UUID validation on `[id]` route params |
| 3 | P0 | `funnel/[id]/route.ts` | No ownership check on `qualificationFormId` |
| 4 | P0 | `funnel/[id]/publish/route.ts` | Lead magnet query missing `user_id` filter |
| 5 | P1 | `lead-magnet/route.ts` | POST body not validated with Zod schema |
| 6 | P1 | `funnel/[id]/route.ts` | PUT accepts free-form theme/color/backgroundStyle |
| 7 | P1 | `lead-magnet/[id]/content/route.ts` | Only checks `sections` exists, not structure |
| 8 | P2 | `funnel/[id]/publish/route.ts` | Duplicate user query for username |
| 9 | P2 | `funnel/route.ts` | Slug collision loop does up to 100 sequential DB queries |
| 10 | P2 | `funnel/[id]/publish/route.ts` | Inner join excludes library/external_resource funnels |

## Fixes Applied

### Commit 1: P0 — Server crashes & security vulnerabilities
- **Fix 1:** Null-safe word count with `(value || '').split(/\s+/).filter(Boolean).length`
- **Fix 2:** Added `isValidUUID(id)` checks to `content/route.ts`, `funnel/[id]/route.ts` (GET/PUT/DELETE), and `funnel/[id]/publish/route.ts`
- **Fix 3:** Added ownership query on `qualification_forms` table before writing `qualificationFormId`
- **Fix 4:** Added `.eq('user_id', session.user.id)` to lead magnet query in publish route

### Commit 2: P1 — Input validation
- **Fix 5:** Imported and applied `createLeadMagnetSchema` validation to POST /api/lead-magnet
- **Fix 6:** Created `updateFunnelSchema` with enum checks for theme/backgroundStyle, hex regex for primaryColor, and string length limits
- **Fix 7:** Created `polishedContentSchema` and `updateContentBodySchema` with structure validation and default empty strings for introduction/keyTakeaway

### Commit 3: P2 — Performance & correctness
- **Fix 8:** Cached username from first query, removed duplicate user query
- **Fix 9:** Replaced N-query slug collision loop with single `.or()` query + local Set computation
- **Fix 10:** Changed `lead_magnets!inner(id)` to `lead_magnets(id)` (left join), added null check before auto-polish block

## Recommendations for Next Import

1. **Bulk import endpoint** — Build a `POST /api/admin/bulk-import` that accepts an array of lead magnets with content in a single request, with transactional rollback on failure.

2. **Idempotency keys** — Add an `external_id` column to `lead_magnets` so re-running an import script updates existing records instead of creating duplicates.

3. **Admin UI** — Build a protected admin page at `/admin/import` with drag-and-drop JSON upload, progress bar, and error log, eliminating the need for browser console scripts.

4. **CI/CD migrations** — Add a GitHub Actions step that runs `supabase db push` on merge to main, so schema changes are never forgotten in production.

## Timeline

| Time | Event |
|------|-------|
| 2026-02-05 08:00 | Started migration planning |
| 2026-02-05 10:00 | Phase 1: 19 lead magnets + funnels created |
| 2026-02-05 14:00 | Phase 2: Content scraped and pushed (Notion + getcreator) |
| 2026-02-05 16:00 | Phase 3: Verification pass — 19/19 live |
| 2026-02-05 17:00 | All funnels unpublished for review |
| 2026-02-06 09:00 | Code review started, 10 bugs identified |
| 2026-02-06 11:00 | All fixes applied across 3 commits |
