# Style Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users extract writing styles from LinkedIn URLs automatically, browse them in the Library tab, and mix-and-match traits into team members' voice profiles.

**Architecture:** New API route wires existing Apify scraper → existing style extractor. New "Styles" subsection in Library tab shows style cards with trait breakdowns. Style mixer modal lets users cherry-pick traits from any extracted style into a team member's voice_profile JSONB via existing PATCH endpoint.

**Tech Stack:** Next.js API routes, Apify (`scrapeProfilePosts`), Claude Sonnet (`extractWritingStyle`), Supabase (`cp_writing_styles`, `team_profiles`), React (client components), sonner (toasts)

---

### Task 1: Extract-from-URL API Route

**Files:**
- Create: `src/app/api/content-pipeline/styles/extract-from-url/route.ts`

**Context:**
- `scrapeProfilePosts(url, limit)` in `src/lib/integrations/apify-engagers.ts` returns `{ data: ApifyPost[], error: string | null }`. Each `ApifyPost` has `.text` (post content), `.authorName`, `.author.occupation`.
- `extractWritingStyle({ posts, authorName, authorHeadline })` in `src/lib/ai/style-extractor.ts` takes string array of posts + optional author info, returns `ExtractedStyle`.
- `POST /api/content-pipeline/styles/extract/route.ts` shows the exact pattern for inserting into `cp_writing_styles` with embedding generation.
- The existing extract route takes `{ posts: string[] }` (pre-scraped). This new route takes `{ linkedin_url: string }` and handles scraping automatically.

**Step 1: Create the route**

```typescript
// src/app/api/content-pipeline/styles/extract-from-url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { scrapeProfilePosts } from '@/lib/integrations/apify-engagers';
import { extractWritingStyle } from '@/lib/ai/style-extractor';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { logError } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { linkedin_url, author_name } = body;

    if (!linkedin_url || typeof linkedin_url !== 'string') {
      return NextResponse.json({ error: 'linkedin_url is required' }, { status: 400 });
    }

    // Normalize URL — accept full URLs or /in/slug
    const normalizedUrl = linkedin_url.includes('linkedin.com')
      ? linkedin_url
      : `https://www.linkedin.com/in/${linkedin_url.replace(/^\/in\//, '')}`;

    // Step 1: Scrape posts via Apify
    const { data: posts, error: scrapeError } = await scrapeProfilePosts(normalizedUrl, 10);

    if (scrapeError) {
      return NextResponse.json({ error: `Failed to scrape profile: ${scrapeError}` }, { status: 502 });
    }

    // Filter to posts with actual text content
    const textPosts = posts.filter((p) => p.text && p.text.trim().length > 50);

    if (textPosts.length < 3) {
      return NextResponse.json(
        { error: `Only found ${textPosts.length} posts with text content. Need at least 3.` },
        { status: 422 }
      );
    }

    // Step 2: Extract style
    const authorInfo = textPosts[0]?.author;
    const extractedStyle = await extractWritingStyle({
      posts: textPosts.map((p) => p.text),
      authorName: author_name || authorInfo?.firstName
        ? `${authorInfo.firstName} ${authorInfo.lastName}`
        : textPosts[0]?.authorName,
      authorHeadline: authorInfo?.occupation,
    });

    // Step 3: Generate embedding
    let embedding: number[] | null = null;
    try {
      const embeddingText = `Style: ${extractedStyle.name}. ${extractedStyle.description}. Tone: ${extractedStyle.style_profile.tone}. Patterns: ${extractedStyle.style_profile.hook_patterns.join(', ')}`;
      embedding = await generateEmbedding(embeddingText);
    } catch {
      // Continue without embedding
    }

    // Step 4: Insert into DB
    const supabase = createSupabaseAdminClient();

    const insertData: Record<string, unknown> = {
      user_id: session.user.id,
      name: extractedStyle.name,
      description: extractedStyle.description,
      source_linkedin_url: normalizedUrl,
      source_posts_analyzed: textPosts.length,
      style_profile: extractedStyle.style_profile,
      example_posts: extractedStyle.example_posts,
    };
    if (embedding) {
      insertData.embedding = JSON.stringify(embedding);
    }

    const { data, error } = await supabase
      .from('cp_writing_styles')
      .insert(insertData)
      .select('id, user_id, name, description, source_linkedin_url, source_posts_analyzed, style_profile, example_posts, is_active, last_updated_at, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      style: data,
      key_patterns: extractedStyle.key_patterns,
      recommendations: extractedStyle.recommendations,
      posts_analyzed: textPosts.length,
    }, { status: 201 });
  } catch (error) {
    logError('cp/styles', error, { step: 'extract_from_url_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 2: Verify it compiles**

Run: `npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/app/api/content-pipeline/styles/extract-from-url/route.ts
git commit -m "feat: add extract-from-url API route for style extraction"
```

---

### Task 2: Library Tab — Add "Styles" Pill

**Files:**
- Modify: `src/components/content-pipeline/LibraryTab.tsx`
- Create: `src/components/content-pipeline/StylesSection.tsx`

**Context:**
- `LibraryTab.tsx` currently has two pills: "Templates" and "Inspiration" toggling between `TemplatesTab` and `SwipeFileContent`.
- We add a third pill: "Styles" loading a new `StylesSection` component.
- Use the same `dynamic()` + `cn()` pattern as existing pills.

**Step 1: Create StylesSection placeholder**

```typescript
// src/components/content-pipeline/StylesSection.tsx
'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, Link2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WritingStyle, StyleProfile } from '@/lib/types/content-pipeline';

export function StylesSection() {
  const [styles, setStyles] = useState<WritingStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [url, setUrl] = useState('');
  const [authorName, setAuthorName] = useState('');

  // Fetch styles on mount
  const fetchStyles = useCallback(async () => {
    try {
      const res = await fetch('/api/content-pipeline/styles');
      const data = await res.json();
      setStyles(data.styles || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useState(() => { fetchStyles(); });

  const handleExtract = async () => {
    if (!url.trim()) return;
    setExtracting(true);
    try {
      const res = await fetch('/api/content-pipeline/styles/extract-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedin_url: url.trim(),
          author_name: authorName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to extract style');
        return;
      }
      toast.success(`Extracted style: ${data.style.name}`);
      setStyles((prev) => [data.style, ...prev]);
      setUrl('');
      setAuthorName('');
    } catch {
      toast.error('Failed to extract style');
    } finally {
      setExtracting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setStyles((prev) => prev.filter((s) => s.id !== id));
    const res = await fetch(`/api/content-pipeline/styles/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      fetchStyles(); // revert
      toast.error('Failed to delete style');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Extract form */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="text-sm font-medium">Extract Style from LinkedIn</h3>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="LinkedIn profile URL (e.g. linkedin.com/in/username)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="w-40">
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleExtract}
            disabled={extracting || !url.trim()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {extracting ? 'Extracting...' : 'Extract'}
          </button>
        </div>
        {extracting && (
          <p className="text-xs text-muted-foreground">
            Scraping posts and analyzing writing style... this takes 15-30 seconds.
          </p>
        )}
      </div>

      {/* Style cards grid */}
      {styles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">No styles extracted yet</p>
          <p className="text-xs mt-1">Enter a LinkedIn URL above to extract a writing style</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {styles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              onDelete={() => handleDelete(style.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Style Card ───────────────────────────────────────────

const TONE_COLORS: Record<string, string> = {
  conversational: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  professional: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  provocative: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  educational: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  inspirational: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};

function StyleCard({
  style,
  onDelete,
}: {
  style: WritingStyle;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sp = style.style_profile;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-medium text-sm truncate">{style.name}</h4>
          {style.source_linkedin_url && (
            <a
              href={style.source_linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline truncate block"
            >
              {style.source_linkedin_url.replace('https://www.linkedin.com/in/', '')}
            </a>
          )}
        </div>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive shrink-0">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TONE_COLORS[sp.tone] || 'bg-gray-100 text-gray-700')}>
          {sp.tone}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {sp.sentence_length} sentences
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {sp.vocabulary} vocab
        </span>
        {sp.formatting.uses_emojis && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">emojis</span>
        )}
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {style.source_posts_analyzed} posts
        </span>
      </div>

      {/* Description */}
      {style.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{style.description}</p>
      )}

      {/* Quick traits */}
      {sp.hook_patterns.length > 0 && (
        <div>
          <p className="text-[10px] uppercase text-muted-foreground/70 font-medium mb-1">Hooks</p>
          <div className="flex flex-wrap gap-1">
            {sp.hook_patterns.slice(0, 2).map((h) => (
              <span key={h} className="rounded bg-muted px-1.5 py-0.5 text-xs">{h}</span>
            ))}
            {sp.hook_patterns.length > 2 && (
              <span className="text-xs text-muted-foreground">+{sp.hook_patterns.length - 2}</span>
            )}
          </div>
        </div>
      )}

      {/* Expand / Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-primary hover:underline"
      >
        {expanded ? 'Show less' : 'View all traits'}
      </button>

      {expanded && <StyleTraitsDetail profile={sp} />}
    </div>
  );
}

// ─── Style Traits Detail ──────────────────────────────────

function StyleTraitsDetail({ profile }: { profile: StyleProfile }) {
  return (
    <div className="space-y-3 pt-2 border-t">
      <TraitSection label="Hook Patterns" items={profile.hook_patterns} />
      <TraitSection label="CTA Patterns" items={profile.cta_patterns} />
      <TraitSection label="Signature Phrases" items={profile.signature_phrases} />
      <TraitSection label="Banned Phrases" items={profile.banned_phrases} />
      <div>
        <p className="text-[10px] uppercase text-muted-foreground/70 font-medium mb-1">Formatting</p>
        <div className="flex flex-wrap gap-1">
          {profile.formatting.uses_emojis && <span className="rounded bg-muted px-1.5 py-0.5 text-xs">Emojis</span>}
          {profile.formatting.uses_line_breaks && <span className="rounded bg-muted px-1.5 py-0.5 text-xs">Line breaks</span>}
          {profile.formatting.uses_lists && <span className="rounded bg-muted px-1.5 py-0.5 text-xs">Lists</span>}
          {profile.formatting.uses_bold && <span className="rounded bg-muted px-1.5 py-0.5 text-xs">Bold</span>}
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs">~{profile.formatting.avg_paragraphs} paragraphs</span>
        </div>
      </div>
    </div>
  );
}

function TraitSection({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground/70 font-medium mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className="rounded bg-muted px-1.5 py-0.5 text-xs">{item}</span>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Update LibraryTab to include Styles pill**

Modify `src/components/content-pipeline/LibraryTab.tsx`:

```typescript
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const TemplatesTab = dynamic(
  () => import('@/components/content-pipeline/TemplatesTab').then((m) => ({ default: m.TemplatesTab })),
  { ssr: false, loading: () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> }
);
const SwipeFileContent = dynamic(
  () => import('@/components/swipe-file/SwipeFileContent').then((m) => ({ default: m.SwipeFileContent })),
  { ssr: false, loading: () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> }
);
const StylesSection = dynamic(
  () => import('@/components/content-pipeline/StylesSection').then((m) => ({ default: m.StylesSection })),
  { ssr: false, loading: () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> }
);

type LibrarySection = 'templates' | 'inspiration' | 'styles';

interface LibraryTabProps {
  profileId?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function LibraryTab({ profileId }: LibraryTabProps) {
  const [section, setSection] = useState<LibrarySection>('templates');

  const pills: { id: LibrarySection; label: string }[] = [
    { id: 'templates', label: 'Templates' },
    { id: 'inspiration', label: 'Inspiration' },
    { id: 'styles', label: 'Styles' },
  ];

  return (
    <div>
      <div className="mb-6 flex gap-2">
        {pills.map((pill) => (
          <button
            key={pill.id}
            onClick={() => setSection(pill.id)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              section === pill.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            )}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {section === 'templates' && <TemplatesTab />}
      {section === 'inspiration' && <SwipeFileContent />}
      {section === 'styles' && <StylesSection />}
    </div>
  );
}
```

**Step 3: Verify it compiles**

Run: `npx next build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add src/components/content-pipeline/StylesSection.tsx src/components/content-pipeline/LibraryTab.tsx
git commit -m "feat: add Styles subsection to Library tab with URL extraction + style cards"
```

---

### Task 3: Style Mixer Modal

**Files:**
- Create: `src/components/content-pipeline/StyleMixer.tsx`
- Modify: `src/components/content-pipeline/StylesSection.tsx` (add "Apply traits to..." button on cards)

**Context:**
- `PATCH /api/teams/profiles/[id]` accepts `{ voice_profile: Record<string, unknown> }` — replaces the entire voice_profile JSONB.
- `GET /api/teams/profiles` returns all team profiles with their current `voice_profile`.
- `StyleProfile` has: tone, sentence_length, vocabulary, formatting (object), hook_patterns (array), cta_patterns (array), banned_phrases (array), signature_phrases (array).
- `TeamVoiceProfile` (on team_profiles.voice_profile) has: tone, signature_phrases, banned_phrases, hook_patterns, storytelling_style, industry_jargon, first_person_context, perspective_notes, plus auto-evolved fields we don't touch.
- Merge rules: arrays → union (add new items), scalars → replace, never touch auto-evolved fields (edit_patterns, vocabulary_preferences, positive_examples, last_evolved, evolution_version).

**Step 1: Create the mixer modal**

```typescript
// src/components/content-pipeline/StyleMixer.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { X, Loader2, Check, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WritingStyle, StyleProfile } from '@/lib/types/content-pipeline';

interface TeamProfile {
  id: string;
  full_name: string;
  title: string | null;
  voice_profile: Record<string, unknown>;
}

interface StyleMixerProps {
  sourceStyle: WritingStyle;
  onClose: () => void;
}

// Trait categories that can be mixed from StyleProfile → voice_profile
const TRAIT_CATEGORIES = [
  { key: 'tone', label: 'Tone', type: 'scalar' as const },
  { key: 'hook_patterns', label: 'Hook Patterns', type: 'array' as const },
  { key: 'cta_patterns', label: 'CTA Patterns', type: 'array' as const, voiceKey: 'cta_style' },
  { key: 'signature_phrases', label: 'Signature Phrases', type: 'array' as const },
  { key: 'banned_phrases', label: 'Banned Phrases', type: 'array' as const },
  { key: 'sentence_length', label: 'Sentence Length', type: 'scalar' as const, voiceKey: 'content_length' },
] as const;

// Auto-evolved fields we NEVER overwrite
const PROTECTED_FIELDS = new Set([
  'edit_patterns', 'vocabulary_preferences', 'positive_examples',
  'last_evolved', 'evolution_version', 'structure_patterns',
]);

export function StyleMixer({ sourceStyle, onClose }: StyleMixerProps) {
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [selectedTraits, setSelectedTraits] = useState<Set<string>>(new Set());
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => {
    fetch('/api/teams/profiles')
      .then((r) => r.json())
      .then((data) => {
        setProfiles(data.profiles || []);
        if (data.profiles?.length === 1) {
          setSelectedProfileId(data.profiles[0].id);
        }
      })
      .catch(() => toast.error('Failed to load team profiles'))
      .finally(() => setLoading(false));
  }, []);

  const toggleTrait = useCallback((key: string) => {
    setSelectedTraits((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedTraits(new Set(TRAIT_CATEGORIES.map((t) => t.key)));
  }, []);

  const clearAll = useCallback(() => {
    setSelectedTraits(new Set());
  }, []);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
  const sp = sourceStyle.style_profile;

  const handleApply = async () => {
    if (!selectedProfileId || selectedTraits.size === 0) return;
    setSaving(true);

    try {
      // Build merged voice_profile
      const current = (selectedProfile?.voice_profile || {}) as Record<string, unknown>;
      const merged = { ...current };

      for (const trait of TRAIT_CATEGORIES) {
        if (!selectedTraits.has(trait.key)) continue;

        const sourceValue = sp[trait.key as keyof StyleProfile];
        const targetKey = ('voiceKey' in trait && trait.voiceKey) ? trait.voiceKey : trait.key;

        if (trait.type === 'array' && Array.isArray(sourceValue)) {
          // Union: add new items to existing array
          const existing = Array.isArray(current[targetKey]) ? (current[targetKey] as string[]) : [];
          const union = [...new Set([...existing, ...sourceValue])];
          merged[targetKey] = union;
        } else if (trait.type === 'scalar') {
          if (trait.key === 'sentence_length') {
            // Map to content_length format
            const lengthMap: Record<string, string> = {
              short: '100-200 words',
              medium: '200-400 words',
              long: '400-600 words',
              varied: '200-500 words',
            };
            merged.content_length = {
              ...((current.content_length as Record<string, string>) || {}),
              linkedin: lengthMap[sourceValue as string] || '200-400 words',
            };
          } else {
            merged[targetKey] = sourceValue;
          }
        }
      }

      // Ensure protected fields are preserved
      for (const field of PROTECTED_FIELDS) {
        if (current[field] !== undefined) {
          merged[field] = current[field];
        }
      }

      const res = await fetch(`/api/teams/profiles/${selectedProfileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_profile: merged }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to update profile');
        return;
      }

      toast.success(`Applied ${selectedTraits.size} traits to ${selectedProfile?.full_name}`);
      onClose();
    } catch {
      toast.error('Failed to apply traits');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="rounded-xl bg-background p-6 shadow-xl">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Apply Traits</h2>
            <p className="text-sm text-muted-foreground">
              From: <strong>{sourceStyle.name}</strong>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Target profile selector */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Apply to team member</label>
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select a team member...</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}{p.title ? ` (${p.title})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Trait checkboxes */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Select traits to apply</label>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-primary hover:underline">Select all</button>
              <button onClick={clearAll} className="text-xs text-muted-foreground hover:underline">Clear</button>
            </div>
          </div>

          {TRAIT_CATEGORIES.map((trait) => {
            const value = sp[trait.key as keyof StyleProfile];
            const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
            const isEmpty = Array.isArray(value) ? value.length === 0 : !value;
            if (isEmpty) return null;

            return (
              <label
                key={trait.key}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                  selectedTraits.has(trait.key)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedTraits.has(trait.key)}
                  onChange={() => toggleTrait(trait.key)}
                  className="mt-0.5 rounded"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{trait.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{displayValue}</p>
                </div>
              </label>
            );
          })}

          {/* Formatting (special — object with multiple flags) */}
          <label
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
              selectedTraits.has('formatting')
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            )}
          >
            <input
              type="checkbox"
              checked={selectedTraits.has('formatting')}
              onChange={() => toggleTrait('formatting')}
              className="mt-0.5 rounded"
            />
            <div>
              <p className="text-sm font-medium">Formatting</p>
              <p className="text-xs text-muted-foreground">
                {[
                  sp.formatting.uses_emojis && 'Emojis',
                  sp.formatting.uses_line_breaks && 'Line breaks',
                  sp.formatting.uses_lists && 'Lists',
                  sp.formatting.uses_bold && 'Bold',
                  `~${sp.formatting.avg_paragraphs} paragraphs`,
                ].filter(Boolean).join(', ')}
              </p>
            </div>
          </label>
        </div>

        {/* Example posts toggle */}
        {sourceStyle.example_posts && sourceStyle.example_posts.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showExamples ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Example posts ({sourceStyle.example_posts.length})
            </button>
            {showExamples && (
              <div className="mt-2 space-y-2">
                {sourceStyle.example_posts.map((post, i) => (
                  <div key={i} className="rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {post}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Apply button */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={saving || !selectedProfileId || selectedTraits.size === 0}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Apply {selectedTraits.size} trait{selectedTraits.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add "Apply traits" button to StyleCard in StylesSection.tsx**

In the `StyleCard` component, add a state for the mixer modal and an "Apply traits" button next to the delete button. Add this import at the top of `StylesSection.tsx`:

```typescript
import { StyleMixer } from './StyleMixer';
```

In `StyleCard`, add state:
```typescript
const [showMixer, setShowMixer] = useState(false);
```

Add button next to the delete button in the header:
```typescript
<button
  onClick={() => setShowMixer(true)}
  className="text-xs text-primary hover:underline whitespace-nowrap"
>
  Apply traits...
</button>
```

Add modal render at end of StyleCard return:
```typescript
{showMixer && (
  <StyleMixer sourceStyle={style} onClose={() => setShowMixer(false)} />
)}
```

**Step 3: Verify it compiles**

Run: `npx next build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add src/components/content-pipeline/StyleMixer.tsx src/components/content-pipeline/StylesSection.tsx
git commit -m "feat: add style mixer modal for applying traits to team voice profiles"
```

---

### Task 4: Wire Formatting Traits in Mixer

**Files:**
- Modify: `src/components/content-pipeline/StyleMixer.tsx` (in `handleApply`)

**Context:**
- The formatting trait is a special case — it's an object with boolean flags, not a simple scalar or array.
- When "formatting" is selected, we need to map `StyleProfile.formatting` fields into the voice_profile in a way that `buildVoicePromptSection()` can use them.
- Looking at `voice-prompt-builder.ts`, it reads: `content_length.linkedin` (string), `structure_patterns.linkedin` (string array). Formatting flags aren't directly read — they're only in `cp_writing_styles.style_profile`.
- For formatting to actually affect AI output, we should map formatting flags into `structure_patterns.linkedin` entries that `buildVoicePromptSection()` will pick up.

**Step 1: Add formatting mapping in handleApply**

In `StyleMixer.tsx`'s `handleApply`, after the TRAIT_CATEGORIES loop, add:

```typescript
// Handle formatting trait separately
if (selectedTraits.has('formatting')) {
  const fmt = sp.formatting;
  const patterns: string[] = [];
  if (fmt.uses_emojis) patterns.push('Use emojis sparingly');
  if (!fmt.uses_emojis) patterns.push('Do not use emojis');
  if (fmt.uses_line_breaks) patterns.push('Use line breaks between thoughts');
  if (fmt.uses_lists) patterns.push('Use lists when appropriate');
  if (fmt.uses_bold) patterns.push('Use bold for emphasis');
  patterns.push(`Target ~${fmt.avg_paragraphs} paragraphs per post`);

  const existingPatterns = Array.isArray(
    (current.structure_patterns as Record<string, unknown>)?.linkedin
  ) ? ((current.structure_patterns as Record<string, string[]>).linkedin) : [];

  merged.structure_patterns = {
    ...((current.structure_patterns as Record<string, unknown>) || {}),
    linkedin: [...new Set([...existingPatterns, ...patterns])],
  };
}
```

**Step 2: Verify it compiles**

Run: `npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/components/content-pipeline/StyleMixer.tsx
git commit -m "feat: map formatting traits to structure_patterns for voice prompt injection"
```

---

### Task 5: Tests

**Files:**
- Create: `src/__tests__/api/content-pipeline/styles/extract-from-url.test.ts`

**Context:**
- Existing test pattern: mock auth, mock Supabase, mock external APIs, test request/response shapes.
- See `src/__tests__/api/` for examples. Use `@jest-environment node`.

**Step 1: Write API route test**

```typescript
/**
 * @jest-environment node
 */

import { POST } from '@/app/api/content-pipeline/styles/extract-from-url/route';
import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}));

// Mock Apify scraper
jest.mock('@/lib/integrations/apify-engagers', () => ({
  scrapeProfilePosts: jest.fn(),
}));

// Mock style extractor
jest.mock('@/lib/ai/style-extractor', () => ({
  extractWritingStyle: jest.fn(),
}));

// Mock embeddings
jest.mock('@/lib/ai/embeddings', () => ({
  generateEmbedding: jest.fn().mockResolvedValue(null),
}));

// Mock Supabase
const mockInsert = jest.fn().mockReturnValue({
  select: jest.fn().mockReturnValue({
    single: jest.fn().mockResolvedValue({
      data: { id: 'style-1', name: 'Test Style' },
      error: null,
    }),
  }),
});

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { scrapeProfilePosts } from '@/lib/integrations/apify-engagers';
import { extractWritingStyle } from '@/lib/ai/style-extractor';

const mockScrape = scrapeProfilePosts as jest.MockedFunction<typeof scrapeProfilePosts>;
const mockExtract = extractWritingStyle as jest.MockedFunction<typeof extractWritingStyle>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/content-pipeline/styles/extract-from-url', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/content-pipeline/styles/extract-from-url', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 if linkedin_url is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 502 if Apify scrape fails', async () => {
    mockScrape.mockResolvedValue({ data: [], error: 'Timeout' });
    const res = await POST(makeRequest({ linkedin_url: 'https://linkedin.com/in/test' }));
    expect(res.status).toBe(502);
  });

  it('returns 422 if fewer than 3 text posts found', async () => {
    mockScrape.mockResolvedValue({
      data: [{ text: 'short', url: '', numLikes: 0, numComments: 0, numShares: 0, postedAtISO: '', postedAtTimestamp: 0, authorName: '', authorProfileUrl: '', author: { firstName: '', lastName: '', occupation: '', publicId: '' } }],
      error: null,
    });
    const res = await POST(makeRequest({ linkedin_url: 'https://linkedin.com/in/test' }));
    expect(res.status).toBe(422);
  });

  it('returns 201 with extracted style on success', async () => {
    const posts = Array.from({ length: 5 }, (_, i) => ({
      text: `This is a long enough post with meaningful content for analysis number ${i + 1}`,
      url: `https://linkedin.com/post/${i}`,
      numLikes: 10, numComments: 5, numShares: 2,
      postedAtISO: '2026-01-01', postedAtTimestamp: 0,
      authorName: 'Test Author', authorProfileUrl: 'https://linkedin.com/in/test',
      author: { firstName: 'Test', lastName: 'Author', occupation: 'CEO', publicId: 'test' },
    }));

    mockScrape.mockResolvedValue({ data: posts, error: null });
    mockExtract.mockResolvedValue({
      name: 'Bold Strategist',
      description: 'A direct writing style',
      style_profile: {
        tone: 'provocative',
        sentence_length: 'short',
        vocabulary: 'simple',
        formatting: { uses_emojis: false, uses_line_breaks: true, uses_lists: false, uses_bold: true, avg_paragraphs: 4 },
        hook_patterns: ['Bold claim'],
        cta_patterns: ['DM me'],
        banned_phrases: ['synergy'],
        signature_phrases: ['Ship it'],
      },
      example_posts: ['Example post'],
      key_patterns: ['Uses bold claims'],
      recommendations: ['Start with a hook'],
    });

    const res = await POST(makeRequest({ linkedin_url: 'https://linkedin.com/in/test', author_name: 'Test' }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.style).toBeDefined();
    expect(data.posts_analyzed).toBe(5);
  });
});
```

**Step 2: Run the test**

Run: `npx jest src/__tests__/api/content-pipeline/styles/extract-from-url.test.ts --no-coverage -v`
Expected: All 4 tests pass.

**Step 3: Commit**

```bash
git add src/__tests__/api/content-pipeline/styles/extract-from-url.test.ts
git commit -m "test: add tests for extract-from-url API route"
```

---

### Task 6: Build Verification + Deploy

**Files:** None (verification only)

**Step 1: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -10`
Expected: No errors.

**Step 2: Run full test suite**

Run: `npm run test -- --no-coverage 2>&1 | tail -20`
Expected: All tests pass (existing + new).

**Step 3: Build**

Run: `npx next build 2>&1 | tail -10`
Expected: Clean build.

**Step 4: Deploy**

Run: `vercel --prod 2>&1 | tail -10`
Expected: Deployed successfully.

**Step 5: Commit any fixes needed, then final commit**

```bash
git add -A
git commit -m "chore: style builder build verification"
```
