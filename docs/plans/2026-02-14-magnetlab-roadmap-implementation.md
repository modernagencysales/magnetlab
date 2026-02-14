# MagnetLab Roadmap Implementation Plan (Phases 0-3)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stabilize the codebase, remove Notion, add rich content block types, and build screenshot generation for LinkedIn post images.

**Architecture:** Extend the existing PolishedBlock union type with 5 new block types (image, embed, code, table, accordion), add renderers for each, update the AI polish prompt, then build a Playwright-based screenshot system that captures the rendered content page at multiple scroll positions and stores images in Supabase Storage.

**Tech Stack:** Next.js 15, TypeScript, Playwright (already installed), Supabase Storage, Anthropic Claude (polish prompt), Shiki (syntax highlighting for code blocks)

---

## Phase 0: Stabilization & Cleanup

### Task 1: Delete Debug Endpoint

**Files:**
- Delete: `src/app/api/auth/debug/route.ts`

**Step 1: Delete the file**

```bash
rm src/app/api/auth/debug/route.ts
```

This file exposes env var presence info (AUTH_SECRET length, SUPABASE keys) and is marked "remove in production".

**Step 2: Verify no references**

Run: `grep -r "auth/debug" src/ --include="*.ts" --include="*.tsx"`
Expected: No matches

**Step 3: Commit**

```bash
git add -A src/app/api/auth/debug/
git commit -m "fix: remove debug auth endpoint that exposes env var info"
```

---

### Task 2: Sanitize Pixel Script Injection

**Files:**
- Modify: `src/components/funnel/public/PixelScripts.tsx:55,76`
- Create: `src/__tests__/components/funnel/pixel-sanitization.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/components/funnel/pixel-sanitization.test.ts`:

```typescript
import { sanitizePixelId, sanitizePartnerId } from '@/components/funnel/public/PixelScripts';

describe('Pixel ID sanitization', () => {
  it('allows numeric pixel IDs', () => {
    expect(sanitizePixelId('1234567890')).toBe('1234567890');
  });

  it('strips non-numeric characters from pixel IDs', () => {
    expect(sanitizePixelId('123<script>alert(1)</script>')).toBe('123');
  });

  it('returns empty string for null/undefined', () => {
    expect(sanitizePixelId('')).toBe('');
    expect(sanitizePixelId(undefined as unknown as string)).toBe('');
  });

  it('allows alphanumeric partner IDs', () => {
    expect(sanitizePartnerId('abc123')).toBe('abc123');
  });

  it('strips injection attempts from partner IDs', () => {
    expect(sanitizePartnerId('abc";alert(1)//')).toBe('abcalert1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/components/funnel/pixel-sanitization.test.ts --no-coverage`
Expected: FAIL — sanitizePixelId/sanitizePartnerId not exported

**Step 3: Implement sanitization in PixelScripts.tsx**

Add at the top of `PixelScripts.tsx` (after imports):

```typescript
export function sanitizePixelId(id: string | undefined): string {
  if (!id) return '';
  return id.replace(/[^0-9]/g, '');
}

export function sanitizePartnerId(id: string | undefined): string {
  if (!id) return '';
  return id.replace(/[^a-zA-Z0-9]/g, '');
}
```

Then replace the two `dangerouslySetInnerHTML` usages:
- Line ~55: Change `${config.meta.pixelId}` to `${sanitizePixelId(config.meta.pixelId)}`
- Line ~76: Change `"${config.linkedin.partnerId}"` to `"${sanitizePartnerId(config.linkedin.partnerId)}"`

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/components/funnel/pixel-sanitization.test.ts --no-coverage`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/components/funnel/public/PixelScripts.tsx src/__tests__/components/funnel/pixel-sanitization.test.ts
git commit -m "fix: sanitize pixel IDs to prevent XSS in tracking scripts"
```

---

### Task 3: Add React Error Boundary

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Modify: `src/app/(dashboard)/layout.tsx:58`

**Step 1: Create ErrorBoundary component**

Create `src/components/ErrorBoundary.tsx`:

```typescript
'use client';

import { Component, type ReactNode } from 'react';
import { logError } from '@/lib/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError('ErrorBoundary', error, {
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please refresh the page.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Step 2: Wrap dashboard layout children**

In `src/app/(dashboard)/layout.tsx`, add import and wrap `{children}`:

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';
```

Change line 58 from:
```typescript
<main className="lg:pl-64">{children}</main>
```
to:
```typescript
<main className="lg:pl-64">
  <ErrorBoundary>{children}</ErrorBoundary>
</main>
```

**Step 3: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/app/\(dashboard\)/layout.tsx
git commit -m "feat: add React error boundary to dashboard layout"
```

---

### Task 4: Remove LeadShark Dead Code

**Files:**
- Delete: `src/lib/integrations/leadshark.ts`
- Delete: `src/app/api/leadshark/automations/route.ts`
- Delete: `src/app/api/leadshark/automations/[id]/route.ts`
- Delete: `src/app/api/leadshark/scheduled-posts/route.ts`
- Delete: `src/app/api/leadshark/scheduled-posts/[id]/route.ts`
- Modify: `src/app/api/integrations/verify/route.ts` (remove LeadShark import + verify case)

**Step 1: Delete LeadShark files**

```bash
rm -rf src/lib/integrations/leadshark.ts src/app/api/leadshark/
```

**Step 2: Fix the verify route**

Read `src/app/api/integrations/verify/route.ts` and remove the LeadShark import and verification case. Keep all other integration verifications intact.

**Step 3: Search for remaining LeadShark references**

Run: `grep -ri "leadshark" src/ --include="*.ts" --include="*.tsx" -l`

Fix any remaining imports or references. Common locations:
- Settings components that show LeadShark connection status
- Type definitions that reference LeadShark

**Step 4: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build 2>&1 | tail -20`
Expected: Build succeeds with no LeadShark import errors

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove LeadShark dead code (replaced by Unipile)"
```

---

### Task 5: Replace Console Statements with Structured Logging

**Files:**
- Modify: `src/lib/utils/logger.ts` (add `logDebug`)
- Modify: ~89 files with console.log/error/warn calls

**Step 1: Add logDebug to logger**

Add to `src/lib/utils/logger.ts`:

```typescript
/**
 * Log debug info with context (only in development)
 */
export function logDebug(
  context: string,
  message: string,
  metadata?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === 'production') return;
  const entry: LogEntry = {
    level: 'debug',
    context,
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  };
  console.debug(JSON.stringify(entry));
}
```

**Step 2: Batch replace console statements**

This is a large mechanical task. Process files in batches by directory:

1. Add `import { logError, logWarn, logInfo, logDebug } from '@/lib/utils/logger';` to each file
2. Replace patterns:
   - `console.error('message', data)` → `logError('module-name', new Error('message'), { data })`
   - `console.error('[context] message', data)` → `logError('context', new Error('message'), { data })`
   - `console.warn('message')` → `logWarn('module-name', 'message')`
   - `console.log('message', data)` → `logInfo('module-name', 'message', { data })` or `logDebug(...)` for debug-only
3. In Trigger.dev tasks (`src/trigger/`), keep `console.log` — Trigger.dev captures stdout as job logs

**Priority files** (highest console count):
- `src/lib/auth/config.ts` (17 occurrences)
- `src/lib/ai/content-pipeline/inspiration-researcher.ts` (10)
- `src/lib/auth/rate-limit.ts` (8)
- `src/trigger/email-sequence.ts` (8)
- `src/app/api/webhooks/gtm-callback/route.ts` (7)
- `src/app/api/webhooks/unipile/route.ts` (7)

**Step 3: Verify no bare console.log remains (except logger.ts and trigger/)**

Run: `grep -rn "console\.\(log\|error\|warn\)" src/ --include="*.ts" --include="*.tsx" | grep -v "logger.ts" | grep -v "src/trigger/" | grep -v "__tests__" | wc -l`
Expected: 0 (or close to 0)

**Step 4: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: replace 200+ console statements with structured logging"
```

---

## Phase 1: Notion Removal

### Task 6: Create Database Migration to Drop Notion

**Files:**
- Create: `supabase/migrations/20260214000000_remove_notion.sql`

**Step 1: Write the migration**

Create `supabase/migrations/20260214000000_remove_notion.sql`:

```sql
-- Remove Notion integration (never actively used, replaced by self-hosted content pages)

-- Drop decryption view
DROP VIEW IF EXISTS public.notion_connections_secure;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.upsert_notion_connection;
DROP FUNCTION IF EXISTS public.get_notion_connection;

-- Drop the table
DROP TABLE IF EXISTS public.notion_connections CASCADE;

-- Remove Notion columns from lead_magnets
ALTER TABLE public.lead_magnets
  DROP COLUMN IF EXISTS notion_page_id,
  DROP COLUMN IF EXISTS notion_page_url;
```

**Step 2: Verify migration syntax**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && cat supabase/migrations/20260214000000_remove_notion.sql`
Expected: File contents match above

**Step 3: Commit**

```bash
git add supabase/migrations/20260214000000_remove_notion.sql
git commit -m "chore: add migration to remove unused Notion schema"
```

---

### Task 7: Delete Notion Scripts and Update Docs

**Files:**
- Delete: `scripts/scrape-notion-pages.js`
- Delete: `scripts/push-notion-content.js`
- Modify: `CLAUDE.md` (remove Notion references)
- Modify: `README.md` (remove Notion references)

**Step 1: Delete one-time migration scripts**

```bash
rm -f scripts/scrape-notion-pages.js scripts/push-notion-content.js
```

**Step 2: Update CLAUDE.md**

Remove these Notion references:
- Line ~13 (tech stack): Remove `Notion OAuth` from Auth line
- Line ~19 (jobs): Remove `Notion API` from Jobs/Integrations line
- Lines ~170-171 (integration points): Remove the Notion bullet point
- Lines ~73-74 (env vars): Remove `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET`

**Step 3: Update README.md**

Remove:
- `@notionhq/client` from tech stack
- `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` from env vars
- Any "Notion Publishing" feature mentions

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove Notion scripts and doc references"
```

---

### Task 8: Clean Up Notion Test References

**Files:**
- Modify: `e2e/settings.spec.ts` (remove Notion mock data and button test)

**Step 1: Read the test file**

Read `e2e/settings.spec.ts` and find:
- Lines ~60-64: Mock empty `notion_connections` table
- Lines ~122-135: Test for Notion connect button

**Step 2: Remove Notion test blocks**

Remove the mock data for `notion_connections` and any test assertions about Notion UI elements.

**Step 3: Verify E2E tests still parse**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit 2>&1 | tail -5`
Expected: No type errors

**Step 4: Commit**

```bash
git add e2e/settings.spec.ts
git commit -m "test: remove Notion references from E2E tests"
```

---

## Phase 2: Rich Content Block Types

### Task 9: Extend PolishedBlock Type System

**Files:**
- Modify: `src/lib/types/lead-magnet.ts:228-235`
- Create: `src/__tests__/lib/types/polished-block.test.ts`

**Step 1: Write the type validation test**

Create `src/__tests__/lib/types/polished-block.test.ts`:

```typescript
import type {
  PolishedBlock,
  PolishedBlockType,
} from '@/lib/types/lead-magnet';

describe('PolishedBlock types', () => {
  it('accepts all original block types', () => {
    const blocks: PolishedBlock[] = [
      { type: 'paragraph', content: 'Hello' },
      { type: 'callout', content: 'Tip', style: 'info' },
      { type: 'list', content: '- item 1\n- item 2' },
      { type: 'quote', content: 'Famous words' },
      { type: 'divider', content: '' },
    ];
    expect(blocks).toHaveLength(5);
  });

  it('accepts new rich block types', () => {
    const blocks: PolishedBlock[] = [
      { type: 'image', content: '', src: 'https://example.com/img.png', alt: 'Photo' },
      { type: 'embed', content: '', url: 'https://youtube.com/watch?v=abc' },
      { type: 'code', content: 'const x = 1;', language: 'typescript' },
      { type: 'table', content: '', headers: ['Name', 'Value'], rows: [['A', '1']] },
      { type: 'accordion', content: 'Hidden details', title: 'Click to expand' },
    ];
    expect(blocks).toHaveLength(5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/types/polished-block.test.ts --no-coverage`
Expected: FAIL — types 'image', 'embed', etc. not assignable to PolishedBlockType

**Step 3: Update the type definitions**

In `src/lib/types/lead-magnet.ts`, replace lines 228-235:

```typescript
export type PolishedBlockType =
  | 'paragraph'
  | 'callout'
  | 'list'
  | 'quote'
  | 'divider'
  | 'image'
  | 'embed'
  | 'code'
  | 'table'
  | 'accordion';

export type CalloutStyle = 'info' | 'warning' | 'success';

export interface PolishedBlock {
  type: PolishedBlockType;
  content: string;
  style?: CalloutStyle;
  // Image block fields
  src?: string;
  alt?: string;
  caption?: string;
  // Embed block fields
  url?: string;
  provider?: string;
  // Code block fields
  language?: string;
  // Table block fields
  headers?: string[];
  rows?: string[][];
  // Accordion block fields
  title?: string;
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/types/polished-block.test.ts --no-coverage`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/lib/types/lead-magnet.ts src/__tests__/lib/types/polished-block.test.ts
git commit -m "feat: extend PolishedBlock with image, embed, code, table, accordion types"
```

---

### Task 10: Add Code Block Renderer

**Files:**
- Modify: `src/components/content/ContentBlocks.tsx` (add CodeBlock component)
- Install: `shiki` for syntax highlighting

**Step 1: Install shiki**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npm install shiki
```

**Step 2: Add CodeBlock component to ContentBlocks.tsx**

After the existing `SectionDivider` component (~line 223), add:

```typescript
function CodeBlock({ block, isDark }: { block: PolishedBlock; isDark: boolean }) {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    async function highlight() {
      const { codeToHtml } = await import('shiki');
      const result = await codeToHtml(block.content, {
        lang: block.language || 'text',
        theme: isDark ? 'github-dark' : 'github-light',
      });
      setHtml(result);
    }
    highlight();
  }, [block.content, block.language, isDark]);

  if (!html) {
    return (
      <pre className="rounded-lg border p-4 text-sm" style={{
        backgroundColor: isDark ? '#1a1a2e' : '#f5f5f5',
        color: 'var(--ds-text-body)',
      }}>
        <code>{block.content}</code>
      </pre>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden text-sm [&_pre]:p-4 [&_pre]:m-0">
      {block.language && (
        <div className="px-4 py-1 text-xs font-mono border-b" style={{
          backgroundColor: isDark ? '#1a1a2e' : '#f0f0f0',
          color: 'var(--ds-text-muted)',
        }}>
          {block.language}
        </div>
      )}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
```

**Step 3: Add the code block case to the renderer**

Find the block rendering switch/conditional in ContentBlocks.tsx and add:

```typescript
case 'code':
  return <CodeBlock key={idx} block={block} isDark={isDark} />;
```

**Step 4: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/components/content/ContentBlocks.tsx package.json package-lock.json
git commit -m "feat: add syntax-highlighted code block renderer"
```

---

### Task 11: Add Table Block Renderer

**Files:**
- Modify: `src/components/content/ContentBlocks.tsx`

**Step 1: Add TableBlock component**

```typescript
function TableBlock({ block, isDark }: { block: PolishedBlock; isDark: boolean }) {
  if (!block.headers || !block.rows) return null;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: isDark ? '#1a1a2e' : '#f5f5f5' }}>
            {block.headers.map((header, i) => (
              <th key={i} className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--ds-text-heading)' }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIdx) => (
            <tr key={rowIdx} className="border-t" style={{
              backgroundColor: rowIdx % 2 === 1 ? (isDark ? '#0d0d1a' : '#fafafa') : 'transparent',
            }}>
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-4 py-3" style={{ color: 'var(--ds-text-body)' }}>
                  {renderRichText(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Add the table case to renderer**

```typescript
case 'table':
  return <TableBlock key={idx} block={block} isDark={isDark} />;
```

**Step 3: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/content/ContentBlocks.tsx
git commit -m "feat: add table block renderer with striped rows"
```

---

### Task 12: Add Accordion and Image Block Renderers

**Files:**
- Modify: `src/components/content/ContentBlocks.tsx`

**Step 1: Add AccordionBlock component**

```typescript
function AccordionBlock({ block }: { block: PolishedBlock }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border" style={{ borderColor: 'var(--ds-border)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left font-medium"
        style={{ color: 'var(--ds-text-heading)' }}
      >
        {block.title || 'Details'}
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="border-t px-4 py-3" style={{ color: 'var(--ds-text-body)' }}>
          {renderRichText(block.content)}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add ImageBlock component**

```typescript
function ImageBlock({ block }: { block: PolishedBlock }) {
  if (!block.src) return null;

  return (
    <figure className="my-2">
      <img
        src={block.src}
        alt={block.alt || ''}
        className="w-full rounded-lg"
        loading="lazy"
      />
      {block.caption && (
        <figcaption className="mt-2 text-center text-sm" style={{ color: 'var(--ds-text-muted)' }}>
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}
```

**Step 3: Add EmbedBlock component**

```typescript
function EmbedBlock({ block }: { block: PolishedBlock }) {
  if (!block.url) return null;

  // Auto-detect provider and extract embed URL
  let embedUrl = block.url;
  if (block.url.includes('youtube.com/watch')) {
    const videoId = new URL(block.url).searchParams.get('v');
    embedUrl = `https://www.youtube.com/embed/${videoId}`;
  } else if (block.url.includes('youtu.be/')) {
    const videoId = block.url.split('youtu.be/')[1]?.split('?')[0];
    embedUrl = `https://www.youtube.com/embed/${videoId}`;
  } else if (block.url.includes('vimeo.com/')) {
    const videoId = block.url.split('vimeo.com/')[1]?.split('?')[0];
    embedUrl = `https://player.vimeo.com/video/${videoId}`;
  } else if (block.url.includes('loom.com/share/')) {
    embedUrl = block.url.replace('/share/', '/embed/');
  }

  return (
    <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: '56.25%' }}>
      <iframe
        src={embedUrl}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
```

**Step 4: Add all three cases to renderer**

```typescript
case 'accordion':
  return <AccordionBlock key={idx} block={block} />;
case 'image':
  return <ImageBlock key={idx} block={block} />;
case 'embed':
  return <EmbedBlock key={idx} block={block} />;
```

**Step 5: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/components/content/ContentBlocks.tsx
git commit -m "feat: add accordion, image, and embed block renderers"
```

---

### Task 13: Update Block Editor with New Types

**Files:**
- Modify: `src/components/content/EditablePolishedContentRenderer.tsx:55-107`

**Step 1: Update BlockTypeSelector options**

In `EditablePolishedContentRenderer.tsx`, find the `options` array (~line 66) and add new entries:

```typescript
const options: { type: PolishedBlockType; label: string; style?: CalloutStyle }[] = [
  { type: 'paragraph', label: 'Paragraph' },
  { type: 'list', label: 'Bullet List' },
  { type: 'quote', label: 'Quote' },
  { type: 'callout', label: 'Info Callout', style: 'info' },
  { type: 'callout', label: 'Warning', style: 'warning' },
  { type: 'callout', label: 'Success', style: 'success' },
  { type: 'divider', label: 'Divider' },
  // New rich types
  { type: 'code', label: 'Code Block' },
  { type: 'table', label: 'Table' },
  { type: 'accordion', label: 'Accordion' },
  { type: 'image', label: 'Image' },
  { type: 'embed', label: 'Video Embed' },
];
```

**Step 2: Update addBlock function for new types**

In the `addBlock` function (~line 136), update the default content logic:

```typescript
const addBlock = (sectionIdx: number, afterBlockIdx: number, type: PolishedBlockType, style?: CalloutStyle) => {
  const newSections = [...content.sections];
  const newBlocks = [...newSections[sectionIdx].blocks];

  let newBlock: PolishedBlock;
  switch (type) {
    case 'divider':
      newBlock = { type, content: '' };
      break;
    case 'code':
      newBlock = { type, content: '// Your code here', language: 'typescript' };
      break;
    case 'table':
      newBlock = { type, content: '', headers: ['Column 1', 'Column 2'], rows: [['Value 1', 'Value 2']] };
      break;
    case 'accordion':
      newBlock = { type, content: 'Expandable content here...', title: 'Click to expand' };
      break;
    case 'image':
      newBlock = { type, content: '', src: '', alt: 'Image description' };
      break;
    case 'embed':
      newBlock = { type, content: '', url: '' };
      break;
    default:
      newBlock = { type, content: 'New content...', ...(style ? { style } : {}) };
  }

  newBlocks.splice(afterBlockIdx + 1, 0, newBlock);
  newSections[sectionIdx] = { ...newSections[sectionIdx], blocks: newBlocks };
  onChange({ ...content, sections: newSections });
  setAddingBlockAt(null);
};
```

**Step 3: Add edit UI for new block types in the render loop**

Find the block editing section (~lines 257-310) and add edit fields for new types:
- **Code**: textarea + language dropdown
- **Table**: header inputs + row inputs with add/remove buttons
- **Accordion**: title input + content textarea
- **Image**: URL input + alt text input + caption input
- **Embed**: URL input

**Step 4: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/components/content/EditablePolishedContentRenderer.tsx
git commit -m "feat: add editor support for new rich block types"
```

---

### Task 14: Update AI Polish Prompt

**Files:**
- Modify: `src/lib/ai/lead-magnet-generator.ts:1252-1300` (the polishLeadMagnetContent prompt)

**Step 1: Update the block type instructions in the prompt**

In `polishLeadMagnetContent`, update the prompt section that describes block types. Replace the existing block type list with:

```
2. Transform the section contents into a mix of block types:
   - "paragraph": Clear, direct text with **bold** for emphasis. 1-3 sentences each.
   - "callout": Key insights, warnings, or tips. Must include "style": "info" | "warning" | "success"
   - "list": Bullet-pointed lists. Use "- " prefix for each item, separated by newlines.
   - "quote": Powerful statements or memorable takeaways
   - "divider": Visual separator between major ideas (content should be empty string)
   - "code": Code examples, commands, or technical snippets. Include "language" field (e.g., "javascript", "bash", "python"). Only use for technical/developer content.
   - "table": Comparison tables, feature matrices, or structured data. Include "headers" (string[]) and "rows" (string[][]). Great for before/after comparisons, pricing tiers, or feature lists.
   - "accordion": Expandable Q&A sections. Include "title" (the question or toggle label). Use for FAQ-style content, common objections, or supplementary details.
```

Also add to CONTENT GUIDELINES:

```
- Use "code" blocks when showing terminal commands, code snippets, or technical configurations
- Use "table" blocks for 2+ column comparisons (before/after, feature matrices, pros/cons)
- Use "accordion" blocks for FAQ sections or supplementary details that don't need to be visible by default
- Do NOT use "image" or "embed" blocks — those are added manually by the user
```

**Step 2: Verify the prompt still produces valid JSON**

This is a prompt change — verify by running a manual test or checking the response parsing logic still handles the new types.

**Step 3: Commit**

```bash
git add src/lib/ai/lead-magnet-generator.ts
git commit -m "feat: update AI polish prompt to generate code, table, and accordion blocks"
```

---

## Phase 3: Screenshot Generation

### Task 15: Create Screenshot Service

**Files:**
- Create: `src/lib/services/screenshot.ts`

**Step 1: Create the screenshot service**

Create `src/lib/services/screenshot.ts`:

```typescript
import { chromium, type Browser, type Page } from 'playwright';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export interface ScreenshotResult {
  type: 'hero' | 'section';
  sectionIndex?: number;
  sectionName?: string;
  buffer1200x627: Buffer;
  buffer1080x1080: Buffer;
}

export interface ScreenshotOptions {
  pageUrl: string;
  sectionCount: number;
  waitTime?: number;
  theme?: 'dark' | 'light';
}

/**
 * Generate multiple screenshots of a content page at different scroll positions.
 * Returns hero shot + one per section.
 */
export async function generateContentScreenshots(
  options: ScreenshotOptions
): Promise<ScreenshotResult[]> {
  const { pageUrl, sectionCount, waitTime = 3000 } = options;
  const b = await getBrowser();
  const results: ScreenshotResult[] = [];

  // Use a wide viewport for high-quality captures
  const page = await b.newPage({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 2,
  });

  try {
    await page.goto(pageUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(waitTime);

    // Hero shot: top of page
    const heroBuffer = await page.screenshot({ type: 'png' });
    results.push({
      type: 'hero',
      buffer1200x627: await cropToSize(page, 1200, 627),
      buffer1080x1080: await cropToSize(page, 1080, 1080),
    });

    // Section shots: scroll to each section heading
    for (let i = 0; i < sectionCount; i++) {
      const sectionSelector = `[data-section-index="${i}"]`;
      const sectionEl = await page.$(sectionSelector);

      if (sectionEl) {
        await sectionEl.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500); // Let scroll settle

        const sectionName = await sectionEl.getAttribute('data-section-name') || `Section ${i + 1}`;

        results.push({
          type: 'section',
          sectionIndex: i,
          sectionName,
          buffer1200x627: await cropToSize(page, 1200, 627),
          buffer1080x1080: await cropToSize(page, 1080, 1080),
        });
      }
    }
  } finally {
    await page.close();
  }

  return results;
}

async function cropToSize(page: Page, width: number, height: number): Promise<Buffer> {
  return await page.screenshot({
    type: 'png',
    clip: {
      x: 0,
      y: 0,
      width,
      height,
    },
  }) as Buffer;
}

export async function closeScreenshotBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/services/screenshot.ts
git commit -m "feat: add Playwright screenshot service for content pages"
```

---

### Task 16: Add data-section-index Attributes to Content Page

**Files:**
- Modify: `src/components/content/PolishedContentRenderer.tsx`

**Step 1: Add data attributes to section wrappers**

Find the section rendering loop in `PolishedContentRenderer.tsx`. Each section wrapper element needs:

```typescript
<section
  key={section.id}
  data-section-index={sectionIndex}
  data-section-name={section.sectionName}
  id={`section-${section.id}`}
>
```

This enables the screenshot service to find and scroll to each section.

**Step 2: Verify the content page still renders**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/content/PolishedContentRenderer.tsx
git commit -m "feat: add data-section attributes for screenshot targeting"
```

---

### Task 17: Add Database Column for Screenshot URLs

**Files:**
- Create: `supabase/migrations/20260214000001_add_screenshot_urls.sql`

**Step 1: Write the migration**

Create `supabase/migrations/20260214000001_add_screenshot_urls.sql`:

```sql
-- Add screenshot URLs column for LinkedIn post images
ALTER TABLE public.lead_magnets
  ADD COLUMN IF NOT EXISTS screenshot_urls JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.lead_magnets.screenshot_urls IS
  'Array of screenshot objects: [{type, sectionIndex?, sectionName?, url1200x627, url1080x1080}]';
```

**Step 2: Update TypeScript type**

In `src/lib/types/lead-magnet.ts`, add to the LeadMagnet interface:

```typescript
export interface ScreenshotUrl {
  type: 'hero' | 'section';
  sectionIndex?: number;
  sectionName?: string;
  url1200x627: string;
  url1080x1080: string;
}
```

And add to the LeadMagnet interface:

```typescript
screenshotUrls?: ScreenshotUrl[];
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260214000001_add_screenshot_urls.sql src/lib/types/lead-magnet.ts
git commit -m "feat: add screenshot_urls column and TypeScript types"
```

---

### Task 18: Create Screenshot API Endpoint

**Files:**
- Create: `src/app/api/lead-magnet/[id]/screenshots/route.ts`

**Step 1: Create the API route**

Create `src/app/api/lead-magnet/[id]/screenshots/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateContentScreenshots, closeScreenshotBrowser } from '@/lib/services/screenshot';
import { logError, logInfo } from '@/lib/utils/logger';
import type { ScreenshotUrl } from '@/lib/types/lead-magnet';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  // Fetch lead magnet and verify ownership
  const { data: magnet, error: fetchError } = await supabase
    .from('lead_magnets')
    .select('id, user_id, polished_content')
    .eq('id', id)
    .single();

  if (fetchError || !magnet) {
    return NextResponse.json({ error: 'Lead magnet not found' }, { status: 404 });
  }

  if (magnet.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const polishedContent = magnet.polished_content as { sections?: unknown[] } | null;
  if (!polishedContent?.sections?.length) {
    return NextResponse.json({ error: 'Content must be polished before generating screenshots' }, { status: 400 });
  }

  // Find the published funnel page URL
  const { data: funnel } = await supabase
    .from('funnel_pages')
    .select('slug, users!inner(username)')
    .eq('lead_magnet_id', id)
    .eq('is_published', true)
    .single();

  if (!funnel) {
    return NextResponse.json({ error: 'Funnel page must be published first' }, { status: 400 });
  }

  const username = (funnel as { users: { username: string } }).users.username;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://magnetlab.app';
  const pageUrl = `${appUrl}/p/${username}/${funnel.slug}/content`;

  try {
    logInfo('screenshots', 'Generating screenshots', { leadMagnetId: id, pageUrl });

    const screenshots = await generateContentScreenshots({
      pageUrl,
      sectionCount: polishedContent.sections.length,
    });

    // Upload each screenshot to Supabase Storage
    const screenshotUrls: ScreenshotUrl[] = [];

    for (const shot of screenshots) {
      const prefix = shot.type === 'hero' ? 'hero' : `section-${shot.sectionIndex}`;

      // Upload 1200x627
      const path1200 = `screenshots/${session.user.id}/${id}/${prefix}-1200x627.png`;
      await supabase.storage.from('magnetlab').upload(path1200, shot.buffer1200x627, {
        contentType: 'image/png',
        upsert: true,
      });

      // Upload 1080x1080
      const path1080 = `screenshots/${session.user.id}/${id}/${prefix}-1080x1080.png`;
      await supabase.storage.from('magnetlab').upload(path1080, shot.buffer1080x1080, {
        contentType: 'image/png',
        upsert: true,
      });

      const { data: url1200 } = supabase.storage.from('magnetlab').getPublicUrl(path1200);
      const { data: url1080 } = supabase.storage.from('magnetlab').getPublicUrl(path1080);

      screenshotUrls.push({
        type: shot.type,
        sectionIndex: shot.sectionIndex,
        sectionName: shot.sectionName,
        url1200x627: url1200.publicUrl,
        url1080x1080: url1080.publicUrl,
      });
    }

    // Save to database
    await supabase
      .from('lead_magnets')
      .update({ screenshot_urls: screenshotUrls })
      .eq('id', id);

    logInfo('screenshots', 'Screenshots generated', { count: screenshotUrls.length });

    return NextResponse.json({ screenshotUrls });
  } catch (err) {
    logError('screenshots', err);
    return NextResponse.json({ error: 'Failed to generate screenshots' }, { status: 500 });
  } finally {
    await closeScreenshotBrowser();
  }
}
```

**Step 2: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build 2>&1 | tail -10`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/lead-magnet/\[id\]/screenshots/route.ts
git commit -m "feat: add screenshot generation API endpoint"
```

---

### Task 19: Build Screenshot Gallery UI

**Files:**
- Create: `src/components/magnets/ScreenshotGallery.tsx`

**Step 1: Create the gallery component**

Create `src/components/magnets/ScreenshotGallery.tsx`:

```typescript
'use client';

import { useState } from 'react';
import type { ScreenshotUrl } from '@/lib/types/lead-magnet';

interface ScreenshotGalleryProps {
  screenshotUrls: ScreenshotUrl[];
  onGenerate: () => Promise<void>;
  isGenerating: boolean;
  leadMagnetId: string;
}

export function ScreenshotGallery({
  screenshotUrls,
  onGenerate,
  isGenerating,
}: ScreenshotGalleryProps) {
  const [selectedFormat, setSelectedFormat] = useState<'1200x627' | '1080x1080'>('1200x627');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedShot = selectedIndex !== null ? screenshotUrls[selectedIndex] : null;
  const selectedUrl = selectedShot
    ? selectedFormat === '1200x627' ? selectedShot.url1200x627 : selectedShot.url1080x1080
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Post Images</h3>
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : screenshotUrls.length ? 'Regenerate' : 'Generate Images'}
        </button>
      </div>

      {screenshotUrls.length > 0 && (
        <>
          {/* Format toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedFormat('1200x627')}
              className={`rounded px-2 py-1 text-xs ${selectedFormat === '1200x627' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              Landscape (1200x627)
            </button>
            <button
              onClick={() => setSelectedFormat('1080x1080')}
              className={`rounded px-2 py-1 text-xs ${selectedFormat === '1080x1080' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              Square (1080x1080)
            </button>
          </div>

          {/* Thumbnail grid */}
          <div className="grid grid-cols-3 gap-2">
            {screenshotUrls.map((shot, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                  selectedIndex === idx ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-muted'
                }`}
              >
                <img
                  src={selectedFormat === '1200x627' ? shot.url1200x627 : shot.url1080x1080}
                  alt={shot.type === 'hero' ? 'Hero' : shot.sectionName || `Section ${shot.sectionIndex}`}
                  className="aspect-video w-full object-cover"
                />
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-xs text-white">
                  {shot.type === 'hero' ? 'Hero' : shot.sectionName || `Section ${(shot.sectionIndex ?? 0) + 1}`}
                </span>
              </button>
            ))}
          </div>

          {/* Preview */}
          {selectedUrl && (
            <div className="space-y-2">
              <img
                src={selectedUrl}
                alt="Selected screenshot"
                className="w-full rounded-lg border"
              />
              <div className="flex gap-2">
                <a
                  href={selectedUrl}
                  download
                  className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80"
                >
                  Download
                </a>
                <button
                  onClick={() => navigator.clipboard.writeText(selectedUrl)}
                  className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80"
                >
                  Copy URL
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {screenshotUrls.length === 0 && !isGenerating && (
        <p className="text-sm text-muted-foreground">
          Generate preview images of your content page to use in LinkedIn posts.
        </p>
      )}
    </div>
  );
}
```

**Step 2: Integrate into magnet detail page**

Find the lead magnet detail page (likely `src/app/(dashboard)/magnets/[id]/page.tsx` or a client component) and add the `ScreenshotGallery` component, passing `screenshotUrls` from the lead magnet data and a `handleGenerate` function that calls `POST /api/lead-magnet/{id}/screenshots`.

**Step 3: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/magnets/ScreenshotGallery.tsx
git commit -m "feat: add screenshot gallery UI with format toggle and preview"
```

---

### Task 20: Integration Test — Full Screenshot Flow

**Files:**
- Create: `src/__tests__/api/lead-magnet/screenshots.test.ts`

**Step 1: Write the integration test**

```typescript
import { generateContentScreenshots } from '@/lib/services/screenshot';

// Mock Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        goto: jest.fn(),
        waitForTimeout: jest.fn(),
        screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-png')),
        $: jest.fn().mockResolvedValue({
          scrollIntoViewIfNeeded: jest.fn(),
          getAttribute: jest.fn().mockResolvedValue('Introduction'),
        }),
        close: jest.fn(),
      }),
      close: jest.fn(),
    }),
  },
}));

describe('Screenshot Generation', () => {
  it('generates hero + section screenshots', async () => {
    const results = await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 2,
    });

    expect(results).toHaveLength(3); // hero + 2 sections
    expect(results[0].type).toBe('hero');
    expect(results[1].type).toBe('section');
    expect(results[1].sectionIndex).toBe(0);
    expect(results[2].type).toBe('section');
    expect(results[2].sectionIndex).toBe(1);
  });

  it('returns buffers for both sizes', async () => {
    const results = await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 1,
    });

    expect(results[0].buffer1200x627).toBeInstanceOf(Buffer);
    expect(results[0].buffer1080x1080).toBeInstanceOf(Buffer);
  });
});
```

**Step 2: Run test**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/lead-magnet/screenshots.test.ts --no-coverage`
Expected: PASS

**Step 3: Commit**

```bash
git add src/__tests__/api/lead-magnet/screenshots.test.ts
git commit -m "test: add screenshot generation integration tests"
```

---

## Execution Checklist

| Task | Phase | Description | Commit |
|------|-------|-------------|--------|
| 1 | 0 | Delete debug endpoint | `fix: remove debug auth endpoint` |
| 2 | 0 | Sanitize pixel scripts | `fix: sanitize pixel IDs to prevent XSS` |
| 3 | 0 | Add error boundary | `feat: add React error boundary` |
| 4 | 0 | Remove LeadShark | `chore: remove LeadShark dead code` |
| 5 | 0 | Replace console.log | `refactor: replace console statements` |
| 6 | 1 | Notion DB migration | `chore: add migration to remove Notion schema` |
| 7 | 1 | Notion scripts + docs | `chore: remove Notion scripts and doc references` |
| 8 | 1 | Notion test cleanup | `test: remove Notion references from E2E tests` |
| 9 | 2 | Extend PolishedBlock types | `feat: extend PolishedBlock with new types` |
| 10 | 2 | Code block renderer | `feat: add syntax-highlighted code block` |
| 11 | 2 | Table block renderer | `feat: add table block renderer` |
| 12 | 2 | Accordion + image + embed | `feat: add accordion, image, embed renderers` |
| 13 | 2 | Update block editor | `feat: add editor support for new block types` |
| 14 | 2 | Update AI polish prompt | `feat: update AI prompt for new block types` |
| 15 | 3 | Screenshot service | `feat: add Playwright screenshot service` |
| 16 | 3 | Section data attributes | `feat: add data-section attributes` |
| 17 | 3 | Screenshot DB column | `feat: add screenshot_urls column` |
| 18 | 3 | Screenshot API endpoint | `feat: add screenshot generation API` |
| 19 | 3 | Screenshot gallery UI | `feat: add screenshot gallery UI` |
| 20 | 3 | Screenshot tests | `test: add screenshot integration tests` |

---

## Notes for Later Phases

Phases 4-10 (Analytics, Unipile, Email Analytics, Testing, Team RBAC, Dependencies, Polish) will each get their own implementation plan when Phase 3 is complete. See `docs/plans/2026-02-14-magnetlab-roadmap-design.md` for the full design.
