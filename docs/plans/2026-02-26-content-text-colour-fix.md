# MOD-334: Content Page Text Colour Invisible Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix invisible text in TableBlock, AccordionBlock, CodeBlock, and ImageBlock when toggling content page theme from dark to light.

**Architecture:** CSS variable names in `ContentBlocks.tsx` don't match what `getThemeVars()` defines. Fix the references to use the correct variable names. Single-file, 7-line change.

**Tech Stack:** React, CSS custom properties, Next.js

---

## Root Cause

`getThemeVars()` sets `--ds-text`, `--ds-body`, `--ds-muted` on the root wrapper div.
`ContentBlocks.tsx` references `--ds-text-heading`, `--ds-text-body`, `--ds-text-muted` — which are never defined.

When `next-themes` keeps `.dark` on `<html>` (defaultTheme="dark"), body text inherits white. Components with undefined CSS vars inherit that white, making them invisible on light backgrounds.

## Fix Map

| File | Line | Current (broken) | Fix to |
|------|------|-------------------|--------|
| `ContentBlocks.tsx` | 252 | `var(--ds-text-body)` | `var(--ds-body)` |
| `ContentBlocks.tsx` | 264 | `var(--ds-text-muted)` | `var(--ds-muted)` |
| `ContentBlocks.tsx` | 285 | `var(--ds-text-heading)` | `var(--ds-text)` |
| `ContentBlocks.tsx` | 297 | `var(--ds-text-body)` | `var(--ds-body)` |
| `ContentBlocks.tsx` | 319 | `var(--ds-text-heading)` | `var(--ds-text)` |
| `ContentBlocks.tsx` | 330 | `var(--ds-text-body)` | `var(--ds-body)` |
| `ContentBlocks.tsx` | 352 | `var(--ds-text-muted)` | `var(--ds-muted)` |

---

### Task 1: Fix CSS variable references

**Files:**
- Modify: `src/components/content/ContentBlocks.tsx` (7 lines)

**Step 1: Replace all mismatched CSS variable names**

Replace `var(--ds-text-body)` → `var(--ds-body)` (3 occurrences)
Replace `var(--ds-text-heading)` → `var(--ds-text)` (2 occurrences)
Replace `var(--ds-text-muted)` → `var(--ds-muted)` (2 occurrences)

**Step 2: Verify build**

Run: `cd /c/Users/deskt/magnetlab && npx next build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/components/content/ContentBlocks.tsx
git commit -m "fix(content): use correct CSS variable names for theme-aware text colors (MOD-334)"
```
