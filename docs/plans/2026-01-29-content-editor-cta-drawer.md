# Content Page Editor, Easy Open & Sticky CTA Drawer

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add in-place content editing for page owners, make the content page easy to open from the dashboard, and add a sticky book-a-call CTA that opens a qualification drawer before showing Calendly.

**Architecture:** Three independent features touching the content page. Feature A adds owner detection + edit mode to the existing `ContentPageClient`. Feature B reorders the `ContentPageTab` layout. Feature C adds a sticky CTA bar and slide-up drawer with qualification flow to the content page. All features share the same page route and client component.

**Tech Stack:** Next.js 15 App Router, React client components, Supabase (admin client for auth check), existing `auth()` from `@/lib/auth`, inline styles (matching existing content page patterns).

---

## Task 1: API — Add PUT endpoint for polished content

**Files:**
- Modify: `src/app/api/lead-magnet/[id]/route.ts` (already has PUT — but we need a dedicated content endpoint for public-page saves)
- Create: `src/app/api/lead-magnet/[id]/content/route.ts`

The existing `PUT /api/lead-magnet/[id]` works but accepts any fields. We need a dedicated authenticated endpoint that only updates `polished_content` and recalculates metadata.

**Step 1: Create the content update endpoint**

Create `src/app/api/lead-magnet/[id]/content/route.ts`:

```typescript
// API Route: Update polished content (for in-place editing)
// PUT /api/lead-magnet/[id]/content

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { PolishedContent } from '@/lib/types/lead-magnet';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const body = await request.json();
    const polishedContent = body.polishedContent as PolishedContent;

    if (!polishedContent || !polishedContent.sections) {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    }

    // Recalculate metadata
    let wordCount = 0;
    for (const section of polishedContent.sections) {
      wordCount += section.introduction.split(/\s+/).length;
      wordCount += section.keyTakeaway.split(/\s+/).length;
      for (const block of section.blocks) {
        if (block.content) {
          wordCount += block.content.split(/\s+/).length;
        }
      }
    }
    wordCount += polishedContent.heroSummary.split(/\s+/).length;
    polishedContent.metadata = {
      wordCount,
      readingTimeMinutes: Math.max(1, Math.round(wordCount / 200)),
    };

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('lead_magnets')
      .update({ polished_content: polishedContent })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('polished_content')
      .single();

    if (error) {
      logApiError('lead-magnet/content/update', error, { userId: session.user.id, leadMagnetId: id });
      return ApiErrors.databaseError('Failed to update content');
    }

    return NextResponse.json({ success: true, polishedContent: data.polished_content });
  } catch (error) {
    logApiError('lead-magnet/content/update', error);
    return ApiErrors.internalError('Failed to update content');
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/lead-magnet/\[id\]/content/route.ts
git commit -m "feat: add PUT /api/lead-magnet/[id]/content endpoint for in-place editing"
```

---

## Task 2: Server — Pass owner & qualification data to content page

**Files:**
- Modify: `src/app/p/[username]/[slug]/content/page.tsx`

The server page needs to:
1. Check if the current viewer is the page owner (via `auth()`)
2. Always pass `calendlyUrl` to the client (not gated server-side anymore)
3. Pass `leadId`, `isQualified`, `hasQuestions`, and `leadMagnetId` so the client can handle CTA/drawer logic

**Step 1: Update the server page**

In `src/app/p/[username]/[slug]/content/page.tsx`, replace the entire `PublicContentPage` function with:

```typescript
import { auth } from '@/lib/auth';
// ... (keep existing imports)

export default async function PublicContentPage({ params, searchParams }: PageProps) {
  const { username, slug } = await params;
  const { leadId } = await searchParams;
  const supabase = createSupabaseAdminClient();

  // Check if viewer is the owner
  let isOwner = false;
  try {
    const session = await auth();
    if (session?.user?.id) {
      const { data: ownerCheck } = await supabase
        .from('users')
        .select('id')
        .eq('id', session.user.id)
        .eq('username', username)
        .single();
      isOwner = !!ownerCheck;
    }
  } catch {
    // Not logged in — that's fine
  }

  // Find user by username
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (userError || !user) {
    notFound();
  }

  // Find published funnel page (owners can view unpublished)
  const query = supabase
    .from('funnel_pages')
    .select(`
      id,
      lead_magnet_id,
      slug,
      is_published,
      theme,
      primary_color,
      background_style,
      logo_url,
      vsl_url,
      calendly_url
    `)
    .eq('user_id', user.id)
    .eq('slug', slug);

  if (!isOwner) {
    query.eq('is_published', true);
  }

  const { data: funnel, error: funnelError } = await query.single();

  if (funnelError || !funnel) {
    notFound();
  }

  if (!isOwner && !funnel.is_published) {
    notFound();
  }

  // Get lead magnet with content
  const { data: leadMagnet, error: lmError } = await supabase
    .from('lead_magnets')
    .select('id, title, extracted_content, polished_content, concept, thumbnail_url')
    .eq('id', funnel.lead_magnet_id)
    .single();

  if (lmError || !leadMagnet) {
    notFound();
  }

  if (!leadMagnet.extracted_content && !leadMagnet.polished_content) {
    notFound();
  }

  // Check lead qualification status and whether questions exist
  let isQualified: boolean | null = null;
  if (leadId) {
    const { data: lead } = await supabase
      .from('funnel_leads')
      .select('is_qualified')
      .eq('id', leadId)
      .eq('funnel_page_id', funnel.id)
      .single();
    isQualified = lead?.is_qualified ?? null;
  }

  // Check if funnel has qualification questions
  let hasQuestions = false;
  if (funnel.calendly_url) {
    const { count } = await supabase
      .from('qualification_questions')
      .select('*', { count: 'exact', head: true })
      .eq('funnel_page_id', funnel.id);
    hasQuestions = (count ?? 0) > 0;
  }

  // Track page view (fire-and-forget, not for owners)
  if (!isOwner) {
    supabase
      .from('page_views')
      .insert({ funnel_page_id: funnel.id, page_type: 'content' })
      .then(() => {});
  }

  return (
    <ContentPageClient
      title={leadMagnet.title}
      polishedContent={leadMagnet.polished_content as PolishedContent | null}
      extractedContent={leadMagnet.extracted_content as ExtractedContent | null}
      concept={leadMagnet.concept as LeadMagnetConcept | null}
      thumbnailUrl={leadMagnet.thumbnail_url}
      theme={(funnel.theme as 'dark' | 'light') || 'dark'}
      primaryColor={funnel.primary_color || '#8b5cf6'}
      logoUrl={funnel.logo_url}
      vslUrl={funnel.vsl_url}
      calendlyUrl={funnel.calendly_url}
      isOwner={isOwner}
      leadMagnetId={leadMagnet.id}
      funnelPageId={funnel.id}
      leadId={leadId || null}
      isQualified={isQualified}
      hasQuestions={hasQuestions}
    />
  );
}
```

Key changes:
- Added `auth()` call to detect owner
- Always passes `calendlyUrl` (client handles gating now)
- Passes `isOwner`, `leadMagnetId`, `funnelPageId`, `leadId`, `isQualified`, `hasQuestions`
- Owners skip page view tracking
- Owners can view unpublished pages

**Step 2: Commit**

```bash
git add src/app/p/\[username\]/\[slug\]/content/page.tsx
git commit -m "feat: pass owner, lead & qualification data to content page client"
```

---

## Task 3: Feature B — Better "Open Content Page" button in dashboard

**Files:**
- Modify: `src/components/funnel/ContentPageTab.tsx`

**Step 1: Reorder the layout**

Replace the entire return block (after the early return for no extracted content) in `ContentPageTab.tsx`:

```typescript
return (
  <div className="space-y-6">
    <h3 className="text-lg font-medium">Content Page</h3>
    <p className="text-sm text-muted-foreground">
      Polish your extracted content into a beautiful, Notion-like reading experience with AI.
    </p>

    {error && (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
      </div>
    )}

    {/* Primary action: Open content page (when polished) */}
    {contentUrl && hasPolished && (
      <a
        href={contentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-3 text-sm font-medium text-white hover:bg-violet-600 transition-colors w-full"
      >
        <ExternalLink className="h-4 w-4" />
        Open Content Page
      </a>
    )}

    {/* Polish status */}
    {hasPolished && polished ? (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">Content polished</span>
        </div>

        {leadMagnet.polishedAt && (
          <p className="text-xs text-muted-foreground">
            Last polished: {new Date(leadMagnet.polishedAt).toLocaleString()}
          </p>
        )}

        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {polished.sections.length} sections
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {polished.metadata.readingTimeMinutes} min read
          </span>
          <span>
            {polished.metadata.wordCount.toLocaleString()} words
          </span>
        </div>
      </div>
    ) : null}

    {/* Secondary: Polish / Re-polish */}
    <button
      onClick={handlePolish}
      disabled={polishing}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        hasPolished
          ? 'border hover:bg-muted/50'
          : 'bg-violet-500 text-white hover:bg-violet-600'
      } disabled:opacity-50`}
    >
      {polishing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {hasPolished ? 'Re-polish Content' : 'Polish Content with AI'}
    </button>
  </div>
);
```

Key changes:
- "Open Content Page" is now a full-width primary button at the top when polished content exists
- Polish/Re-polish moves to a secondary style below the status card
- When no polished content yet, the polish button is still the primary action

**Step 2: Commit**

```bash
git add src/components/funnel/ContentPageTab.tsx
git commit -m "feat: make Open Content Page the primary action in dashboard content tab"
```

---

## Task 4: Client — Add edit mode state and edit controls to ContentPageClient

**Files:**
- Modify: `src/components/content/ContentPageClient.tsx`
- Modify: `src/components/content/ContentHeader.tsx`

**Step 1: Update ContentHeader to accept edit button**

In `src/components/content/ContentHeader.tsx`, add the edit toggle:

```typescript
'use client';

import { Sun, Moon, Pencil, X } from 'lucide-react';

interface ContentHeaderProps {
  logoUrl: string | null;
  isDark: boolean;
  onToggleTheme: () => void;
  isOwner?: boolean;
  isEditing?: boolean;
  onToggleEdit?: () => void;
}

export function ContentHeader({ logoUrl, isDark, onToggleTheme, isOwner, isEditing, onToggleEdit }: ContentHeaderProps) {
  const bgColor = isDark ? 'rgba(9,9,11,0.8)' : 'rgba(250,250,250,0.8)';
  const borderColor = isDark ? '#27272A' : '#E4E4E7';
  const iconColor = isDark ? '#A1A1AA' : '#71717A';

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: bgColor,
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${borderColor}`,
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <div>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ height: '2rem', width: 'auto' }} />
          ) : (
            <div style={{ height: '2rem' }} />
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isOwner && onToggleEdit && (
            <button
              onClick={onToggleEdit}
              style={{
                background: isEditing ? (isDark ? '#27272A' : '#E4E4E7') : 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isEditing ? (isDark ? '#FAFAFA' : '#09090B') : iconColor,
              }}
              aria-label={isEditing ? 'Exit edit mode' : 'Edit content'}
            >
              {isEditing ? <X size={20} /> : <Pencil size={20} />}
            </button>
          )}
          <button
            onClick={onToggleTheme}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: iconColor,
            }}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}
```

**Step 2: Update ContentPageClient interface and state**

In `src/components/content/ContentPageClient.tsx`, update the interface and add edit mode state. The full replacement is in Task 6 where we assemble the complete component. For now, update the interface:

```typescript
interface ContentPageClientProps {
  title: string;
  polishedContent: PolishedContent | null;
  extractedContent: ExtractedContent | null;
  concept: LeadMagnetConcept | null;
  thumbnailUrl: string | null;
  theme: 'dark' | 'light';
  primaryColor: string;
  logoUrl: string | null;
  vslUrl: string | null;
  calendlyUrl: string | null;
  // New props
  isOwner?: boolean;
  leadMagnetId?: string;
  funnelPageId?: string;
  leadId?: string | null;
  isQualified?: boolean | null;
  hasQuestions?: boolean;
}
```

**Step 3: Commit**

```bash
git add src/components/content/ContentHeader.tsx src/components/content/ContentPageClient.tsx
git commit -m "feat: add edit mode toggle to content header and update client props"
```

---

## Task 5: Create EditablePolishedContentRenderer

**Files:**
- Create: `src/components/content/EditablePolishedContentRenderer.tsx`

This is the core editing component. It wraps the same visual blocks but makes text editable and adds structural controls (add/remove/reorder blocks and sections).

**Step 1: Create the editable renderer**

Create `src/components/content/EditablePolishedContentRenderer.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import type { PolishedContent, PolishedSection, PolishedBlock, PolishedBlockType, CalloutStyle } from '@/lib/types/lead-magnet';

interface EditablePolishedContentRendererProps {
  content: PolishedContent;
  isDark: boolean;
  primaryColor: string;
  onChange: (content: PolishedContent) => void;
}

// Inline editable text area that auto-resizes
function EditableText({
  value,
  onChange,
  style,
  multiline = false,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  style: React.CSSProperties;
  multiline?: boolean;
  placeholder?: string;
}) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <Tag
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...style,
        background: 'transparent',
        border: '1px dashed rgba(139,92,246,0.3)',
        borderRadius: '4px',
        padding: '4px 6px',
        outline: 'none',
        width: '100%',
        resize: multiline ? 'vertical' : 'none',
        fontFamily: 'inherit',
        ...(multiline ? { minHeight: '80px' } : {}),
      }}
      onFocus={(e) => {
        (e.target as HTMLElement).style.borderColor = 'rgba(139,92,246,0.6)';
      }}
      onBlur={(e) => {
        (e.target as HTMLElement).style.borderColor = 'rgba(139,92,246,0.3)';
      }}
    />
  );
}

// Block type selector for adding new blocks
function BlockTypeSelector({
  onSelect,
  isDark,
}: {
  onSelect: (type: PolishedBlockType, style?: CalloutStyle) => void;
  isDark: boolean;
}) {
  const borderColor = isDark ? '#27272A' : '#E4E4E7';
  const bgColor = isDark ? '#18181B' : '#FFFFFF';
  const textColor = isDark ? '#A1A1AA' : '#71717A';

  const options: { type: PolishedBlockType; label: string; style?: CalloutStyle }[] = [
    { type: 'paragraph', label: 'Paragraph' },
    { type: 'list', label: 'Bullet List' },
    { type: 'quote', label: 'Quote' },
    { type: 'callout', label: 'Info Callout', style: 'info' },
    { type: 'callout', label: 'Warning', style: 'warning' },
    { type: 'callout', label: 'Success', style: 'success' },
    { type: 'divider', label: 'Divider' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.25rem',
        padding: '0.5rem',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '0.5rem',
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.label}
          onClick={() => onSelect(opt.type, opt.style)}
          style={{
            background: 'none',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.25rem',
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            color: textColor,
            cursor: 'pointer',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function EditablePolishedContentRenderer({
  content,
  isDark,
  primaryColor,
  onChange,
}: EditablePolishedContentRendererProps) {
  const [addingBlockAt, setAddingBlockAt] = useState<{ sectionIdx: number; blockIdx: number } | null>(null);

  const textColor = isDark ? '#FAFAFA' : '#09090B';
  const bodyColor = isDark ? '#E4E4E7' : '#27272A';
  const mutedColor = isDark ? '#A1A1AA' : '#71717A';
  const borderColor = isDark ? '#27272A' : '#E4E4E7';
  const controlBg = isDark ? '#27272A' : '#E4E4E7';

  // Helper to update a section
  const updateSection = (sectionIdx: number, updates: Partial<PolishedSection>) => {
    const newSections = [...content.sections];
    newSections[sectionIdx] = { ...newSections[sectionIdx], ...updates };
    onChange({ ...content, sections: newSections });
  };

  // Helper to update a block
  const updateBlock = (sectionIdx: number, blockIdx: number, updates: Partial<PolishedBlock>) => {
    const newSections = [...content.sections];
    const newBlocks = [...newSections[sectionIdx].blocks];
    newBlocks[blockIdx] = { ...newBlocks[blockIdx], ...updates };
    newSections[sectionIdx] = { ...newSections[sectionIdx], blocks: newBlocks };
    onChange({ ...content, sections: newSections });
  };

  // Add block
  const addBlock = (sectionIdx: number, afterBlockIdx: number, type: PolishedBlockType, style?: CalloutStyle) => {
    const newSections = [...content.sections];
    const newBlocks = [...newSections[sectionIdx].blocks];
    const newBlock: PolishedBlock = {
      type,
      content: type === 'divider' ? '' : 'New content...',
      ...(style ? { style } : {}),
    };
    newBlocks.splice(afterBlockIdx + 1, 0, newBlock);
    newSections[sectionIdx] = { ...newSections[sectionIdx], blocks: newBlocks };
    onChange({ ...content, sections: newSections });
    setAddingBlockAt(null);
  };

  // Delete block
  const deleteBlock = (sectionIdx: number, blockIdx: number) => {
    const newSections = [...content.sections];
    const newBlocks = [...newSections[sectionIdx].blocks];
    newBlocks.splice(blockIdx, 1);
    newSections[sectionIdx] = { ...newSections[sectionIdx], blocks: newBlocks };
    onChange({ ...content, sections: newSections });
  };

  // Move block
  const moveBlock = (sectionIdx: number, blockIdx: number, direction: 'up' | 'down') => {
    const newSections = [...content.sections];
    const newBlocks = [...newSections[sectionIdx].blocks];
    const targetIdx = direction === 'up' ? blockIdx - 1 : blockIdx + 1;
    if (targetIdx < 0 || targetIdx >= newBlocks.length) return;
    [newBlocks[blockIdx], newBlocks[targetIdx]] = [newBlocks[targetIdx], newBlocks[blockIdx]];
    newSections[sectionIdx] = { ...newSections[sectionIdx], blocks: newBlocks };
    onChange({ ...content, sections: newSections });
  };

  // Add section
  const addSection = (afterIdx: number) => {
    const newSections = [...content.sections];
    const newSection: PolishedSection = {
      id: `section-${Date.now()}`,
      sectionName: 'New Section',
      introduction: '',
      blocks: [{ type: 'paragraph', content: 'Start writing...' }],
      keyTakeaway: '',
    };
    newSections.splice(afterIdx + 1, 0, newSection);
    onChange({ ...content, sections: newSections });
  };

  // Delete section
  const deleteSection = (sectionIdx: number) => {
    if (content.sections.length <= 1) return; // Keep at least one section
    const newSections = [...content.sections];
    newSections.splice(sectionIdx, 1);
    onChange({ ...content, sections: newSections });
  };

  // Move section
  const moveSection = (sectionIdx: number, direction: 'up' | 'down') => {
    const newSections = [...content.sections];
    const targetIdx = direction === 'up' ? sectionIdx - 1 : sectionIdx + 1;
    if (targetIdx < 0 || targetIdx >= newSections.length) return;
    [newSections[sectionIdx], newSections[targetIdx]] = [newSections[targetIdx], newSections[sectionIdx]];
    onChange({ ...content, sections: newSections });
  };

  const controlButtonStyle: React.CSSProperties = {
    background: controlBg,
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: mutedColor,
  };

  return (
    <div>
      {/* Editable hero summary */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ fontSize: '0.75rem', color: mutedColor, display: 'block', marginBottom: '0.25rem' }}>
          Hero Summary
        </label>
        <EditableText
          value={content.heroSummary}
          onChange={(val) => onChange({ ...content, heroSummary: val })}
          style={{ fontSize: '1.125rem', lineHeight: '1.75rem', color: bodyColor }}
          multiline
          placeholder="A compelling 1-2 sentence summary..."
        />
      </div>

      {content.sections.map((section, sectionIdx) => (
        <section
          key={section.id}
          id={section.id}
          style={{
            marginBottom: '3rem',
            scrollMarginTop: '5rem',
            position: 'relative',
          }}
        >
          {/* Section controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              marginBottom: '0.5rem',
            }}
          >
            <GripVertical size={14} style={{ color: mutedColor }} />
            <button onClick={() => moveSection(sectionIdx, 'up')} style={controlButtonStyle} disabled={sectionIdx === 0}>
              <ChevronUp size={14} />
            </button>
            <button onClick={() => moveSection(sectionIdx, 'down')} style={controlButtonStyle} disabled={sectionIdx === content.sections.length - 1}>
              <ChevronDown size={14} />
            </button>
            <button
              onClick={() => deleteSection(sectionIdx)}
              style={{ ...controlButtonStyle, color: '#ef4444' }}
              disabled={content.sections.length <= 1}
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Section name */}
          <EditableText
            value={section.sectionName}
            onChange={(val) => updateSection(sectionIdx, { sectionName: val })}
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: '2rem',
              color: textColor,
              marginBottom: '0.75rem',
            }}
            placeholder="Section title"
          />

          {/* Section introduction */}
          <EditableText
            value={section.introduction}
            onChange={(val) => updateSection(sectionIdx, { introduction: val })}
            style={{
              fontSize: '1.125rem',
              lineHeight: '1.875rem',
              color: mutedColor,
              fontStyle: 'italic',
              marginBottom: '1.5rem',
            }}
            multiline
            placeholder="Section introduction (optional)"
          />

          {/* Blocks */}
          {section.blocks.map((block, blockIdx) => (
            <div key={blockIdx} style={{ position: 'relative', marginBottom: '0.5rem' }}>
              {/* Block controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  marginBottom: '0.25rem',
                }}
              >
                <span style={{ fontSize: '0.65rem', color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {block.type}{block.style ? ` (${block.style})` : ''}
                </span>
                <button onClick={() => moveBlock(sectionIdx, blockIdx, 'up')} style={controlButtonStyle} disabled={blockIdx === 0}>
                  <ChevronUp size={12} />
                </button>
                <button onClick={() => moveBlock(sectionIdx, blockIdx, 'down')} style={controlButtonStyle} disabled={blockIdx === section.blocks.length - 1}>
                  <ChevronDown size={12} />
                </button>
                <button onClick={() => deleteBlock(sectionIdx, blockIdx)} style={{ ...controlButtonStyle, color: '#ef4444' }}>
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Block content */}
              {block.type === 'divider' ? (
                <hr style={{ border: 'none', borderTop: `1px solid ${borderColor}`, margin: '1rem 0' }} />
              ) : (
                <EditableText
                  value={block.content}
                  onChange={(val) => updateBlock(sectionIdx, blockIdx, { content: val })}
                  style={{
                    fontSize: '1rem',
                    lineHeight: '1.75rem',
                    color: bodyColor,
                  }}
                  multiline
                  placeholder="Block content..."
                />
              )}

              {/* Add block button */}
              <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
                {addingBlockAt?.sectionIdx === sectionIdx && addingBlockAt?.blockIdx === blockIdx ? (
                  <BlockTypeSelector
                    onSelect={(type, style) => addBlock(sectionIdx, blockIdx, type, style)}
                    isDark={isDark}
                  />
                ) : (
                  <button
                    onClick={() => setAddingBlockAt({ sectionIdx, blockIdx })}
                    style={{
                      background: 'none',
                      border: `1px dashed ${borderColor}`,
                      borderRadius: '4px',
                      padding: '2px 12px',
                      fontSize: '0.75rem',
                      color: mutedColor,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={12} /> Add block
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Key takeaway */}
          <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.75rem', color: mutedColor, display: 'block', marginBottom: '0.25rem' }}>
              Key Takeaway
            </label>
            <EditableText
              value={section.keyTakeaway}
              onChange={(val) => updateSection(sectionIdx, { keyTakeaway: val })}
              style={{ fontSize: '1rem', lineHeight: '1.75rem', color: bodyColor }}
              placeholder="Key takeaway for this section (optional)"
            />
          </div>

          {/* Section divider + add section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
            <hr style={{ flex: 1, border: 'none', borderTop: `1px solid ${borderColor}` }} />
            <button
              onClick={() => addSection(sectionIdx)}
              style={{
                background: 'none',
                border: `1px dashed ${borderColor}`,
                borderRadius: '4px',
                padding: '4px 12px',
                fontSize: '0.75rem',
                color: mutedColor,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              <Plus size={12} /> Add section
            </button>
            <hr style={{ flex: 1, border: 'none', borderTop: `1px solid ${borderColor}` }} />
          </div>
        </section>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/content/EditablePolishedContentRenderer.tsx
git commit -m "feat: create EditablePolishedContentRenderer with structural editing controls"
```

---

## Task 6: Create BookCallDrawer component

**Files:**
- Create: `src/components/content/BookCallDrawer.tsx`

This is the slide-up drawer that handles qualification questions and then shows Calendly.

**Step 1: Create the drawer component**

Create `src/components/content/BookCallDrawer.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { CalendlyEmbed } from '@/components/funnel/public/CalendlyEmbed';

type AnswerType = 'yes_no' | 'text' | 'textarea' | 'multiple_choice';

interface Question {
  id: string;
  questionText: string;
  questionOrder: number;
  answerType: AnswerType;
  options: string[] | null;
  placeholder: string | null;
  isRequired: boolean;
}

interface BookCallDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  calendlyUrl: string;
  funnelPageId: string;
  leadId: string;
  isQualified: boolean | null;
  hasQuestions: boolean;
  isDark: boolean;
  primaryColor: string;
}

export function BookCallDrawer({
  isOpen,
  onClose,
  calendlyUrl,
  funnelPageId,
  leadId,
  isQualified: initialQualified,
  hasQuestions,
  isDark,
  primaryColor,
}: BookCallDrawerProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentTextValue, setCurrentTextValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [qualificationComplete, setQualificationComplete] = useState(false);
  const [isQualified, setIsQualified] = useState<boolean | null>(initialQualified);
  const [error, setError] = useState<string | null>(null);

  const textColor = isDark ? '#FAFAFA' : '#09090B';
  const mutedColor = isDark ? '#A1A1AA' : '#71717A';
  const borderColor = isDark ? '#27272A' : '#E4E4E7';
  const cardBg = isDark ? '#18181B' : '#FFFFFF';
  const bgColor = isDark ? '#09090B' : '#FAFAFA';

  // Determine initial state
  const skipQualification = initialQualified === true || !hasQuestions;

  // Fetch questions when drawer opens
  useEffect(() => {
    if (!isOpen || skipQualification) {
      if (skipQualification) setQualificationComplete(true);
      return;
    }

    setLoading(true);
    fetch(`/api/public/page/${funnelPageId}/questions`)
      .then((res) => res.json())
      .then((data) => {
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
        } else {
          setQualificationComplete(true);
          setIsQualified(true);
        }
      })
      .catch(() => {
        setQualificationComplete(true);
        setIsQualified(true);
      })
      .finally(() => setLoading(false));
  }, [isOpen, funnelPageId, skipQualification]);

  const currentQuestion = questions[currentQuestionIndex];

  const submitAllAnswers = async (finalAnswers: Record<string, string>) => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, answers: finalAnswers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit');
      setIsQualified(data.isQualified);
      setQualificationComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const advanceOrSubmit = (newAnswers: Record<string, string>) => {
    setError(null);
    setCurrentTextValue('');
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      submitAllAnswers(newAnswers);
    }
  };

  const handleAnswer = (answer: string) => {
    if (!currentQuestion) return;
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);
    advanceOrSubmit(newAnswers);
  };

  const handleTextSubmit = () => {
    if (!currentQuestion) return;
    if (currentQuestion.isRequired && !currentTextValue.trim()) {
      setError('This question requires an answer.');
      return;
    }
    handleAnswer(currentTextValue.trim());
  };

  const handleSkip = () => {
    if (!currentQuestion) return;
    setError(null);
    setCurrentTextValue('');
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      submitAllAnswers(answers);
    }
  };

  // Reset state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentQuestionIndex(0);
      setAnswers({});
      setCurrentTextValue('');
      setError(null);
      if (!skipQualification) {
        setQualificationComplete(false);
        setIsQualified(initialQualified);
      }
    }
  }, [isOpen, skipQualification, initialQualified]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 99,
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: bgColor,
          borderTop: `1px solid ${borderColor}`,
          borderRadius: '1rem 1rem 0 0',
          maxHeight: '90vh',
          overflowY: 'auto',
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>

        {/* Handle bar + close */}
        <div style={{ padding: '0.75rem 1.5rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '2rem', height: '0.25rem', background: borderColor, borderRadius: '2px', margin: '0 auto' }} />
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: mutedColor, padding: '0.5rem', position: 'absolute', right: '1rem', top: '0.5rem' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1rem 1.5rem 2rem', maxWidth: '600px', margin: '0 auto' }}>
          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 size={24} style={{ color: primaryColor, animation: 'spin 1s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Questions */}
          {!loading && !qualificationComplete && questions.length > 0 && (
            <div>
              {/* Progress */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.875rem', color: mutedColor }}>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: i <= currentQuestionIndex ? primaryColor : borderColor,
                      }}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>
              )}

              {submitting ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <Loader2 size={24} style={{ color: primaryColor, animation: 'spin 1s linear infinite' }} />
                </div>
              ) : currentQuestion && (
                <>
                  <p style={{ fontSize: '1.125rem', fontWeight: 500, color: textColor, marginBottom: '1rem' }}>
                    {currentQuestion.questionText}
                  </p>

                  {currentQuestion.answerType === 'yes_no' && (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      {['yes', 'no'].map((ans) => (
                        <button
                          key={ans}
                          onClick={() => handleAnswer(ans)}
                          style={{
                            flex: 1,
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            border: `1px solid ${borderColor}`,
                            background: cardBg,
                            color: textColor,
                            fontWeight: 500,
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          {ans}
                        </button>
                      ))}
                    </div>
                  )}

                  {(currentQuestion.answerType === 'text' || currentQuestion.answerType === 'textarea') && (
                    <div>
                      {currentQuestion.answerType === 'textarea' ? (
                        <textarea
                          value={currentTextValue}
                          onChange={(e) => setCurrentTextValue(e.target.value)}
                          placeholder={currentQuestion.placeholder || 'Type your answer...'}
                          rows={4}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            border: `1px solid ${borderColor}`,
                            background: cardBg,
                            color: textColor,
                            resize: 'none',
                            outline: 'none',
                            fontFamily: 'inherit',
                            fontSize: '0.875rem',
                          }}
                          autoFocus
                        />
                      ) : (
                        <input
                          type="text"
                          value={currentTextValue}
                          onChange={(e) => setCurrentTextValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                          placeholder={currentQuestion.placeholder || 'Type your answer...'}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            border: `1px solid ${borderColor}`,
                            background: cardBg,
                            color: textColor,
                            outline: 'none',
                            fontFamily: 'inherit',
                            fontSize: '0.875rem',
                          }}
                          autoFocus
                        />
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                        {!currentQuestion.isRequired && (
                          <button onClick={handleSkip} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '0.875rem' }}>
                            Skip
                          </button>
                        )}
                        <button
                          onClick={handleTextSubmit}
                          style={{
                            marginLeft: 'auto',
                            padding: '0.5rem 1.5rem',
                            borderRadius: '0.5rem',
                            background: primaryColor,
                            color: '#FFFFFF',
                            border: 'none',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}

                  {currentQuestion.answerType === 'multiple_choice' && currentQuestion.options && (
                    <div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {currentQuestion.options.map((option) => (
                          <button
                            key={option}
                            onClick={() => handleAnswer(option)}
                            style={{
                              textAlign: 'left',
                              padding: '0.75rem',
                              borderRadius: '0.5rem',
                              border: `1px solid ${borderColor}`,
                              background: cardBg,
                              color: textColor,
                              fontWeight: 500,
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                            }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      {!currentQuestion.isRequired && (
                        <button onClick={handleSkip} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '0.875rem', marginTop: '0.75rem' }}>
                          Skip
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Qualification result */}
          {qualificationComplete && isQualified !== null && !isQualified && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <XCircle size={32} style={{ color: '#ef4444', margin: '0 auto 0.75rem' }} />
              <p style={{ color: '#ef4444', fontWeight: 500 }}>Thanks for your interest!</p>
            </div>
          )}

          {/* Calendly (qualified or no questions) */}
          {qualificationComplete && (isQualified === true || isQualified === null) && (
            <div>
              {isQualified === true && hasQuestions && (
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <CheckCircle2 size={32} style={{ color: '#22c55e', margin: '0 auto 0.75rem' }} />
                  <p style={{ color: '#22c55e', fontWeight: 500, marginBottom: '0.5rem' }}>You qualify! Book your call below.</p>
                </div>
              )}
              <CalendlyEmbed url={calendlyUrl} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/content/BookCallDrawer.tsx
git commit -m "feat: create BookCallDrawer with qualification questions and Calendly embed"
```

---

## Task 7: API — Public endpoint for qualification questions

**Files:**
- Create: `src/app/api/public/page/[id]/questions/route.ts`

The drawer needs to fetch qualification questions for a funnel page without auth.

**Step 1: Create the public questions endpoint**

Create `src/app/api/public/page/[id]/questions/route.ts`:

```typescript
// API Route: Public - Get qualification questions for a funnel page
// GET /api/public/page/[id]/questions

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logApiError } from '@/lib/api/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: funnelPageId } = await params;
    const supabase = createSupabaseAdminClient();

    // Verify page exists and is published
    const { data: funnel, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id, is_published')
      .eq('id', funnelPageId)
      .single();

    if (funnelError || !funnel || !funnel.is_published) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Get questions
    const { data: questions, error: questionsError } = await supabase
      .from('qualification_questions')
      .select('id, question_text, question_order, answer_type, options, placeholder, is_required')
      .eq('funnel_page_id', funnelPageId)
      .order('question_order', { ascending: true });

    if (questionsError) {
      logApiError('public/page/questions', questionsError, { funnelPageId });
      return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 });
    }

    // Map to camelCase for client
    const mapped = (questions || []).map((q) => ({
      id: q.id,
      questionText: q.question_text,
      questionOrder: q.question_order,
      answerType: q.answer_type,
      options: q.options,
      placeholder: q.placeholder,
      isRequired: q.is_required,
    }));

    return NextResponse.json({ questions: mapped });
  } catch (error) {
    logApiError('public/page/questions', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/public/page/\[id\]/questions/route.ts
git commit -m "feat: add public API for fetching qualification questions by funnel page"
```

---

## Task 8: Assemble — Wire everything into ContentPageClient

**Files:**
- Modify: `src/components/content/ContentPageClient.tsx`

This is the final assembly. Replace the full file with the updated version that includes edit mode, the save bar, the sticky CTA, and the drawer.

**Step 1: Rewrite ContentPageClient.tsx**

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { ContentHeader } from './ContentHeader';
import { ContentHero } from './ContentHero';
import { TableOfContents } from './TableOfContents';
import { PolishedContentRenderer } from './PolishedContentRenderer';
import { EditablePolishedContentRenderer } from './EditablePolishedContentRenderer';
import { ExtractedContentRenderer } from './ExtractedContentRenderer';
import { ContentFooter } from './ContentFooter';
import { VideoEmbed } from '@/components/funnel/public/VideoEmbed';
import { BookCallDrawer } from './BookCallDrawer';
import type { PolishedContent, ExtractedContent, LeadMagnetConcept } from '@/lib/types/lead-magnet';

interface ContentPageClientProps {
  title: string;
  polishedContent: PolishedContent | null;
  extractedContent: ExtractedContent | null;
  concept: LeadMagnetConcept | null;
  thumbnailUrl: string | null;
  theme: 'dark' | 'light';
  primaryColor: string;
  logoUrl: string | null;
  vslUrl: string | null;
  calendlyUrl: string | null;
  isOwner?: boolean;
  leadMagnetId?: string;
  funnelPageId?: string;
  leadId?: string | null;
  isQualified?: boolean | null;
  hasQuestions?: boolean;
}

export function ContentPageClient({
  title,
  polishedContent,
  extractedContent,
  theme: initialTheme,
  primaryColor,
  logoUrl,
  vslUrl,
  calendlyUrl,
  isOwner = false,
  leadMagnetId,
  funnelPageId,
  leadId,
  isQualified = null,
  hasQuestions = false,
}: ContentPageClientProps) {
  const [isDark, setIsDark] = useState(initialTheme === 'dark');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<PolishedContent | null>(polishedContent);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const bgColor = isDark ? '#09090B' : '#FAFAFA';
  const borderColor = isDark ? '#27272A' : '#E4E4E7';
  const textColor = isDark ? '#FAFAFA' : '#09090B';

  // The content to display (edited or original)
  const displayContent = isEditing ? editContent : polishedContent;

  // Build TOC sections
  const tocSections = displayContent
    ? displayContent.sections.map((s) => ({ id: s.id, name: s.sectionName }))
    : extractedContent
      ? extractedContent.structure.map((s, i) => ({ id: `section-${i}`, name: s.sectionName }))
      : [];

  const heroSummary = displayContent?.heroSummary || null;
  const readingTime = displayContent?.metadata?.readingTimeMinutes || null;
  const wordCount = displayContent?.metadata?.wordCount || null;

  const handleToggleEdit = useCallback(() => {
    if (isEditing) {
      // Discard changes
      setEditContent(polishedContent);
    }
    setIsEditing(!isEditing);
    setSaveError(null);
  }, [isEditing, polishedContent]);

  const handleSave = async () => {
    if (!editContent || !leadMagnetId) return;
    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/lead-magnet/${leadMagnetId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polishedContent: editContent }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      // Update the base content after successful save
      // Exit edit mode — the page will use the saved content
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Show sticky CTA when calendly is configured, user has a leadId, and not in edit mode
  const showStickyCta = !!calendlyUrl && !!leadId && !!funnelPageId && !isEditing;

  return (
    <div style={{ background: bgColor, minHeight: '100vh', paddingBottom: showStickyCta ? '5rem' : undefined }}>
      <ContentHeader
        logoUrl={logoUrl}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        isOwner={isOwner}
        isEditing={isEditing}
        onToggleEdit={polishedContent ? handleToggleEdit : undefined}
      />

      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '2rem 1.5rem',
        }}
      >
        {/* Hero */}
        <div style={{ maxWidth: '700px' }}>
          <ContentHero
            title={title}
            heroSummary={heroSummary}
            readingTimeMinutes={readingTime}
            wordCount={wordCount}
            isDark={isDark}
          />
        </div>

        {/* Video */}
        {vslUrl && (
          <div style={{ maxWidth: '700px', marginBottom: '2.5rem' }}>
            <VideoEmbed url={vslUrl} />
          </div>
        )}

        {/* TOC + Content layout */}
        <div style={{ display: 'flex', gap: '3rem' }}>
          {/* Main content */}
          <div style={{ maxWidth: '700px', flex: 1, minWidth: 0 }}>
            {isEditing && editContent ? (
              <EditablePolishedContentRenderer
                content={editContent}
                isDark={isDark}
                primaryColor={primaryColor}
                onChange={setEditContent}
              />
            ) : displayContent ? (
              <PolishedContentRenderer
                content={displayContent}
                isDark={isDark}
                primaryColor={primaryColor}
              />
            ) : extractedContent ? (
              <ExtractedContentRenderer
                content={extractedContent}
                isDark={isDark}
              />
            ) : null}
          </div>

          {/* TOC sidebar */}
          {!isEditing && tocSections.length > 1 && (
            <TableOfContents
              sections={tocSections}
              isDark={isDark}
              primaryColor={primaryColor}
            />
          )}
        </div>
      </div>

      <ContentFooter isDark={isDark} />

      {/* Edit mode save bar */}
      {isEditing && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 60,
            background: isDark ? 'rgba(9,9,11,0.95)' : 'rgba(250,250,250,0.95)',
            borderTop: `1px solid ${borderColor}`,
            backdropFilter: 'blur(12px)',
            padding: '0.75rem 1.5rem',
          }}
        >
          <div
            style={{
              maxWidth: '1100px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              {saveError && (
                <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{saveError}</p>
              )}
              {!saveError && (
                <p style={{ color: isDark ? '#A1A1AA' : '#71717A', fontSize: '0.875rem' }}>
                  Editing mode — changes are not saved until you click Save
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleToggleEdit}
                disabled={saving}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: `1px solid ${borderColor}`,
                  background: 'transparent',
                  color: textColor,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: primaryColor,
                  color: '#FFFFFF',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Book-a-Call CTA */}
      {showStickyCta && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 60,
            background: isDark ? 'rgba(9,9,11,0.95)' : 'rgba(250,250,250,0.95)',
            borderTop: `1px solid ${borderColor}`,
            backdropFilter: 'blur(12px)',
            padding: '0.75rem 1.5rem',
          }}
        >
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <button
              onClick={() => setDrawerOpen(true)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: primaryColor,
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              Book a Call
            </button>
          </div>
        </div>
      )}

      {/* Book Call Drawer */}
      {showStickyCta && funnelPageId && leadId && (
        <BookCallDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          calendlyUrl={calendlyUrl!}
          funnelPageId={funnelPageId}
          leadId={leadId}
          isQualified={isQualified ?? null}
          hasQuestions={hasQuestions}
          isDark={isDark}
          primaryColor={primaryColor}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/content/ContentPageClient.tsx
git commit -m "feat: wire edit mode, save bar, sticky CTA, and book call drawer into content page"
```

---

## Task 9: Verify & polish

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors.

**Step 2: Run dev server and test locally**

```bash
npm run dev
```

Test:
1. Navigate to a content page as the owner — edit button should appear
2. Click edit — all text becomes editable, structural controls appear
3. Add/remove/reorder blocks and sections
4. Save — content persists
5. Discard — reverts to original
6. As a non-owner with `?leadId=xxx` — sticky CTA appears
7. Click "Book a Call" — drawer slides up with questions
8. Answer questions — qualification result appears
9. If qualified — Calendly embed shows in drawer
10. In dashboard Content tab — "Open Content Page" is now the primary button

**Step 3: Final commit**

```bash
git add -A
git commit -m "fix: address any type errors and polish content page features"
```

---

## Summary of files changed/created

| Action | File |
|--------|------|
| Create | `src/app/api/lead-magnet/[id]/content/route.ts` |
| Create | `src/app/api/public/page/[id]/questions/route.ts` |
| Create | `src/components/content/EditablePolishedContentRenderer.tsx` |
| Create | `src/components/content/BookCallDrawer.tsx` |
| Modify | `src/app/p/[username]/[slug]/content/page.tsx` |
| Modify | `src/components/content/ContentPageClient.tsx` |
| Modify | `src/components/content/ContentHeader.tsx` |
| Modify | `src/components/funnel/ContentPageTab.tsx` |
