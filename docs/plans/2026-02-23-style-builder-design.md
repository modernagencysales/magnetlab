# Style Builder — URL-to-Style Extraction + Mixer

## Goal

Let the CEO extract writing styles from any LinkedIn profile URL automatically, then mix and match traits from multiple extracted styles to build personalized voice profiles for each team member.

## Architecture

Two-part system built on existing infrastructure:

1. **URL-to-Style Extraction**: Enter LinkedIn URL → Apify scrapes recent posts → existing `extractWritingStyle()` AI module analyzes them → saved to `cp_writing_styles`
2. **Style Mixer**: Browse extracted styles in Library tab, cherry-pick individual traits (hooks, tone, vocabulary, etc.) and apply them to any team member's `voice_profile` JSONB

No new DB tables, migrations, or Trigger.dev tasks. Weekly style evolution continues independently.

## Section 1: URL-to-Style Extraction

**Current state:** `style-extractor.ts` takes raw post text (pasted manually). Apify's `supreme_coder/linkedin-post` actor is already integrated in `apify-engagers.ts` and can fetch recent posts from a LinkedIn profile URL.

**New flow:**

1. User enters a LinkedIn profile URL + optional name in the Library > Styles section
2. Backend calls Apify `scrapeProfilePosts(url)` → returns recent posts with content
3. Filters to posts with actual text content (skip reposts, image-only)
4. Passes top 10 posts to existing `extractWritingStyle()` AI module
5. Saves to `cp_writing_styles` with `source_linkedin_url` populated

**New API route:** `POST /api/content-pipeline/styles/extract-from-url`
- Input: `{ linkedin_url: string, author_name?: string }`
- Calls Apify to scrape posts, then pipes into existing extraction logic
- Returns created style object

**UI:** Simple form in Library tab's new "Styles" subsection — URL input, name input, "Extract" button. Shows progress indicator while scraping + analyzing (~15-30s).

No new tables or schema changes — `cp_writing_styles` already has `source_linkedin_url` and `source_posts_analyzed`.

## Section 2: Library Tab — Styles Subsection

**Current Library tab** has two pill toggles: Templates | Inspiration. Add a third: **Styles**.

**Styles section shows:**
- "Extract from LinkedIn" form at the top (URL + name + button)
- Grid of extracted style cards below, each showing:
  - Name + source URL (linked)
  - Tone badge (e.g. "conversational", "provocative")
  - Key traits at a glance: hook patterns (first 2), signature phrases (first 2), formatting flags (emojis, lists, bold)
  - Posts analyzed count
  - Delete button

**Card click → Style Detail panel** (inline expandable or slide-over):
- Full trait breakdown organized by category:
  - **Tone & Voice**: tone, sentence_length, vocabulary level
  - **Hooks**: hook_patterns list
  - **CTAs**: cta_patterns list
  - **Vocabulary**: signature_phrases, banned_phrases
  - **Formatting**: emojis, line breaks, lists, bold, avg paragraphs
- Example posts (collapsible)
- **"Apply traits to..."** button → opens the mixer

## Section 3: Style Mixer

Accessed from a style card's "Apply traits to..." button, or from /team profile editing ("Build from styles" button).

**Flow:**
1. Select target team member (dropdown of team profiles)
2. Left panel: source style's traits, organized by category
3. Right panel: target member's current voice profile fields
4. Each trait has a toggle/checkbox — check to stage for copying
5. Can open multiple source styles at once (tabs or accordion) to cherry-pick across them
6. Staged traits shown in "pending changes" summary at bottom
7. "Apply" button merges selected traits into target's `voice_profile` JSONB via `PATCH /api/teams/profiles/[id]`

**Merge rules:**
- Array fields (signature_phrases, banned_phrases, hook_patterns, etc.) → union (add new, don't remove existing)
- Scalar fields (tone, storytelling_style, cta_style) → replace
- User can review pending changes before applying — nothing auto-saves

**What this does NOT touch:**
- Auto-evolved fields (edit_patterns, vocabulary_preferences, positive_examples) — owned by evolution system
- Does not create a new style — copies traits into existing voice profile

## Section 4: Data Flow

```
LinkedIn URL
  → Apify scrapeProfilePosts()
  → filter text posts (top 10)
  → extractWritingStyle() [Claude Sonnet]
  → INSERT cp_writing_styles
  → Show in Library > Styles

Library > Styles card → "Apply traits to..."
  → Select target team member
  → Cherry-pick traits from source style(s)
  → Preview pending changes
  → PATCH /api/teams/profiles/[id] { voice_profile: merged }
  → buildVoicePromptSection() picks up new traits on next AI write

Weekly evolution continues independently:
  → Edit patterns still accumulate from user edits
  → evolveWritingStyle merges edit-learned patterns
  → Manual traits from mixer are preserved (evolution only touches auto-evolved fields)
```

## Changes Required

- **New API route**: `POST /api/content-pipeline/styles/extract-from-url` (scrape + extract)
- **UI components**: Library tab third pill ("Styles"), style cards, detail panel, mixer modal
- **Wire**: existing `scrapeProfilePosts()` from `apify-engagers.ts` into extraction flow
- **No new DB tables, migrations, or Trigger.dev tasks**
