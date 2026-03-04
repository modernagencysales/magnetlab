# MOD-262: Fix Polish Formatting Failures for 4 Lead Magnets

**Date:** 2026-02-26
**Ticket:** MOD-262
**Reviewer feedback:** Tim Keen

## Problem

4 lead magnets completed the content rebuild pipeline but the polish step (rich block formatting via Claude Opus) consistently fails JSON parsing. They render with the simpler `ExtractedContentRenderer` fallback instead of the rich `PolishedContentRenderer`.

Tim's feedback:
- **#2** (Top 1% LinkedIn Content Pack): "has no content" — wants YouTube videos embedded for each bullet
- **#3** ($5M AI Lead Magnet Machine Pack): "has no content" — headings render but body text missing
- **#4** ($5M Lead Magnet Swipe File): "has headlines but nothing in the section"
- **#1** ($5M LinkedIn Post Database): No complaints, but still needs polish

### Root Causes

1. **Polish timeout/truncation:** `polishLeadMagnetContent()` uses synchronous `messages.create()` with 8000 max_tokens on 20-29K char inputs. HTTP timeouts truncate the JSON response, causing `JSON.parse()` failure.
2. **ExtractedContentRenderer bug:** For #2 and #3, the fallback renderer shows headings but not body content — possible structure mismatch.
3. **No embed support:** YouTube/external URLs in extracted_content are not converted to embed blocks during polish.

## Design

### Fix 1: Robust polish pipeline

**File:** `src/lib/ai/lead-magnet-generator.ts` — `polishLeadMagnetContent()`

- Switch from `client.messages.create()` to `client.messages.stream()` + `.get_final_message()`
- Increase `max_tokens` from 8000 to 16000
- Add JSON repair fallback before `JSON.parse()`:
  - Trim trailing whitespace
  - Attempt to close unclosed brackets/braces
  - Strip trailing commas before `}` or `]`
- Keep existing 2-retry logic

### Fix 2: Auto-detect embeds in polish prompt

**File:** `src/lib/ai/lead-magnet-generator.ts` — polish system prompt

- Add instruction to detect YouTube URLs (youtube.com, youtu.be) in extracted_content and convert to `embed` blocks with `provider: "youtube"`
- Also detect other embeddable URLs (Airtable, Loom, etc.) and convert to `embed` blocks

### Fix 3: Investigate and fix ExtractedContentRenderer

**File:** `src/components/content/ExtractedContentRenderer.tsx` (or similar)

- Investigate why #2 and #3 show headings but no body text
- Fix so fallback renderer correctly displays all section contents
- This ensures even un-polished content is usable

### Fix 4: Re-run polish and verify

- After deploying fixes 1-3, re-trigger polish for all 4 lead magnets
- Verify each renders correctly with rich blocks, embeds, and complete content

## Affected Lead Magnets

| # | Title | URL slug | Issue |
|---|-------|----------|-------|
| 1 | $5M LinkedIn Post Database Swipe File | 5m-linkedin-post-database | Needs polish only |
| 2 | How to Write Top 1% LinkedIn Content Pack | top-1-percent-linkedin-content-pack | No body rendered + needs YouTube embeds |
| 3 | $5M Automatic AI Lead Magnet Machine Pack | 5m-ai-lead-magnet-machine-pack | No body rendered |
| 4 | $5M Lead Magnet Swipe File (10,000 Leads) | 5m-lead-magnet-swipe-file | Empty sections under headings |

## Success Criteria

- All 4 pages render with `PolishedContentRenderer` (rich blocks, TOC, stat cards)
- #2 has embedded YouTube videos
- No empty sections on any page
- Polish step succeeds reliably for content up to 30K chars
