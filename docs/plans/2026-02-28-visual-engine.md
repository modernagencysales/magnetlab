# Visual Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI image generation (Gemini), branded carousel creation (ScreenshotOne), and image publishing (Unipile) to magnetlab's content pipeline.

**Architecture:** Posts get new `image_urls` and `carousel_data` columns. Gemini Imagen generates on-brand images from post content + brand kit. Claude Haiku extracts carousel slides from post text, HTML templates render them branded, ScreenshotOne captures as PNGs. Unipile's `createPost` is extended with media array for LinkedIn image/carousel publishing.

**Tech Stack:** Google Gemini Imagen 3 (image gen), Claude Haiku (slide extraction), ScreenshotOne API (HTML→PNG), Supabase Storage (asset hosting), Unipile API (LinkedIn publishing), React (editor UI)

---

## Existing Code Reference

Before starting, read these files to understand the codebase patterns:

- **PipelinePost type**: `src/lib/types/content-pipeline.ts:319-354` — the post interface (no media fields yet)
- **BrandKit type**: `src/lib/api/resolve-brand-kit.ts:6-19` — brand colors, fonts, logo
- **Screenshot service**: `src/lib/services/screenshot.ts` — ScreenshotOne API wrapper with retry logic
- **Unipile client**: `src/lib/integrations/unipile.ts:55-60` — `createPost(accountId, text)` (text-only)
- **LinkedIn publisher**: `src/lib/integrations/linkedin-publisher.ts` — `publishNow(content)` wrapper
- **PostDetailModal**: `src/components/content-pipeline/PostDetailModal.tsx` — 863-line split-pane editor
- **Posts API**: `src/app/api/content-pipeline/posts/route.ts` — GET handler with column selection
- **Post PATCH**: search for `PATCH` in posts API or `posts/[id]` route — update handler
- **Prompt defaults**: `src/lib/ai/content-pipeline/prompt-defaults.ts` — where prompt slugs are registered

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260228200000_visual_engine.sql`

**Step 1: Write the migration**

```sql
-- Visual Engine: image generation + carousel support for content pipeline posts

-- Add image/carousel columns to cp_pipeline_posts
ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS carousel_data JSONB,
  ADD COLUMN IF NOT EXISTS image_generation_status TEXT;

COMMENT ON COLUMN cp_pipeline_posts.image_urls IS 'Array of image URLs for single/multi-image posts';
COMMENT ON COLUMN cp_pipeline_posts.carousel_data IS '{"slides":[{"type","heading","body","image_url"}],"theme"}';
COMMENT ON COLUMN cp_pipeline_posts.image_generation_status IS 'null | generating | ready | failed';

-- Carousel slide templates (user-customizable)
CREATE TABLE IF NOT EXISTS cp_image_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slide_type TEXT NOT NULL CHECK (slide_type IN ('title', 'quote', 'stat', 'list', 'cta')),
  html_template TEXT NOT NULL,
  css_styles TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cp_image_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates"
  ON cp_image_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role bypass for cp_image_templates"
  ON cp_image_templates FOR ALL
  USING (auth.role() = 'service_role');
```

**Step 2: Push the migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx supabase db push`

If migration history mismatch occurs, run SQL directly via Supabase Management API (see MEMORY.md for pattern).

**Step 3: Commit**

```bash
git add supabase/migrations/20260228200000_visual_engine.sql
git commit -m "feat: add visual engine DB migration (image_urls, carousel_data, cp_image_templates)"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/types/content-pipeline.ts`

**Step 1: Add carousel/image types**

Add these types BEFORE the `PipelinePost` interface (around line 315):

```typescript
// Visual Engine types
export type ImageStyle = 'abstract' | 'illustration' | 'photography' | 'minimal';
export type SlideType = 'title' | 'quote' | 'stat' | 'list' | 'cta';
export type CarouselTheme = 'brand' | 'dark' | 'light';
export type ImageGenerationStatus = 'generating' | 'ready' | 'failed';

export interface CarouselSlide {
  type: SlideType;
  heading: string;
  body: string;
  image_url: string;
  source_image_url?: string;
}

export interface CarouselData {
  slides: CarouselSlide[];
  theme: CarouselTheme;
}

export interface ImageTemplate {
  id: string;
  user_id: string;
  name: string;
  slide_type: SlideType;
  html_template: string;
  css_styles: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
```

**Step 2: Update PipelinePost interface**

Add these three fields to `PipelinePost` (after `engagement_scrape_count`):

```typescript
  image_urls: string[];
  carousel_data: CarouselData | null;
  image_generation_status: ImageGenerationStatus | null;
```

**Step 3: Commit**

```bash
git add src/lib/types/content-pipeline.ts
git commit -m "feat: add Visual Engine types (CarouselSlide, CarouselData, ImageTemplate)"
```

---

## Task 3: Slide HTML Templates

**Files:**
- Create: `src/lib/ai/content-pipeline/slide-templates.ts`
- Create: `src/__tests__/lib/ai/content-pipeline/slide-templates.test.ts`

**Step 1: Write the failing tests**

```typescript
/**
 * @jest-environment node
 */
import { buildSlideHtml, SLIDE_DIMENSIONS } from '@/lib/ai/content-pipeline/slide-templates';

describe('buildSlideHtml', () => {
  const brandKit = {
    default_primary_color: '#8b5cf6',
    font_family: 'Inter',
    logo_url: 'https://example.com/logo.png',
  };

  it('renders title slide with heading and author', () => {
    const html = buildSlideHtml(
      { type: 'title', heading: 'Why AI Changes Everything', body: 'Tim Johnson • CEO', image_url: '' },
      brandKit
    );
    expect(html).toContain('Why AI Changes Everything');
    expect(html).toContain('Tim Johnson');
    expect(html).toContain('#8b5cf6');
    expect(html).toContain('Inter');
  });

  it('renders quote slide with quotation marks', () => {
    const html = buildSlideHtml(
      { type: 'quote', heading: '', body: 'The best time to start is now.', image_url: '' },
      brandKit
    );
    expect(html).toContain('The best time to start is now.');
    expect(html).toContain('\u201C'); // left double quote
  });

  it('renders stat slide with large number', () => {
    const html = buildSlideHtml(
      { type: 'stat', heading: '3x', body: 'more engagement with carousels', image_url: '' },
      brandKit
    );
    expect(html).toContain('3x');
    expect(html).toContain('more engagement');
  });

  it('renders list slide with items', () => {
    const html = buildSlideHtml(
      { type: 'list', heading: 'Key Takeaways', body: '1. Be consistent\n2. Add value\n3. Stay authentic', image_url: '' },
      brandKit
    );
    expect(html).toContain('Key Takeaways');
    expect(html).toContain('Be consistent');
    expect(html).toContain('Add value');
  });

  it('renders cta slide with follow prompt', () => {
    const html = buildSlideHtml(
      { type: 'cta', heading: 'Want more?', body: 'Follow me for daily insights', image_url: '' },
      brandKit
    );
    expect(html).toContain('Want more?');
    expect(html).toContain('Follow me');
  });

  it('includes logo when provided', () => {
    const html = buildSlideHtml(
      { type: 'title', heading: 'Test', body: '', image_url: '' },
      brandKit
    );
    expect(html).toContain('logo.png');
  });

  it('uses fallback color when brand kit has no primary color', () => {
    const html = buildSlideHtml(
      { type: 'title', heading: 'Test', body: '', image_url: '' },
      { default_primary_color: null, font_family: null, logo_url: null }
    );
    expect(html).toContain('#8b5cf6'); // fallback violet
  });

  it('exports correct slide dimensions', () => {
    expect(SLIDE_DIMENSIONS.width).toBe(1080);
    expect(SLIDE_DIMENSIONS.height).toBe(1350);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/ai/content-pipeline/slide-templates.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Implement slide templates**

```typescript
// src/lib/ai/content-pipeline/slide-templates.ts

import type { CarouselSlide } from '@/lib/types/content-pipeline';

interface SlidesBrandKit {
  default_primary_color?: string | null;
  font_family?: string | null;
  logo_url?: string | null;
}

export const SLIDE_DIMENSIONS = { width: 1080, height: 1350 } as const;

const FALLBACK_COLOR = '#8b5cf6';

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
}

function baseStyles(brand: SlidesBrandKit): string {
  const primary = brand.default_primary_color || FALLBACK_COLOR;
  const textColor = getContrastColor(primary);
  const fontFamily = brand.font_family || 'Inter, system-ui, sans-serif';

  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily.split(',')[0].trim())}&display=swap');
    body {
      width: ${SLIDE_DIMENSIONS.width}px;
      height: ${SLIDE_DIMENSIONS.height}px;
      background: ${primary};
      color: ${textColor};
      font-family: '${fontFamily}', system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 80px;
      overflow: hidden;
    }
    .logo {
      position: absolute;
      top: 40px;
      left: 40px;
      width: 48px;
      height: 48px;
      object-fit: contain;
    }
    .slide-number {
      position: absolute;
      bottom: 40px;
      right: 40px;
      font-size: 16px;
      opacity: 0.6;
    }
  `;
}

function logoHtml(brand: SlidesBrandKit): string {
  if (!brand.logo_url) return '';
  return `<img class="logo" src="${brand.logo_url}" alt="logo" />`;
}

function titleSlide(slide: CarouselSlide, brand: SlidesBrandKit): string {
  return `
    <style>
      ${baseStyles(brand)}
      .heading { font-size: 64px; font-weight: 800; text-align: center; line-height: 1.2; margin-bottom: 32px; }
      .author { font-size: 24px; opacity: 0.8; text-align: center; }
    </style>
    ${logoHtml(brand)}
    <div class="heading">${escapeHtml(slide.heading)}</div>
    <div class="author">${escapeHtml(slide.body)}</div>
  `;
}

function quoteSlide(slide: CarouselSlide, brand: SlidesBrandKit): string {
  return `
    <style>
      ${baseStyles(brand)}
      .quote-mark { font-size: 120px; font-weight: 800; line-height: 1; opacity: 0.3; }
      .quote-text { font-size: 40px; font-weight: 600; text-align: center; line-height: 1.4; max-width: 900px; }
    </style>
    ${logoHtml(brand)}
    <div class="quote-mark">\u201C</div>
    <div class="quote-text">${escapeHtml(slide.body)}</div>
  `;
}

function statSlide(slide: CarouselSlide, brand: SlidesBrandKit): string {
  return `
    <style>
      ${baseStyles(brand)}
      .stat-number { font-size: 128px; font-weight: 900; line-height: 1; margin-bottom: 24px; }
      .stat-label { font-size: 32px; font-weight: 500; text-align: center; opacity: 0.85; max-width: 800px; }
    </style>
    ${logoHtml(brand)}
    <div class="stat-number">${escapeHtml(slide.heading)}</div>
    <div class="stat-label">${escapeHtml(slide.body)}</div>
  `;
}

function listSlide(slide: CarouselSlide, brand: SlidesBrandKit): string {
  const items = slide.body.split('\n').filter(Boolean).map(item => {
    const cleaned = item.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '');
    return `<li>${escapeHtml(cleaned)}</li>`;
  }).join('');

  return `
    <style>
      ${baseStyles(brand)}
      body { align-items: flex-start; justify-content: flex-start; padding-top: 120px; }
      .heading { font-size: 48px; font-weight: 800; margin-bottom: 48px; }
      ol { font-size: 32px; line-height: 1.8; padding-left: 40px; }
      li { margin-bottom: 12px; }
    </style>
    ${logoHtml(brand)}
    <div class="heading">${escapeHtml(slide.heading)}</div>
    <ol>${items}</ol>
  `;
}

function ctaSlide(slide: CarouselSlide, brand: SlidesBrandKit): string {
  return `
    <style>
      ${baseStyles(brand)}
      .heading { font-size: 56px; font-weight: 800; text-align: center; margin-bottom: 32px; }
      .cta-text { font-size: 28px; text-align: center; opacity: 0.85; max-width: 800px; }
    </style>
    ${logoHtml(brand)}
    <div class="heading">${escapeHtml(slide.heading)}</div>
    <div class="cta-text">${escapeHtml(slide.body)}</div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const RENDERERS: Record<string, (slide: CarouselSlide, brand: SlidesBrandKit) => string> = {
  title: titleSlide,
  quote: quoteSlide,
  stat: statSlide,
  list: listSlide,
  cta: ctaSlide,
};

export function buildSlideHtml(slide: CarouselSlide, brand: SlidesBrandKit): string {
  const renderer = RENDERERS[slide.type] || titleSlide;
  const body = renderer(slide, brand);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/ai/content-pipeline/slide-templates.test.ts --no-coverage`
Expected: 8 tests PASS

**Step 5: Commit**

```bash
git add src/lib/ai/content-pipeline/slide-templates.ts src/__tests__/lib/ai/content-pipeline/slide-templates.test.ts
git commit -m "feat: add carousel slide HTML templates (5 types, brand-aware)"
```

---

## Task 4: Image Generator Module (Gemini)

**Files:**
- Create: `src/lib/ai/content-pipeline/image-generator.ts`
- Create: `src/__tests__/lib/ai/content-pipeline/image-generator.test.ts`

**Step 1: Write the failing tests**

```typescript
/**
 * @jest-environment node
 */

const mockGenerateImages = jest.fn();
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateImages,
    }),
  })),
}));

const mockUpload = jest.fn().mockResolvedValue({ data: { path: 'post-images/test.png' }, error: null });
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    storage: {
      from: jest.fn().mockReturnValue({ upload: mockUpload }),
    },
  })),
}));

import { generatePostImage, buildImagePrompt } from '@/lib/ai/content-pipeline/image-generator';

describe('image-generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_GEMINI_API_KEY = 'test-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  });

  describe('buildImagePrompt', () => {
    it('includes post theme in prompt', () => {
      const prompt = buildImagePrompt('How to build a remote team culture', {
        default_primary_color: '#8b5cf6',
        font_family: 'Inter',
        logo_url: null,
      }, 'abstract');
      expect(prompt).toContain('remote team');
      expect(prompt).toContain('abstract');
      expect(prompt).toContain('#8b5cf6');
    });

    it('uses different instructions per style', () => {
      const abstract = buildImagePrompt('Test', {}, 'abstract');
      const photo = buildImagePrompt('Test', {}, 'photography');
      expect(abstract).toContain('geometric');
      expect(photo).toContain('photograph');
    });

    it('falls back to violet when no brand color', () => {
      const prompt = buildImagePrompt('Test', { default_primary_color: null }, 'minimal');
      expect(prompt).toContain('#8b5cf6');
    });
  });

  describe('generatePostImage', () => {
    it('calls Gemini API and uploads to storage', async () => {
      // Mock Gemini returning base64 image data
      mockGenerateImages.mockResolvedValue({
        response: {
          candidates: [{
            content: {
              parts: [{ inlineData: { data: Buffer.from('fake-png').toString('base64'), mimeType: 'image/png' } }],
            },
          }],
        },
      });

      const result = await generatePostImage(
        'post-123',
        'user-456',
        'How to scale your agency',
        { default_primary_color: '#8b5cf6', font_family: 'Inter', logo_url: null },
        'abstract'
      );

      expect(mockGenerateImages).toHaveBeenCalled();
      expect(mockUpload).toHaveBeenCalled();
      expect(result.imageUrl).toContain('post-images');
    });

    it('throws on Gemini API failure', async () => {
      mockGenerateImages.mockRejectedValue(new Error('API quota exceeded'));

      await expect(
        generatePostImage('post-123', 'user-456', 'Test', {}, 'abstract')
      ).rejects.toThrow('API quota exceeded');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/ai/content-pipeline/image-generator.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Implement image generator**

Check existing Gemini usage in the codebase first:
Run: `grep -r "generative-ai\|GoogleGenerativeAI\|gemini" src/ --include="*.ts" -l`

This will show if `@google/generative-ai` is already installed and how it's used. Follow the existing pattern.

```typescript
// src/lib/ai/content-pipeline/image-generator.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type { ImageStyle } from '@/lib/types/content-pipeline';

interface ImageBrandKit {
  default_primary_color?: string | null;
  font_family?: string | null;
  logo_url?: string | null;
}

const FALLBACK_COLOR = '#8b5cf6';

const STYLE_INSTRUCTIONS: Record<ImageStyle, string> = {
  abstract: 'Abstract geometric shapes and patterns. Clean, modern, professional. No text, no faces, no logos.',
  illustration: 'Hand-drawn illustration style. Warm, approachable, creative. No text, no faces, no logos.',
  photography: 'Clean professional photograph. Natural lighting, shallow depth of field. No text overlay, no logos.',
  minimal: 'Minimalist design with lots of whitespace. Simple shapes, clean lines. No text, no faces, no logos.',
};

export function buildImagePrompt(
  postContent: string,
  brandKit: ImageBrandKit,
  style: ImageStyle
): string {
  const theme = postContent.slice(0, 200);
  const color = brandKit.default_primary_color || FALLBACK_COLOR;
  const styleInstr = STYLE_INSTRUCTIONS[style];

  return [
    `Create a ${style} image that visually represents this topic: "${theme}"`,
    styleInstr,
    `Use ${color} as the dominant accent color.`,
    'The image should work as a LinkedIn post header image.',
    'Aspect ratio: 1:1 (square). High quality, professional.',
  ].join('\n');
}

export async function generatePostImage(
  postId: string,
  userId: string,
  postContent: string,
  brandKit: ImageBrandKit,
  style: ImageStyle = 'abstract'
): Promise<{ imageUrl: string }> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const prompt = buildImagePrompt(postContent, brandKit, style);

  const result = await model.generateContent(prompt);
  const candidate = result.response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData?.mimeType?.startsWith('image/')
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error('Gemini did not return an image');
  }

  const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
  const timestamp = Date.now();
  const path = `post-images/${userId}/${postId}/${timestamp}.png`;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from('public-assets')
    .upload(path, imageBuffer, { contentType: 'image/png', upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const imageUrl = `${supabaseUrl}/storage/v1/object/public/public-assets/${path}`;

  return { imageUrl };
}
```

**Note:** The Gemini image generation API may use a different model name or endpoint depending on what's available. Check the actual Gemini docs and existing usage in the codebase. The model might be `imagen-3.0-generate-002` or `gemini-2.0-flash-exp` with image generation capabilities. Adjust the model name and API call pattern accordingly.

**Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/ai/content-pipeline/image-generator.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/content-pipeline/image-generator.ts src/__tests__/lib/ai/content-pipeline/image-generator.test.ts
git commit -m "feat: add Gemini image generator module with brand-aware prompts"
```

---

## Task 5: Carousel Generator Module

**Files:**
- Create: `src/lib/ai/content-pipeline/carousel-generator.ts`
- Create: `src/__tests__/lib/ai/content-pipeline/carousel-generator.test.ts`

**Step 1: Write the failing tests**

```typescript
/**
 * @jest-environment node
 */

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

jest.mock('@/lib/ai/content-pipeline/slide-templates', () => ({
  buildSlideHtml: jest.fn().mockReturnValue('<html><body>slide</body></html>'),
  SLIDE_DIMENSIONS: { width: 1080, height: 1350 },
}));

const mockCaptureScreenshot = jest.fn().mockResolvedValue(Buffer.from('fake-png'));
jest.mock('@/lib/services/screenshot', () => ({
  ScreenshotService: jest.fn().mockImplementation(() => ({
    captureScreenshot: mockCaptureScreenshot,
  })),
}));

const mockUpload = jest.fn().mockResolvedValue({ data: { path: 'carousel/test.png' }, error: null });
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    storage: {
      from: jest.fn().mockReturnValue({ upload: mockUpload }),
    },
  })),
}));

jest.mock('@/lib/services/prompt-registry', () => ({
  getPrompt: jest.fn().mockResolvedValue({
    system_prompt: 'Extract slides',
    user_prompt: '',
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.3,
    max_tokens: 2048,
  }),
  interpolatePrompt: jest.fn((t: string) => t),
}));

import { extractSlides, generateCarousel } from '@/lib/ai/content-pipeline/carousel-generator';

describe('carousel-generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  });

  describe('extractSlides', () => {
    it('parses Claude response into structured slides', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify([
            { type: 'title', heading: 'Why Remote Work Wins', body: 'Tim Johnson • CEO' },
            { type: 'stat', heading: '73%', body: 'of employees prefer remote' },
            { type: 'list', heading: 'Key Benefits', body: '1. Flexibility\n2. Focus\n3. No commute' },
            { type: 'cta', heading: 'Follow for more', body: 'Daily insights on remote work' },
          ]),
        }],
      });

      const slides = await extractSlides('A long post about remote work benefits...');

      expect(slides).toHaveLength(4);
      expect(slides[0].type).toBe('title');
      expect(slides[1].type).toBe('stat');
      expect(slides[2].type).toBe('list');
      expect(slides[3].type).toBe('cta');
    });

    it('throws on invalid Claude response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'not valid json' }],
      });

      await expect(extractSlides('Test post')).rejects.toThrow();
    });
  });

  describe('generateCarousel', () => {
    it('extracts slides, renders HTML, captures screenshots, uploads', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify([
            { type: 'title', heading: 'Test', body: 'Author' },
            { type: 'cta', heading: 'Follow', body: 'For more' },
          ]),
        }],
      });

      const result = await generateCarousel(
        'post-123',
        'user-456',
        'Post content here',
        { default_primary_color: '#8b5cf6', font_family: 'Inter', logo_url: null },
        'brand'
      );

      expect(result.slides).toHaveLength(2);
      expect(result.theme).toBe('brand');
      expect(result.slides[0].image_url).toContain('carousel');
      expect(mockUpload).toHaveBeenCalledTimes(2);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/ai/content-pipeline/carousel-generator.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Implement carousel generator**

First, check how ScreenshotService is instantiated:
Run: `grep -n "ScreenshotService\|captureScreenshot" src/lib/services/screenshot.ts | head -20`

```typescript
// src/lib/ai/content-pipeline/carousel-generator.ts

import Anthropic from '@anthropic-ai/sdk';
import { buildSlideHtml, SLIDE_DIMENSIONS } from '@/lib/ai/content-pipeline/slide-templates';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';
import type { CarouselSlide, CarouselData, CarouselTheme } from '@/lib/types/content-pipeline';

interface CarouselBrandKit {
  default_primary_color?: string | null;
  font_family?: string | null;
  logo_url?: string | null;
}

const CAROUSEL_PROMPT_SLUG = 'carousel-slide-extractor';

export async function extractSlides(postContent: string): Promise<Omit<CarouselSlide, 'image_url'>[]> {
  const promptConfig = await getPrompt(CAROUSEL_PROMPT_SLUG);

  const systemPrompt = promptConfig
    ? interpolatePrompt(promptConfig.system_prompt, {})
    : [
        'Extract the key points from the LinkedIn post and structure them as carousel slides.',
        'Return a JSON array of slide objects. Each slide has: type (title|quote|stat|list|cta), heading (max 8 words), body (max 40 words).',
        'Always start with a "title" slide using the post hook as heading.',
        'Always end with a "cta" slide.',
        'Use 5-8 slides total. Pick the most impactful points.',
        'Return ONLY the JSON array, no markdown fences.',
      ].join('\n');

  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: promptConfig?.model || 'claude-haiku-4-5-20251001',
    max_tokens: promptConfig?.max_tokens || 2048,
    temperature: promptConfig?.temperature ?? 0.3,
    system: systemPrompt,
    messages: [{ role: 'user', content: postContent }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const slides = JSON.parse(cleaned);

  if (!Array.isArray(slides)) throw new Error('Expected JSON array of slides');

  return slides.map((s: Record<string, string>) => ({
    type: s.type as CarouselSlide['type'],
    heading: s.heading || '',
    body: s.body || '',
  }));
}

async function renderSlideToImage(
  slideHtml: string,
  postId: string,
  userId: string,
  slideIndex: number
): Promise<string> {
  // Use ScreenshotOne API directly (same pattern as screenshot.ts service)
  const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY;
  if (!accessKey) throw new Error('SCREENSHOTONE_ACCESS_KEY not configured');

  const params = new URLSearchParams({
    access_key: accessKey,
    html: slideHtml,
    viewport_width: String(SLIDE_DIMENSIONS.width),
    viewport_height: String(SLIDE_DIMENSIONS.height),
    format: 'png',
    image_quality: '100',
    full_page: 'false',
  });

  const response = await fetch(`https://api.screenshotone.com/take?${params.toString()}`);
  if (!response.ok) throw new Error(`ScreenshotOne error: ${response.status}`);

  const imageBuffer = Buffer.from(await response.arrayBuffer());
  const path = `carousel/${userId}/${postId}/slide-${slideIndex}-${Date.now()}.png`;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from('public-assets')
    .upload(path, imageBuffer, { contentType: 'image/png', upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/public-assets/${path}`;
}

export async function generateCarousel(
  postId: string,
  userId: string,
  postContent: string,
  brandKit: CarouselBrandKit,
  theme: CarouselTheme = 'brand'
): Promise<CarouselData> {
  const rawSlides = await extractSlides(postContent);

  const slides: CarouselSlide[] = [];
  for (let i = 0; i < rawSlides.length; i++) {
    const html = buildSlideHtml({ ...rawSlides[i], image_url: '' }, brandKit);
    const imageUrl = await renderSlideToImage(html, postId, userId, i);
    slides.push({ ...rawSlides[i], image_url: imageUrl });
  }

  return { slides, theme };
}
```

**Important:** Check if ScreenshotOne supports rendering from raw HTML or only from URLs. If HTML-only requires a URL, you may need to:
1. Use `html` param (ScreenshotOne does support `html` parameter for raw HTML rendering)
2. Or create a temporary hosted HTML page

Verify by checking ScreenshotOne API docs or the existing `screenshot.ts` usage.

**Step 4: Add the prompt default for carousel-slide-extractor**

Open `src/lib/ai/content-pipeline/prompt-defaults.ts` and add:

```typescript
{
  slug: 'carousel-slide-extractor',
  name: 'Carousel Slide Extractor',
  description: 'Extracts structured carousel slides from a LinkedIn post',
  system_prompt: `Extract the key points from the LinkedIn post and structure them as carousel slides.
Return a JSON array of slide objects. Each slide has:
- type: one of "title", "quote", "stat", "list", "cta"
- heading: max 8 words
- body: max 40 words

Rules:
- Always start with a "title" slide using the post hook as heading
- Always end with a "cta" slide
- Use 5-8 slides total
- Pick the most impactful points for content slides
- For "stat" slides, extract specific numbers/percentages
- For "list" slides, use numbered items separated by newlines
- Return ONLY the JSON array, no markdown fences or explanation`,
  user_prompt: '',
  model: 'claude-haiku-4-5-20251001',
  temperature: 0.3,
  max_tokens: 2048,
},
```

**Step 5: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/ai/content-pipeline/carousel-generator.test.ts --no-coverage`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/ai/content-pipeline/carousel-generator.ts src/__tests__/lib/ai/content-pipeline/carousel-generator.test.ts src/lib/ai/content-pipeline/prompt-defaults.ts
git commit -m "feat: add carousel generator (Claude slide extraction + ScreenshotOne rendering)"
```

---

## Task 6: Generate Image API Route

**Files:**
- Create: `src/app/api/content-pipeline/posts/[id]/generate-image/route.ts`
- Create: `src/__tests__/api/content-pipeline/generate-image.test.ts`

**Step 1: Write the failing tests**

```typescript
/**
 * @jest-environment node
 */

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  getServerSession: () => mockGetServerSession(),
}));

jest.mock('@/lib/auth/auth-options', () => ({
  authOptions: {},
}));

const mockGeneratePostImage = jest.fn();
jest.mock('@/lib/ai/content-pipeline/image-generator', () => ({
  generatePostImage: (...args: unknown[]) => mockGeneratePostImage(...args),
}));

function createChain(resolveData: unknown = []) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['select', 'update', 'eq', 'not', 'order', 'limit'];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn().mockResolvedValue({ data: resolveData, error: null });
  (chain as unknown as PromiseLike<{ data: unknown; error: null }>).then = jest.fn(
    (resolve: (value: { data: unknown; error: null }) => unknown) =>
      resolve({ data: Array.isArray(resolveData) ? resolveData : [resolveData], error: null })
  ) as jest.Mock;
  return chain;
}

const mockState = { fromFn: jest.fn(() => createChain()) };

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: (table: string) => mockState.fromFn(table),
  })),
}));

import { POST } from '@/app/api/content-pipeline/posts/[id]/generate-image/route';
import { NextRequest } from 'next/server';

function makeRequest(body: Record<string, unknown>, postId = 'post-123') {
  const req = new NextRequest(`http://localhost/api/content-pipeline/posts/${postId}/generate-image`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { req, params: Promise.resolve({ id: postId }) };
}

describe('POST /api/content-pipeline/posts/[id]/generate-image', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-123' } });
    mockState.fromFn = jest.fn(() => createChain());
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { req, params } = makeRequest({});
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
  });

  it('generates image and returns URL', async () => {
    // Post lookup
    mockState.fromFn.mockReturnValueOnce(createChain({
      id: 'post-123',
      user_id: 'user-123',
      final_content: 'Great post about growth',
      draft_content: null,
    }));
    // Brand kit lookup
    mockState.fromFn.mockReturnValueOnce(createChain({
      default_primary_color: '#8b5cf6',
      font_family: 'Inter',
      logo_url: null,
    }));
    // Update chain
    mockState.fromFn.mockReturnValueOnce(createChain());

    mockGeneratePostImage.mockResolvedValue({ imageUrl: 'https://storage.test/image.png' });

    const { req, params } = makeRequest({ style: 'abstract' });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.imageUrl).toBe('https://storage.test/image.png');
    expect(mockGeneratePostImage).toHaveBeenCalledWith(
      'post-123', 'user-123', 'Great post about growth',
      expect.objectContaining({ default_primary_color: '#8b5cf6' }),
      'abstract'
    );
  });

  it('defaults to abstract style', async () => {
    mockState.fromFn.mockReturnValueOnce(createChain({
      id: 'post-123', user_id: 'user-123', final_content: 'Test', draft_content: null,
    }));
    mockState.fromFn.mockReturnValueOnce(createChain({}));
    mockState.fromFn.mockReturnValueOnce(createChain());
    mockGeneratePostImage.mockResolvedValue({ imageUrl: 'https://storage.test/image.png' });

    const { req, params } = makeRequest({});
    await POST(req, { params });

    expect(mockGeneratePostImage).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), expect.anything(), 'abstract'
    );
  });

  it('uses draft_content when final_content is null', async () => {
    mockState.fromFn.mockReturnValueOnce(createChain({
      id: 'post-123', user_id: 'user-123', final_content: null, draft_content: 'Draft post content',
    }));
    mockState.fromFn.mockReturnValueOnce(createChain({}));
    mockState.fromFn.mockReturnValueOnce(createChain());
    mockGeneratePostImage.mockResolvedValue({ imageUrl: 'https://storage.test/image.png' });

    const { req, params } = makeRequest({});
    await POST(req, { params });

    expect(mockGeneratePostImage).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 'Draft post content', expect.anything(), expect.anything()
    );
  });

  it('returns 404 when post not found', async () => {
    const chain = createChain(null);
    chain.single = jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
    mockState.fromFn.mockReturnValueOnce(chain);

    const { req, params } = makeRequest({});
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/content-pipeline/generate-image.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Implement the route**

```typescript
// src/app/api/content-pipeline/posts/[id]/generate-image/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generatePostImage } from '@/lib/ai/content-pipeline/image-generator';
import type { ImageStyle } from '@/lib/types/content-pipeline';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: postId } = await params;
  const body = await request.json().catch(() => ({}));
  const style: ImageStyle = body.style || 'abstract';

  const supabase = createSupabaseAdminClient();

  // Fetch post
  const { data: post, error: postError } = await supabase
    .from('cp_pipeline_posts')
    .select('id, user_id, final_content, draft_content')
    .eq('id', postId)
    .eq('user_id', session.user.id)
    .single();

  if (postError || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const content = post.final_content || post.draft_content;
  if (!content) {
    return NextResponse.json({ error: 'Post has no content' }, { status: 400 });
  }

  // Fetch brand kit
  const { data: brandKit } = await supabase
    .from('brand_kits')
    .select('default_primary_color, font_family, logo_url')
    .eq('user_id', session.user.id)
    .single();

  // Update status to generating
  await supabase
    .from('cp_pipeline_posts')
    .update({ image_generation_status: 'generating' })
    .eq('id', postId);

  try {
    const { imageUrl } = await generatePostImage(
      postId,
      session.user.id,
      content,
      brandKit || {},
      style
    );

    // Update post with image URL
    await supabase
      .from('cp_pipeline_posts')
      .update({
        image_urls: [imageUrl],
        image_generation_status: 'ready',
      })
      .eq('id', postId);

    return NextResponse.json({ imageUrl });
  } catch (err) {
    await supabase
      .from('cp_pipeline_posts')
      .update({ image_generation_status: 'failed' })
      .eq('id', postId);

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Image generation failed' },
      { status: 500 }
    );
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/content-pipeline/generate-image.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/content-pipeline/posts/[id]/generate-image/route.ts src/__tests__/api/content-pipeline/generate-image.test.ts
git commit -m "feat: add POST /api/content-pipeline/posts/[id]/generate-image route"
```

---

## Task 7: Generate Carousel API Route

**Files:**
- Create: `src/app/api/content-pipeline/posts/[id]/generate-carousel/route.ts`
- Create: `src/__tests__/api/content-pipeline/generate-carousel.test.ts`

**Step 1: Write the failing tests**

Follow the exact same pattern as Task 6 tests, but mock `generateCarousel` from `carousel-generator` instead of `generatePostImage`. Test cases:

1. Returns 401 when not authenticated
2. Generates carousel and returns slides
3. Defaults to 'brand' theme
4. Uses draft_content fallback
5. Returns 404 when post not found
6. Returns 500 on generation failure

**Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/content-pipeline/generate-carousel.test.ts --no-coverage`

**Step 3: Implement the route**

Same pattern as generate-image route but calls `generateCarousel()` and stores result in `carousel_data` column.

```typescript
// src/app/api/content-pipeline/posts/[id]/generate-carousel/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateCarousel } from '@/lib/ai/content-pipeline/carousel-generator';
import type { CarouselTheme } from '@/lib/types/content-pipeline';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: postId } = await params;
  const body = await request.json().catch(() => ({}));
  const theme: CarouselTheme = body.theme || 'brand';

  const supabase = createSupabaseAdminClient();

  const { data: post, error: postError } = await supabase
    .from('cp_pipeline_posts')
    .select('id, user_id, final_content, draft_content')
    .eq('id', postId)
    .eq('user_id', session.user.id)
    .single();

  if (postError || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const content = post.final_content || post.draft_content;
  if (!content) {
    return NextResponse.json({ error: 'Post has no content' }, { status: 400 });
  }

  const { data: brandKit } = await supabase
    .from('brand_kits')
    .select('default_primary_color, font_family, logo_url')
    .eq('user_id', session.user.id)
    .single();

  await supabase
    .from('cp_pipeline_posts')
    .update({ image_generation_status: 'generating' })
    .eq('id', postId);

  try {
    const carouselData = await generateCarousel(
      postId,
      session.user.id,
      content,
      brandKit || {},
      theme
    );

    await supabase
      .from('cp_pipeline_posts')
      .update({
        carousel_data: carouselData,
        image_generation_status: 'ready',
      })
      .eq('id', postId);

    return NextResponse.json({ carousel: carouselData });
  } catch (err) {
    await supabase
      .from('cp_pipeline_posts')
      .update({ image_generation_status: 'failed' })
      .eq('id', postId);

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Carousel generation failed' },
      { status: 500 }
    );
  }
}
```

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```bash
git add src/app/api/content-pipeline/posts/[id]/generate-carousel/route.ts src/__tests__/api/content-pipeline/generate-carousel.test.ts
git commit -m "feat: add POST /api/content-pipeline/posts/[id]/generate-carousel route"
```

---

## Task 8: Update Posts API to Include Image Fields

**Files:**
- Modify: `src/app/api/content-pipeline/posts/route.ts`
- Modify: Any PATCH route for posts (find with `grep -rn "cp_pipeline_posts.*update\|PATCH" src/app/api/content-pipeline/posts/`)

**Step 1: Add image fields to GET select**

In the GET handler, add `image_urls, carousel_data, image_generation_status` to the `select()` column list.

**Step 2: Add image fields to PATCH handler**

In the PATCH handler, allow updating `image_urls` and `carousel_data` fields (for manual image uploads and slide text edits).

**Step 3: Run existing tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage --testPathPattern="content-pipeline|posts"`
Ensure no regressions.

**Step 4: Commit**

```bash
git add src/app/api/content-pipeline/posts/
git commit -m "feat: include image_urls, carousel_data in posts API GET/PATCH"
```

---

## Task 9: ImagePanel Component

**Files:**
- Create: `src/components/content-pipeline/ImagePanel.tsx`
- Create: `src/__tests__/components/content-pipeline/ImagePanel.test.tsx`

**Step 1: Write the failing tests**

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImagePanel } from '@/components/content-pipeline/ImagePanel';

// Mock fetch
global.fetch = jest.fn();

describe('ImagePanel', () => {
  const defaultProps = {
    postId: 'post-123',
    imageUrls: [] as string[],
    generationStatus: null as string | null,
    onImageGenerated: jest.fn(),
    onImageRemoved: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders generate button when no images', () => {
    render(<ImagePanel {...defaultProps} />);
    expect(screen.getByText(/generate/i)).toBeInTheDocument();
  });

  it('shows image preview when imageUrls has entries', () => {
    render(<ImagePanel {...defaultProps} imageUrls={['https://example.com/img.png']} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/img.png');
  });

  it('shows style picker on generate click', () => {
    render(<ImagePanel {...defaultProps} />);
    fireEvent.click(screen.getByText(/generate/i));
    expect(screen.getByText(/abstract/i)).toBeInTheDocument();
    expect(screen.getByText(/illustration/i)).toBeInTheDocument();
  });

  it('shows loading state during generation', () => {
    render(<ImagePanel {...defaultProps} generationStatus="generating" />);
    expect(screen.getByText(/generating/i)).toBeInTheDocument();
  });

  it('shows remove button on hover when image exists', () => {
    render(<ImagePanel {...defaultProps} imageUrls={['https://example.com/img.png']} />);
    expect(screen.getByLabelText(/remove/i)).toBeInTheDocument();
  });

  it('calls onImageRemoved when remove clicked', () => {
    render(<ImagePanel {...defaultProps} imageUrls={['https://example.com/img.png']} />);
    fireEvent.click(screen.getByLabelText(/remove/i));
    expect(defaultProps.onImageRemoved).toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

**Step 3: Implement ImagePanel**

```typescript
// src/components/content-pipeline/ImagePanel.tsx
'use client';

import React, { useState } from 'react';
import { ImagePlus, Trash2, Loader2, Upload } from 'lucide-react';
import type { ImageStyle } from '@/lib/types/content-pipeline';

interface ImagePanelProps {
  postId: string;
  imageUrls: string[];
  generationStatus: string | null;
  onImageGenerated: (imageUrl: string) => void;
  onImageRemoved: () => void;
}

const STYLES: { value: ImageStyle; label: string }[] = [
  { value: 'abstract', label: 'Abstract' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'photography', label: 'Photography' },
  { value: 'minimal', label: 'Minimal' },
];

export function ImagePanel({ postId, imageUrls, generationStatus, onImageGenerated, onImageRemoved }: ImagePanelProps) {
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [generating, setGenerating] = useState(generationStatus === 'generating');
  const hasImage = imageUrls.length > 0;

  async function handleGenerate(style: ImageStyle) {
    setGenerating(true);
    setShowStylePicker(false);
    try {
      const res = await fetch(`/api/content-pipeline/posts/${postId}/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style }),
      });
      const data = await res.json();
      if (data.imageUrl) onImageGenerated(data.imageUrl);
    } finally {
      setGenerating(false);
    }
  }

  if (generating) {
    return (
      <div className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 flex items-center justify-center gap-2 text-sm text-zinc-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Generating image...
      </div>
    );
  }

  if (hasImage) {
    return (
      <div className="relative group rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
        <img src={imageUrls[0]} alt="Post image" className="w-full h-48 object-cover" />
        <button
          onClick={onImageRemoved}
          className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remove image"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={() => setShowStylePicker(!showStylePicker)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <ImagePlus className="w-4 h-4" />
          Generate Image
        </button>
      </div>
      {showStylePicker && (
        <div className="flex gap-2 flex-wrap">
          {STYLES.map(s => (
            <button
              key={s.value}
              onClick={() => handleGenerate(s.value)}
              className="px-3 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded-full hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:border-violet-400 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```bash
git add src/components/content-pipeline/ImagePanel.tsx src/__tests__/components/content-pipeline/ImagePanel.test.tsx
git commit -m "feat: add ImagePanel component (generate, preview, remove)"
```

---

## Task 10: CarouselEditor Component

**Files:**
- Create: `src/components/content-pipeline/CarouselEditor.tsx`
- Create: `src/__tests__/components/content-pipeline/CarouselEditor.test.tsx`

**Step 1: Write the failing tests**

Test cases:
1. Renders "Generate Carousel" button when no carousel data
2. Renders slide thumbnails when carousel data exists
3. Shows slide count
4. Allows clicking a slide to edit its text
5. Shows generating state
6. Calls onGenerated callback after generation
7. Calls onRemoved when carousel removed

**Step 2: Implement CarouselEditor**

```typescript
// src/components/content-pipeline/CarouselEditor.tsx
'use client';

import React, { useState } from 'react';
import { LayoutGrid, Trash2, Loader2, RefreshCw } from 'lucide-react';
import type { CarouselData, CarouselSlide, CarouselTheme } from '@/lib/types/content-pipeline';

interface CarouselEditorProps {
  postId: string;
  carouselData: CarouselData | null;
  generationStatus: string | null;
  onGenerated: (carousel: CarouselData) => void;
  onUpdated: (carousel: CarouselData) => void;
  onRemoved: () => void;
}

export function CarouselEditor({
  postId, carouselData, generationStatus, onGenerated, onUpdated, onRemoved,
}: CarouselEditorProps) {
  const [generating, setGenerating] = useState(generationStatus === 'generating');
  const [selectedSlide, setSelectedSlide] = useState<number | null>(null);

  async function handleGenerate(theme: CarouselTheme = 'brand') {
    setGenerating(true);
    try {
      const res = await fetch(`/api/content-pipeline/posts/${postId}/generate-carousel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });
      const data = await res.json();
      if (data.carousel) onGenerated(data.carousel);
    } finally {
      setGenerating(false);
    }
  }

  function handleSlideTextChange(index: number, field: 'heading' | 'body', value: string) {
    if (!carouselData) return;
    const updated = { ...carouselData };
    updated.slides = [...updated.slides];
    updated.slides[index] = { ...updated.slides[index], [field]: value };
    onUpdated(updated);
  }

  if (generating) {
    return (
      <div className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 flex items-center justify-center gap-2 text-sm text-zinc-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Generating carousel slides...
      </div>
    );
  }

  if (!carouselData) {
    return (
      <button
        onClick={() => handleGenerate()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <LayoutGrid className="w-4 h-4" />
        Generate Carousel
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">
          {carouselData.slides.length} slides
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => handleGenerate(carouselData.theme)}
            className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
            aria-label="Regenerate carousel"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRemoved}
            className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
            aria-label="Remove carousel"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Slide thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {carouselData.slides.map((slide, i) => (
          <button
            key={i}
            onClick={() => setSelectedSlide(selectedSlide === i ? null : i)}
            className={`flex-shrink-0 w-20 h-25 rounded-lg overflow-hidden border-2 transition-colors ${
              selectedSlide === i ? 'border-violet-500' : 'border-zinc-200 dark:border-zinc-700'
            }`}
          >
            {slide.image_url ? (
              <img src={slide.image_url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                {i + 1}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Slide editor */}
      {selectedSlide !== null && carouselData.slides[selectedSlide] && (
        <div className="space-y-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
          <div className="text-xs font-medium text-zinc-500 capitalize">
            {carouselData.slides[selectedSlide].type} slide
          </div>
          <input
            type="text"
            value={carouselData.slides[selectedSlide].heading}
            onChange={(e) => handleSlideTextChange(selectedSlide, 'heading', e.target.value)}
            className="w-full text-sm px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded"
            placeholder="Heading"
          />
          <textarea
            value={carouselData.slides[selectedSlide].body}
            onChange={(e) => handleSlideTextChange(selectedSlide, 'body', e.target.value)}
            className="w-full text-sm px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded resize-none"
            rows={3}
            placeholder="Body text"
          />
        </div>
      )}
    </div>
  );
}
```

**Step 3: Run tests, commit**

```bash
git add src/components/content-pipeline/CarouselEditor.tsx src/__tests__/components/content-pipeline/CarouselEditor.test.tsx
git commit -m "feat: add CarouselEditor component (generate, edit slides, remove)"
```

---

## Task 11: Integrate into PostDetailModal

**Files:**
- Modify: `src/components/content-pipeline/PostDetailModal.tsx`

**Step 1: Read the current PostDetailModal**

Run: `cat -n src/components/content-pipeline/PostDetailModal.tsx | head -60`

Understand the import structure, state management, and layout.

**Step 2: Add imports and state**

Add imports for `ImagePanel` and `CarouselEditor`. Add state for `imageUrls`, `carouselData`, `imageGenerationStatus` initialized from `post` prop.

**Step 3: Add ImagePanel + CarouselEditor to the editor pane**

Insert below the text editor (left pane), before the engagement/automation sections. The layout should be:

```
[Text editor]
[ImagePanel]
[CarouselEditor]
[--- separator ---]
[Engagement section (for published posts)]
```

**Step 4: Wire save handler**

Update the debounced save PATCH to include `image_urls` and `carousel_data` in the update payload.

**Step 5: Wire onImageGenerated / onImageRemoved / onCarouselGenerated callbacks**

These should update local state AND trigger a save.

**Step 6: Run existing PostDetailModal tests**

Ensure no regressions from the integration.

**Step 7: Commit**

```bash
git add src/components/content-pipeline/PostDetailModal.tsx
git commit -m "feat: integrate ImagePanel + CarouselEditor into PostDetailModal"
```

---

## Task 12: Update LinkedInPreview for Images

**Files:**
- Modify: `src/components/content-pipeline/LinkedInPreview.tsx`

**Step 1: Read the current LinkedInPreview component**

Run: `cat -n src/components/content-pipeline/LinkedInPreview.tsx | head -40`

**Step 2: Add image/carousel preview**

Add props for `imageUrls` and `carouselData`. Render:
- Single image: full-width image below post text
- Carousel: horizontal scroll with slide thumbnails + slide count dots
- No image: current behavior (text only)

**Step 3: Update PostDetailModal to pass image props to LinkedInPreview**

**Step 4: Run tests, commit**

```bash
git add src/components/content-pipeline/LinkedInPreview.tsx src/components/content-pipeline/PostDetailModal.tsx
git commit -m "feat: add image/carousel preview to LinkedInPreview"
```

---

## Task 13: Wire Unipile Media Publishing

**Files:**
- Modify: `src/lib/integrations/unipile.ts`
- Modify: `src/lib/integrations/linkedin-publisher.ts`
- Create: `src/__tests__/lib/integrations/unipile-media.test.ts`

**Step 1: Read Unipile API docs for media posts**

Check Unipile API docs (see `unipile-api.md` in memory files) for `POST /api/v1/posts` with media support. The endpoint likely accepts a `media` array with `{ type: 'IMAGE', url: string }` entries.

**Step 2: Write failing tests**

Test that `createPost` accepts optional `mediaUrls` parameter and includes them in the API payload.

**Step 3: Update Unipile client**

```typescript
// In unipile.ts, update createPost signature:
async createPost(accountId: string, text: string, mediaUrls?: string[]): Promise<ApiResponse<UnipilePost>> {
  const payload: Record<string, unknown> = { account_id: accountId, text };
  if (mediaUrls?.length) {
    payload.media = mediaUrls.map(url => ({ type: 'IMAGE', url }));
  }
  return this.post<UnipilePost>('/posts', payload);
}
```

**Step 4: Update LinkedIn publisher**

Update `publishNow` in `linkedin-publisher.ts` to accept optional `mediaUrls` and pass through to `createPost`.

**Step 5: Update publish endpoint**

In the publish route (find with `grep -rn "publish" src/app/api/content-pipeline/posts/`), read `image_urls` and `carousel_data` from the post and pass appropriate media URLs to the publisher:
- Single image: `image_urls[0]` → `mediaUrls: [image_urls[0]]`
- Carousel: `carousel_data.slides.map(s => s.image_url)` → `mediaUrls: slideImageUrls`

**Step 6: Run tests, commit**

```bash
git add src/lib/integrations/unipile.ts src/lib/integrations/linkedin-publisher.ts src/__tests__/lib/integrations/unipile-media.test.ts
git commit -m "feat: wire Unipile media publishing for images + carousels"
```

---

## Task 14: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

Add a new section documenting the Visual Engine:

**Visual Engine (Phase 4 — Feb 2026)**

Include:
- Architecture diagram
- Key files table
- Data model (new columns + new table)
- API routes (generate-image, generate-carousel)
- Components (ImagePanel, CarouselEditor)
- Prompt slugs (carousel-slide-extractor)
- Env vars (none new — uses existing GOOGLE_GEMINI_API_KEY, SCREENSHOTONE_ACCESS_KEY)

**Commit:**

```bash
git add CLAUDE.md
git commit -m "docs: add Visual Engine section to CLAUDE.md"
```

---

## Task 15: Smoke Test + Deployment

**Step 1: Run all tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run test -- --no-coverage`
Expected: All tests pass (existing + new)

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors (fix any before deploying)

**Step 4: Push migration to Supabase**

Run migration SQL via Supabase Management API (see MEMORY.md pattern).

**Step 5: Deploy to Vercel**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && vercel --prod`

**Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: address lint/type errors from Visual Engine integration"
```
