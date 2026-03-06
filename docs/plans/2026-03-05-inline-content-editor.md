# Inline Content Editor — Full-Page Takeover

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the view-only ContentPageTab with a full-page inline editor that renders the actual lead magnet content page within the dashboard, letting users edit content WYSIWYG-style and save without leaving the magnet detail page.

**Architecture:** When the user clicks "Edit Content" in the funnel builder's content tab, the dashboard transitions to a full-page content editor view. This view embeds `ContentPageClient` (the same component used on the public page) in edit mode, with a top toolbar for saving and navigating back. The user edits on the actual rendered page, then saves and returns to the dashboard.

**Tech Stack:** React, Next.js App Router, existing `ContentPageClient` + `InlineContentEditor` components, existing `PUT /api/lead-magnet/[id]/content` API.

---

## Task 1: Create `ContentEditorFullPage` wrapper component

**Files:**
- Create: `src/components/content/ContentEditorFullPage.tsx`

**Step 1: Create the component**

This component wraps `ContentPageClient` in edit mode with a top toolbar (back button, save button, status indicator). It receives the same data `ContentPageTab` has access to and renders the content page inline.

```tsx
'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Save, Loader2, X } from 'lucide-react';
import { ContentPageClient } from './ContentPageClient';
import type { PolishedContent, ExtractedContent, LeadMagnetConcept } from '@/lib/types/lead-magnet';

interface ContentEditorFullPageProps {
  leadMagnetId: string;
  title: string;
  polishedContent: PolishedContent | null;
  extractedContent: ExtractedContent | null;
  concept: LeadMagnetConcept | null;
  theme: 'dark' | 'light';
  primaryColor: string;
  logoUrl: string | null;
  fontFamily?: string | null;
  fontUrl?: string | null;
  vslUrl: string | null;
  onClose: () => void;
  onSaved: (content: PolishedContent) => void;
}

export function ContentEditorFullPage({
  leadMagnetId,
  title,
  polishedContent,
  extractedContent,
  concept,
  theme,
  primaryColor,
  logoUrl,
  fontFamily,
  fontUrl,
  vslUrl,
  onClose,
  onSaved,
}: ContentEditorFullPageProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto">
      {/* Toolbar */}
      <div className="sticky top-0 z-60 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 py-2">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Funnel Builder
        </button>
        <span className="text-sm font-medium">Editing: {title}</span>
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content page in edit mode */}
      <ContentPageClient
        title={title}
        polishedContent={polishedContent}
        extractedContent={extractedContent}
        concept={concept}
        thumbnailUrl={null}
        theme={theme}
        primaryColor={primaryColor}
        logoUrl={logoUrl}
        fontFamily={fontFamily}
        fontUrl={fontUrl}
        vslUrl={vslUrl}
        calendlyUrl={null}
        isOwner={true}
        leadMagnetId={leadMagnetId}
        autoEdit={true}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/content/ContentEditorFullPage.tsx
git commit -m "feat(MOD-346): add ContentEditorFullPage wrapper component"
```

---

## Task 2: Wire `onSaved` callback into `ContentPageClient`

**Files:**
- Modify: `src/components/content/ContentPageClient.tsx`

The current `ContentPageClient` handles save internally. We need it to notify the parent when content is saved so `ContentEditorFullPage` can update the parent state and close.

**Step 1: Add `onSaved` prop to `ContentPageClient`**

In the interface `ContentPageClientProps`, add:
```tsx
onSaved?: (content: PolishedContent) => void;
```

In the destructured props, add `onSaved`.

**Step 2: Call `onSaved` after successful save**

In `handleSave`, after `setSavedContent(editContent)` and `setIsEditing(false)`, add:
```tsx
if (onSaved) onSaved(editContent);
```

**Step 3: Commit**

```bash
git add src/components/content/ContentPageClient.tsx
git commit -m "feat(MOD-346): add onSaved callback to ContentPageClient"
```

---

## Task 3: Replace `ContentPageTab` redirect with full-page editor

**Files:**
- Modify: `src/components/funnel/ContentPageTab.tsx`
- Modify: `src/components/funnel/FunnelBuilder.tsx`

**Step 1: Add `onEditContent` prop to `ContentPageTab`**

Instead of opening a new tab, `ContentPageTab` calls a callback to signal the parent should show the full-page editor.

In `ContentPageTab`, change the interface to add:
```tsx
onEditContent?: () => void;
```

Replace the "Edit Content" link (lines 272-282) with a button that calls `onEditContent`:
```tsx
{polished && onEditContent && (
  <button
    onClick={onEditContent}
    className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
  >
    <PenLine className="h-4 w-4" />
    Edit Content
  </button>
)}
```

Also update `handleStartBlank` — instead of `window.open(...)`, call `onEditContent` after saving:
```tsx
// Replace: window.open(`${contentUrl}?edit=true`, '_blank');
// With:
if (onEditContent) onEditContent();
```

Keep the "Open Content Page" link (lines 229-239) as-is — users may still want to view the live public page.

**Step 2: Add full-page editor state to `FunnelBuilder`**

In `FunnelBuilder.tsx`, add state and import:
```tsx
import { ContentEditorFullPage } from '@/components/content/ContentEditorFullPage';

const [contentEditorOpen, setContentEditorOpen] = useState(false);
```

Pass `onEditContent` to `ContentPageTab`:
```tsx
<ContentPageTab
  leadMagnet={currentLeadMagnet}
  username={username}
  slug={slug}
  onPolished={(polishedContent, polishedAt, extractedContent) => {
    setCurrentLeadMagnet({
      ...currentLeadMagnet,
      polishedContent,
      polishedAt,
      ...(extractedContent ? { extractedContent } : {}),
    });
  }}
  onEditContent={() => setContentEditorOpen(true)}
/>
```

Render `ContentEditorFullPage` when `contentEditorOpen` is true. Add this at the end of the FunnelBuilder return, before the closing `</div>`:

```tsx
{contentEditorOpen && currentLeadMagnet && (
  <ContentEditorFullPage
    leadMagnetId={currentLeadMagnet.id}
    title={currentLeadMagnet.title}
    polishedContent={currentLeadMagnet.polishedContent as PolishedContent | null}
    extractedContent={currentLeadMagnet.extractedContent as ExtractedContent | null}
    concept={currentLeadMagnet.concept as LeadMagnetConcept | null}
    theme={theme}
    primaryColor={primaryColor}
    logoUrl={logoUrl}
    fontFamily={funnel?.fontFamily}
    fontUrl={funnel?.fontUrl}
    vslUrl={vslUrl}
    onClose={() => setContentEditorOpen(false)}
    onSaved={(content) => {
      setCurrentLeadMagnet({
        ...currentLeadMagnet,
        polishedContent: content,
        polishedAt: new Date().toISOString(),
      });
      setContentEditorOpen(false);
    }}
  />
)}
```

**Step 3: Commit**

```bash
git add src/components/funnel/ContentPageTab.tsx src/components/funnel/FunnelBuilder.tsx
git commit -m "feat(MOD-346): wire full-page content editor into funnel builder"
```

---

## Task 4: Type-check and verify

**Step 1: Run type check**

```bash
cd /c/Users/deskt/magnetlab && npx tsc --noEmit --pretty 2>&1 | grep -E "ContentEditor|ContentPageTab|ContentPageClient|FunnelBuilder" | head -20
```

Expected: No errors in these files.

**Step 2: Manual verification**

Open the magnet detail page → Funnel tab → Content sub-tab. Click "Edit Content" — should open the full-page editor overlay with the rendered content page in edit mode. Make an edit, save — should close and return to the funnel builder with updated content.

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(MOD-346): resolve type/integration issues"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Create `ContentEditorFullPage` wrapper | New: `ContentEditorFullPage.tsx` |
| 2 | Add `onSaved` callback to `ContentPageClient` | Modify: `ContentPageClient.tsx` |
| 3 | Wire everything together | Modify: `ContentPageTab.tsx`, `FunnelBuilder.tsx` |
| 4 | Type-check and verify | N/A |
