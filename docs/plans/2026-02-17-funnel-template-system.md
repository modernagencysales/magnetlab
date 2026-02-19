# Funnel Template System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add static funnel page templates that auto-populate design system sections for all 3 page types (opt-in, thank-you, content) when a funnel is created, with account-level defaults and per-funnel override.

**Architecture:** Templates are static JSON configs in a constants file. Users pick a default template in Settings (stored as `users.default_funnel_template`). When a new funnel is created via `POST /api/funnel`, sections are auto-inserted from the template. The existing section builder handles per-funnel customization. Auto-polish on publish already exists — we add a formatting-only mode to preserve user wording.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL), React, TypeScript, Claude AI (for polish)

---

### Task 1: Create Template Definitions Constants File

**Files:**
- Create: `src/lib/constants/funnel-templates.ts`

**Step 1: Create the template definitions file**

```typescript
// src/lib/constants/funnel-templates.ts

import type { SectionType, PageLocation } from '@/lib/types/funnel';

export interface TemplateSectionDef {
  sectionType: SectionType;
  pageLocation: PageLocation;
  sortOrder: number;
  config: Record<string, unknown>;
}

export interface FunnelTemplate {
  id: string;
  name: string;
  description: string;
  sections: TemplateSectionDef[];
}

export const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and simple — just your content, no extra sections',
    sections: [],
  },
  {
    id: 'social_proof',
    name: 'Social Proof',
    description: 'Build trust with logos and testimonials around your content',
    sections: [
      // Opt-in page
      {
        sectionType: 'logo_bar',
        pageLocation: 'optin',
        sortOrder: 0,
        config: {
          logos: [
            { name: 'Company 1', imageUrl: '' },
            { name: 'Company 2', imageUrl: '' },
            { name: 'Company 3', imageUrl: '' },
          ],
        },
      },
      // Thank-you page
      {
        sectionType: 'steps',
        pageLocation: 'thankyou',
        sortOrder: 0,
        config: {
          heading: 'What Happens Next',
          steps: [
            { title: 'Check Your Email', description: 'We just sent you the access link' },
            { title: 'Read the Guide', description: 'Dive into the full content' },
            { title: 'Take Action', description: 'Apply what you learn today' },
          ],
        },
      },
      // Content page
      {
        sectionType: 'logo_bar',
        pageLocation: 'content',
        sortOrder: 0,
        config: {
          logos: [
            { name: 'Company 1', imageUrl: '' },
            { name: 'Company 2', imageUrl: '' },
            { name: 'Company 3', imageUrl: '' },
          ],
        },
      },
      {
        sectionType: 'testimonial',
        pageLocation: 'content',
        sortOrder: 50,
        config: {
          quote: 'This was incredibly helpful and actionable.',
          author: 'Happy Reader',
          role: 'Your ideal client role',
        },
      },
    ],
  },
  {
    id: 'authority',
    name: 'Authority',
    description: 'Establish expertise with clear steps and social proof',
    sections: [
      // Opt-in page
      {
        sectionType: 'steps',
        pageLocation: 'optin',
        sortOrder: 0,
        config: {
          heading: 'How It Works',
          steps: [
            { title: 'Enter Your Email', description: 'Get instant access to the guide' },
            { title: 'Read & Learn', description: 'Actionable strategies you can use today' },
            { title: 'See Results', description: 'Apply the framework and track progress' },
          ],
        },
      },
      {
        sectionType: 'testimonial',
        pageLocation: 'optin',
        sortOrder: 50,
        config: {
          quote: 'This completely changed how I approach my work.',
          author: 'Happy Reader',
          role: 'Your ideal client role',
          result: 'Achieved measurable improvement',
        },
      },
      // Thank-you page
      {
        sectionType: 'steps',
        pageLocation: 'thankyou',
        sortOrder: 0,
        config: {
          heading: "What's Next",
          steps: [
            { title: 'Check Your Email', description: 'We just sent you the access link' },
            { title: 'Read the Guide', description: 'Dive into the full content' },
            { title: 'Take Action', description: 'Apply what you learn today' },
          ],
        },
      },
      // Content page
      {
        sectionType: 'steps',
        pageLocation: 'content',
        sortOrder: 0,
        config: {
          heading: "What You'll Learn",
          steps: [
            { title: 'Key Concept 1', description: 'The foundation you need' },
            { title: 'Key Concept 2', description: 'Advanced strategies' },
            { title: 'Key Concept 3', description: 'Putting it all together' },
          ],
        },
      },
      {
        sectionType: 'testimonial',
        pageLocation: 'content',
        sortOrder: 50,
        config: {
          quote: 'Practical, no-fluff advice that actually works.',
          author: 'Happy Reader',
          role: 'Your ideal client role',
        },
      },
      {
        sectionType: 'section_bridge',
        pageLocation: 'content',
        sortOrder: 51,
        config: {
          text: 'Ready to take the next step?',
          variant: 'accent',
        },
      },
    ],
  },
  {
    id: 'full_suite',
    name: 'Full Suite',
    description: 'Maximum impact with logos, steps, testimonials, and CTAs',
    sections: [
      // Opt-in page
      {
        sectionType: 'logo_bar',
        pageLocation: 'optin',
        sortOrder: 0,
        config: {
          logos: [
            { name: 'Company 1', imageUrl: '' },
            { name: 'Company 2', imageUrl: '' },
            { name: 'Company 3', imageUrl: '' },
          ],
        },
      },
      {
        sectionType: 'steps',
        pageLocation: 'optin',
        sortOrder: 1,
        config: {
          heading: 'How It Works',
          steps: [
            { title: 'Enter Your Email', description: 'Get instant access' },
            { title: 'Read & Learn', description: 'Actionable strategies' },
            { title: 'See Results', description: 'Apply and track progress' },
          ],
        },
      },
      {
        sectionType: 'testimonial',
        pageLocation: 'optin',
        sortOrder: 50,
        config: {
          quote: 'This was a game-changer for my business.',
          author: 'Happy Reader',
          role: 'Your ideal client role',
          result: 'Achieved measurable improvement',
        },
      },
      // Thank-you page
      {
        sectionType: 'steps',
        pageLocation: 'thankyou',
        sortOrder: 0,
        config: {
          heading: 'What Happens Next',
          steps: [
            { title: 'Check Your Email', description: 'We just sent you the access link' },
            { title: 'Read the Guide', description: 'Dive into the full content' },
            { title: 'Book a Call', description: 'Let\'s discuss your specific situation' },
          ],
        },
      },
      {
        sectionType: 'section_bridge',
        pageLocation: 'thankyou',
        sortOrder: 50,
        config: {
          text: 'Want personalized guidance?',
          variant: 'gradient',
        },
      },
      // Content page
      {
        sectionType: 'logo_bar',
        pageLocation: 'content',
        sortOrder: 0,
        config: {
          logos: [
            { name: 'Company 1', imageUrl: '' },
            { name: 'Company 2', imageUrl: '' },
            { name: 'Company 3', imageUrl: '' },
          ],
        },
      },
      {
        sectionType: 'steps',
        pageLocation: 'content',
        sortOrder: 1,
        config: {
          heading: "What You'll Learn",
          steps: [
            { title: 'Key Concept 1', description: 'The foundation' },
            { title: 'Key Concept 2', description: 'Advanced strategies' },
            { title: 'Key Concept 3', description: 'Putting it together' },
          ],
        },
      },
      {
        sectionType: 'testimonial',
        pageLocation: 'content',
        sortOrder: 50,
        config: {
          quote: 'Practical, actionable, and worth every minute.',
          author: 'Happy Reader',
          role: 'Your ideal client role',
        },
      },
      {
        sectionType: 'marketing_block',
        pageLocation: 'content',
        sortOrder: 51,
        config: {
          blockType: 'benefit',
          title: 'Why This Matters',
          content: 'A brief explanation of the key benefit readers get from this content.',
        },
      },
      {
        sectionType: 'section_bridge',
        pageLocation: 'content',
        sortOrder: 52,
        config: {
          text: 'Ready to take the next step?',
          variant: 'gradient',
        },
      },
    ],
  },
];

export const DEFAULT_TEMPLATE_ID = 'social_proof';

export function getTemplate(id: string): FunnelTemplate {
  return FUNNEL_TEMPLATES.find(t => t.id === id) || FUNNEL_TEMPLATES.find(t => t.id === DEFAULT_TEMPLATE_ID)!;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to the new file

**Step 3: Commit**

```bash
git add src/lib/constants/funnel-templates.ts
git commit -m "feat: add funnel template definitions"
```

---

### Task 2: Add Database Migration for default_funnel_template Column

**Files:**
- Create: Supabase migration (via SQL)

**Step 1: Add the column to users table**

Run this SQL against the shared Supabase project:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_funnel_template text DEFAULT 'social_proof';
```

Use Supabase Management API:
```bash
SUPABASE_TOKEN=$(security find-generic-password -s "Supabase CLI" -w | sed 's/go-keyring-base64://' | base64 -D)
curl -s -X POST "https://api.supabase.com/v1/projects/qvawbxpijxlwdkolmjrs/database/query" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "ALTER TABLE users ADD COLUMN IF NOT EXISTS default_funnel_template text DEFAULT '\''social_proof'\'';"}'
```

**Step 2: Verify column exists**

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/qvawbxpijxlwdkolmjrs/database/query" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = '\''users'\'' AND column_name = '\''default_funnel_template'\'';"}'
```

Expected: Returns the column with default `'social_proof'`

---

### Task 3: Update User Defaults API to Handle Template Setting

**Files:**
- Modify: `src/app/api/user/defaults/route.ts`

**Step 1: Update GET to include template**

In `src/app/api/user/defaults/route.ts`, update the GET handler select and response to include `default_funnel_template`:

Change the select at line 21 from:
```typescript
.select('default_vsl_url')
```
to:
```typescript
.select('default_vsl_url, default_funnel_template')
```

Change the response at line 30-32 from:
```typescript
return NextResponse.json({
  defaultVslUrl: data.default_vsl_url,
});
```
to:
```typescript
return NextResponse.json({
  defaultVslUrl: data.default_vsl_url,
  defaultFunnelTemplate: data.default_funnel_template || 'social_proof',
});
```

**Step 2: Update PUT to handle template**

In the PUT handler, after the `defaultVslUrl` extraction at line 47, also extract `defaultFunnelTemplate`:

```typescript
const { defaultVslUrl, defaultFunnelTemplate } = body;
```

Add validation for template ID (after the URL validation block around line 60):

```typescript
// Validate template ID if provided
const validTemplateIds = ['minimal', 'social_proof', 'authority', 'full_suite'];
if (defaultFunnelTemplate !== undefined && !validTemplateIds.includes(defaultFunnelTemplate)) {
  return ApiErrors.validationError('Invalid funnel template ID');
}
```

Update the update call at line 64-68 to include template:

```typescript
const updateData: Record<string, unknown> = {
  default_vsl_url: defaultVslUrl?.trim() || null,
};
if (defaultFunnelTemplate !== undefined) {
  updateData.default_funnel_template = defaultFunnelTemplate;
}

const { data, error } = await supabase
  .from('users')
  .update(updateData)
  .eq('id', session.user.id)
  .select('default_vsl_url, default_funnel_template')
  .single();
```

Update the response to include template:
```typescript
return NextResponse.json({
  defaultVslUrl: data.default_vsl_url,
  defaultFunnelTemplate: data.default_funnel_template || 'social_proof',
});
```

**Step 3: Verify TypeScript compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 4: Commit**

```bash
git add src/app/api/user/defaults/route.ts
git commit -m "feat: add default_funnel_template to user defaults API"
```

---

### Task 4: Auto-Populate Sections on Funnel Creation

**Files:**
- Modify: `src/app/api/funnel/route.ts` (POST handler, lines 92-282)

**Step 1: Import template helper**

Add at the top of the file (after existing imports):

```typescript
import { getTemplate, DEFAULT_TEMPLATE_ID } from '@/lib/constants/funnel-templates';
```

**Step 2: Read user's template preference**

In the POST handler, update the user profile query at line 199-202 to also select `default_funnel_template`:

```typescript
const { data: profile } = await supabase
  .from('users')
  .select('default_theme, default_primary_color, default_background_style, default_logo_url, default_vsl_url, default_funnel_template')
  .eq('id', session.user.id)
  .single();
```

**Step 3: Auto-insert template sections after funnel creation**

After the funnel is successfully created (after line 272, before the return), add template section insertion:

```typescript
// Auto-populate sections from user's default template
const templateId = profile?.default_funnel_template || DEFAULT_TEMPLATE_ID;
const template = getTemplate(templateId);

if (template.sections.length > 0 && data) {
  const sectionRows = template.sections.map(s => ({
    funnel_page_id: data.id,
    section_type: s.sectionType,
    page_location: s.pageLocation,
    sort_order: s.sortOrder,
    is_visible: true,
    config: s.config,
  }));

  const { error: sectionsError } = await supabase
    .from('funnel_page_sections')
    .insert(sectionRows);

  if (sectionsError) {
    // Log but don't fail — funnel was created successfully
    logApiError('funnel/create/template-sections', sectionsError, {
      userId: session.user.id,
      funnelId: data.id,
      templateId,
    });
  }
}
```

**Step 4: Verify TypeScript compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 5: Commit**

```bash
git add src/app/api/funnel/route.ts
git commit -m "feat: auto-populate sections from template on funnel creation"
```

---

### Task 5: Create Funnel Template Selector Settings Component

**Files:**
- Create: `src/components/settings/FunnelTemplateSettings.tsx`

**Step 1: Create the component**

```tsx
// src/components/settings/FunnelTemplateSettings.tsx
'use client';

import { useState } from 'react';
import { Loader2, Check, Layout, Sparkles, Award, Layers } from 'lucide-react';
import { FUNNEL_TEMPLATES } from '@/lib/constants/funnel-templates';

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  minimal: <Layout className="h-5 w-5" />,
  social_proof: <Sparkles className="h-5 w-5" />,
  authority: <Award className="h-5 w-5" />,
  full_suite: <Layers className="h-5 w-5" />,
};

interface FunnelTemplateSettingsProps {
  currentTemplate: string;
  onSaved: (templateId: string) => void;
}

export function FunnelTemplateSettings({ currentTemplate, onSaved }: FunnelTemplateSettingsProps) {
  const [selected, setSelected] = useState(currentTemplate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (templateId: string) => {
    if (templateId === selected) return;
    setSelected(templateId);
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/user/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultFunnelTemplate: templateId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      onSaved(templateId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSelected(currentTemplate); // revert
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Default Funnel Template</h3>
        <p className="text-sm text-muted-foreground">
          New funnels will use this template to pre-populate page sections. You can customize sections per funnel afterward.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FUNNEL_TEMPLATES.map(template => {
          const isSelected = selected === template.id;
          const sectionCount = template.sections.length;
          return (
            <button
              key={template.id}
              onClick={() => handleSelect(template.id)}
              disabled={saving}
              className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              } disabled:opacity-50`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-muted-foreground">{TEMPLATE_ICONS[template.id]}</span>
                <span className="font-medium">{template.name}</span>
              </div>
              <p className="text-sm text-muted-foreground">{template.description}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {sectionCount === 0 ? 'No sections' : `${sectionCount} section${sectionCount !== 1 ? 's' : ''} across pages`}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/components/settings/FunnelTemplateSettings.tsx
git commit -m "feat: add FunnelTemplateSettings component"
```

---

### Task 6: Wire Template Selector Into Settings Page

**Files:**
- Modify: `src/components/dashboard/SettingsContent.tsx`

**Step 1: Add import**

Add at the top with other imports:
```typescript
import { FunnelTemplateSettings } from '@/components/settings/FunnelTemplateSettings';
```

**Step 2: Add state for template**

Add after the `defaultVslUrlError` state (around line 82):
```typescript
const [defaultFunnelTemplate, setDefaultFunnelTemplate] = useState('social_proof');
```

**Step 3: Update fetchUserDefaults to load template**

In the `fetchUserDefaults` function (around line 106-118), update to also read the template:
```typescript
const fetchUserDefaults = async () => {
  try {
    const response = await fetch('/api/user/defaults');
    if (response.ok) {
      const data = await response.json();
      setDefaultVslUrl(data.defaultVslUrl || '');
      setDefaultFunnelTemplate(data.defaultFunnelTemplate || 'social_proof');
    }
  } catch (error) {
    logError('dashboard/settings', error, { step: 'failed_to_fetch_user_defaults' });
  } finally {
    setDefaultVslUrlLoading(false);
  }
};
```

**Step 4: Add FunnelTemplateSettings to the JSX**

Find the "Page Defaults" section in the render output (search for "Page Defaults" or the `defaultVslUrl` section). Add the `FunnelTemplateSettings` component right before or after the Default VSL URL section, inside a card/section wrapper:

```tsx
{/* Funnel Template */}
<div className="rounded-lg border bg-card p-6">
  <FunnelTemplateSettings
    currentTemplate={defaultFunnelTemplate}
    onSaved={setDefaultFunnelTemplate}
  />
</div>
```

**Step 5: Verify TypeScript compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 6: Commit**

```bash
git add src/components/dashboard/SettingsContent.tsx
git commit -m "feat: wire FunnelTemplateSettings into settings page"
```

---

### Task 7: Add "Reset to Template" Button to SectionsManager

**Files:**
- Modify: `src/components/funnel/SectionsManager.tsx`

**Step 1: Import template helper**

Add at the top:
```typescript
import { getTemplate, FUNNEL_TEMPLATES } from '@/lib/constants/funnel-templates';
```

**Step 2: Add reset state and handler**

Inside the `SectionsManager` component (after the `deletingId` state around line 66), add:

```typescript
const [resetting, setResetting] = useState(false);

const handleResetToTemplate = async () => {
  if (!funnelId) return;
  if (!confirm(`This will replace all ${PAGE_LOCATIONS.find(l => l.value === activeLocation)?.label} sections with the template defaults. Continue?`)) return;

  setResetting(true);
  try {
    const res = await fetch(`/api/funnel/${funnelId}/sections/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageLocation: activeLocation }),
    });

    if (res.ok) {
      const data = await res.json();
      // Replace sections for this page location, keep others
      const otherSections = sections.filter(s => s.pageLocation !== activeLocation);
      onSectionsChange([...otherSections, ...data.sections]);
    }
  } catch {
    // ignore
  } finally {
    setResetting(false);
  }
};
```

**Step 3: Add reset button to the JSX**

After the "Add section" div (around line 268), add:

```tsx
{/* Reset to template */}
<button
  onClick={handleResetToTemplate}
  disabled={resetting}
  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
>
  {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
  Reset to template defaults
</button>
```

**Step 4: Verify TypeScript compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 5: Commit**

```bash
git add src/components/funnel/SectionsManager.tsx
git commit -m "feat: add 'Reset to Template' button in SectionsManager"
```

---

### Task 8: Create Reset Sections API Endpoint

**Files:**
- Create: `src/app/api/funnel/[id]/sections/reset/route.ts`

**Step 1: Create the reset endpoint**

```typescript
// src/app/api/funnel/[id]/sections/reset/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { funnelPageSectionFromRow, type FunnelPageSectionRow, type PageLocation } from '@/lib/types/funnel';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { getTemplate, DEFAULT_TEMPLATE_ID } from '@/lib/constants/funnel-templates';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid funnel page ID');
    }

    const body = await request.json();
    const { pageLocation } = body;

    const validLocations: PageLocation[] = ['optin', 'thankyou', 'content'];
    if (!validLocations.includes(pageLocation)) {
      return ApiErrors.validationError('Invalid pageLocation');
    }

    const supabase = createSupabaseAdminClient();

    // Verify funnel ownership
    const { data: funnel, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (funnelError || !funnel) {
      return ApiErrors.notFound('Funnel page');
    }

    // Get user's template preference
    const { data: user } = await supabase
      .from('users')
      .select('default_funnel_template')
      .eq('id', session.user.id)
      .single();

    const template = getTemplate(user?.default_funnel_template || DEFAULT_TEMPLATE_ID);

    // Delete existing sections for this page location
    await supabase
      .from('funnel_page_sections')
      .delete()
      .eq('funnel_page_id', id)
      .eq('page_location', pageLocation);

    // Insert template sections for this page location
    const templateSections = template.sections.filter(s => s.pageLocation === pageLocation);

    if (templateSections.length === 0) {
      return NextResponse.json({ sections: [] });
    }

    const sectionRows = templateSections.map(s => ({
      funnel_page_id: id,
      section_type: s.sectionType,
      page_location: s.pageLocation,
      sort_order: s.sortOrder,
      is_visible: true,
      config: s.config,
    }));

    const { data, error } = await supabase
      .from('funnel_page_sections')
      .insert(sectionRows)
      .select();

    if (error) {
      logApiError('funnel/sections/reset', error, { funnelId: id });
      return ApiErrors.databaseError('Failed to reset sections');
    }

    const sections = (data as FunnelPageSectionRow[]).map(funnelPageSectionFromRow);

    return NextResponse.json({ sections });
  } catch (error) {
    logApiError('funnel/sections/reset', error);
    return ApiErrors.internalError('Failed to reset sections');
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/app/api/funnel/[id]/sections/reset/route.ts
git commit -m "feat: add reset-to-template sections API endpoint"
```

---

### Task 9: Update Polish Prompt for Formatting-Only Mode

**Files:**
- Modify: `src/lib/ai/lead-magnet-generator.ts` (lines 1251-1367)

**Step 1: Add a `formattingOnly` parameter to the polish function**

Change the function signature at line 1251 from:
```typescript
export async function polishLeadMagnetContent(
  extractedContent: ExtractedContent,
  concept: LeadMagnetConcept
): Promise<PolishedContent> {
```
to:
```typescript
export async function polishLeadMagnetContent(
  extractedContent: ExtractedContent,
  concept: LeadMagnetConcept,
  options?: { formattingOnly?: boolean }
): Promise<PolishedContent> {
```

**Step 2: Add formatting-only prompt variation**

After the function signature, add the formatting-only prompt before the existing prompt:

```typescript
const formattingOnly = options?.formattingOnly ?? false;

const formattingOnlyInstructions = formattingOnly ? `
CRITICAL: FORMATTING ONLY MODE
- Your job is ONLY to format and structure the content — NOT to rewrite it.
- Preserve the user's original wording exactly. Do not paraphrase, reword, or add new content.
- Structure raw answers into clean blocks: headings, paragraphs, lists, callouts.
- Convert bullet points to proper list blocks.
- Wrap key insights in callout blocks.
- Add proper section headings matching the section names.
- Calculate reading time and word count.
- Do NOT clean up "AI phrases" in this mode — preserve the text as-is.
- Do NOT add filler, transitions, or new sentences.
` : '';
```

Then insert `${formattingOnlyInstructions}` into the prompt after `CONTENT GUIDELINES:` (around line 1284), or replace the AI PHRASE CLEANUP section conditionally. The simplest approach: insert it right after the opening of the prompt template at line 1255:

Find the line:
```
You are a content designer who transforms raw lead magnet content into beautifully structured, polished content blocks for a clean reading experience.
```

Replace with:
```
You are a content designer who transforms raw lead magnet content into beautifully structured, polished content blocks for a clean reading experience.
${formattingOnlyInstructions}
```

And wrap the "AI PHRASE CLEANUP" section (lines 1300-1316) in a conditional:

```typescript
${formattingOnly ? '' : `AI PHRASE CLEANUP — CRITICAL:
...existing cleanup instructions...
`}
```

**Step 3: Update the auto-polish call in publish route**

In `src/app/api/funnel/[id]/publish/route.ts` at line 82, update the polish call to use formatting-only mode:

```typescript
const polished = await polishLeadMagnetContent(
  lm.extracted_content as ExtractedContent,
  lm.concept as LeadMagnetConcept,
  { formattingOnly: true }
);
```

**Step 4: Verify TypeScript compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 5: Commit**

```bash
git add src/lib/ai/lead-magnet-generator.ts src/app/api/funnel/[id]/publish/route.ts
git commit -m "feat: add formatting-only mode to content polishing"
```

---

### Task 10: Update ContentPageTab Empty State

**Files:**
- Modify: `src/components/funnel/ContentPageTab.tsx` (lines 46-57)

**Step 1: Update the empty state message**

Replace the "Generate content first" block (lines 46-57) with a more helpful message:

```tsx
if (!hasExtracted) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Content Page</h3>
      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
        <p>No content yet.</p>
        <p className="text-sm mt-2">
          Complete the lead magnet wizard to generate content, or this will be auto-formatted when you publish.
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Add a note about auto-polish for extracted-but-not-polished state**

After the `hasExtracted` check, before the polished status block (around line 73), add a note when content exists but isn't polished:

```tsx
{hasExtracted && !hasPolished && (
  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
    Content will be auto-formatted when you publish. You can also polish it manually below.
  </div>
)}
```

**Step 3: Verify TypeScript compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 4: Commit**

```bash
git add src/components/funnel/ContentPageTab.tsx
git commit -m "feat: update ContentPageTab empty state messaging"
```

---

### Task 11: Final Verification and Deploy

**Step 1: Run full typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty`
Expected: No errors

**Step 2: Run linter**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run lint`
Expected: No errors

**Step 3: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run test`
Expected: All tests pass

**Step 4: Build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run build`
Expected: Build succeeds

**Step 5: Deploy to Vercel**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && vercel --prod`

**Step 6: Deploy Trigger.dev (if any trigger changes)**

No trigger task changes in this plan — skip.
