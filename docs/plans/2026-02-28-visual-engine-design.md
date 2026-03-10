# Visual Engine Design

## Goal

Add AI image generation, branded carousel creation, and image publishing to magnetlab's content pipeline — enabling users to attach on-brand visuals to LinkedIn posts and publish multi-image carousel posts.

## Architecture

```
Post Editor (PostDetailModal)
  ├── ImagePanel → "Generate Image" button
  │     → POST /api/content-pipeline/posts/[id]/generate-image
  │     → Gemini Imagen 3 (brand-prompted) → Supabase Storage → image_urls[]
  │
  ├── CarouselEditor → "Generate Carousel" button
  │     → POST /api/content-pipeline/posts/[id]/generate-carousel
  │     → Claude extracts slides → HTML templates + brand kit
  │     → ScreenshotOne renders each slide (1080x1350px)
  │     → Supabase Storage → carousel_data.slides[]
  │
  └── LinkedInPreview → shows image/carousel preview
        → publishToLinkedIn() → Unipile POST /posts with media[]
```

## Tech Stack

- **AI Image Gen**: Google Gemini Imagen 3 (already have `GOOGLE_GEMINI_API_KEY`)
- **Carousel Rendering**: ScreenshotOne (already integrated for thumbnails)
- **Storage**: Supabase Storage `public-assets` bucket (existing)
- **Slide AI**: Claude Haiku (extract post → structured slides)
- **Publishing**: Unipile `POST /api/v1/posts` with media array (existing but unwired)

## Section 1: Data Model

### New columns on `cp_pipeline_posts`

```sql
ALTER TABLE cp_pipeline_posts
  ADD COLUMN image_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN carousel_data JSONB,
  ADD COLUMN image_generation_status TEXT;

COMMENT ON COLUMN cp_pipeline_posts.image_urls IS 'Array of image URLs for single/multi-image posts';
COMMENT ON COLUMN cp_pipeline_posts.carousel_data IS '{slides: [{type, heading, body, image_url}], theme}';
COMMENT ON COLUMN cp_pipeline_posts.image_generation_status IS 'null | generating | ready | failed';
```

### New table: `cp_image_templates`

```sql
CREATE TABLE cp_image_templates (
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
```

### carousel_data shape

```typescript
interface CarouselData {
  slides: CarouselSlide[];
  theme: 'brand' | 'dark' | 'light';
}

interface CarouselSlide {
  type: 'title' | 'quote' | 'stat' | 'list' | 'cta';
  heading: string;
  body: string;
  image_url: string;       // rendered slide image
  source_image_url?: string; // optional AI-generated background
}
```

## Section 2: AI Image Generation

### Module: `src/lib/ai/content-pipeline/image-generator.ts`

```typescript
export async function generatePostImage(
  postContent: string,
  brandKit: BrandKit,
  style: 'abstract' | 'illustration' | 'photography' | 'minimal' = 'abstract'
): Promise<{ imageUrl: string }>
```

**Prompt construction:**
1. Extract key theme/topic from post content (first 200 chars)
2. Inject brand context: primary color, background style, font family, visual tone
3. Style modifier: abstract geometric shapes / hand-drawn illustration / clean photo / minimal with text
4. Negative prompt: no text overlays, no logos, no faces (unless photography style)

**Flow:**
1. Call Gemini API `generateImages` endpoint
2. Receive base64 image data
3. Upload to Supabase Storage `public-assets/post-images/{userId}/{postId}/{timestamp}.png`
4. Return public URL

### API Route: `POST /api/content-pipeline/posts/[id]/generate-image`

```typescript
// Body: { style?: 'abstract' | 'illustration' | 'photography' | 'minimal' }
// Response: { imageUrl: string }
// Side effect: updates cp_pipeline_posts.image_urls, image_generation_status
```

## Section 3: Carousel Generator

### Module: `src/lib/ai/content-pipeline/carousel-generator.ts`

```typescript
export async function generateCarouselSlides(
  postContent: string,
  brandKit: BrandKit,
  slideCount?: number  // default 5-8
): Promise<CarouselSlide[]>

export function buildSlideHtml(
  slide: CarouselSlide,
  brandKit: BrandKit
): string
```

**AI slide extraction (Claude Haiku):**
1. Send post content to Claude with structured output
2. Get back 5-8 slides: title slide, 3-5 content slides, CTA slide
3. Each slide has: type, heading (max 8 words), body (max 30 words)

**5 slide types with HTML templates:**

| Type | Layout | Content |
|------|--------|---------|
| `title` | Large heading centered, author name + avatar | Post hook/title |
| `quote` | Large quote marks, centered text | Key insight from post |
| `stat` | Big number + context line | Statistic or data point |
| `list` | Numbered/bulleted items | Key takeaways |
| `cta` | Heading + call to action + profile link | Follow/connect CTA |

**Rendering pipeline:**
1. Claude extracts slides from post
2. For each slide: `buildSlideHtml()` → branded HTML (1080x1350px viewport)
3. ScreenshotOne API renders HTML → PNG
4. Upload to Supabase Storage
5. Store URLs in `carousel_data.slides`

**Brand application:**
- Background: brand primary color or gradient
- Text: contrasting white/dark based on background
- Font: brand `font_family` (loaded via Google Fonts URL in HTML)
- Logo: brand `logo_url` in corner of each slide
- Accent: brand secondary color for highlights

### API Route: `POST /api/content-pipeline/posts/[id]/generate-carousel`

```typescript
// Body: { theme?: 'brand' | 'dark' | 'light', slideCount?: number }
// Response: { carousel: CarouselData }
// Side effect: updates cp_pipeline_posts.carousel_data, image_generation_status
```

## Section 4: Editor UI

### ImagePanel component

Location: inside PostDetailModal, below the post content editor.

```
┌─────────────────────────────────┐
│ [Post content editor]           │
├─────────────────────────────────┤
│ Image                           │
│ ┌──────────┐  ┌──────────────┐  │
│ │ [preview] │  │ Generate AI  │  │
│ │           │  │ Upload       │  │
│ │           │  │ Remove       │  │
│ └──────────┘  │              │  │
│               │ Style: ○ Abstract │
│               │        ○ Illustration │
│               │        ○ Photography │
│               │        ○ Minimal │
│               └──────────────┘  │
├─────────────────────────────────┤
│ Carousel                        │
│ ┌────┐┌────┐┌────┐┌────┐┌────┐ │
│ │ 1  ││ 2  ││ 3  ││ 4  ││ 5  │ │
│ └────┘└────┘└────┘└────┘└────┘ │
│ [Generate Carousel] [Add Slide] │
└─────────────────────────────────┘
```

**Features:**
- Generate AI image with style picker
- Upload custom image (drag & drop)
- Remove image
- Generate carousel from post content
- Reorder slides (drag & drop)
- Edit individual slide text
- Regenerate single slide
- Delete slide

### LinkedInPreview updates

- Show first image below post text (single image mode)
- Show carousel indicator (slide dots + swipe hint) for carousels
- Image count badge

## Section 5: Publishing

### Unipile integration

Current state: `publishToLinkedIn()` in `src/lib/integrations/unipile.ts` creates text-only posts.

Updates needed:
1. If `image_urls` has 1 entry → single image post (Unipile `media` field)
2. If `carousel_data` has slides → multi-image post (Unipile `media` array with all slide images)
3. Upload images to Unipile before publishing (may need base64 or URL reference)

### Unipile API for image posts

```
POST /api/v1/posts
{
  account_id: "...",
  text: "post content",
  media: [
    { type: "IMAGE", url: "https://..." }  // or base64
  ]
}
```

For carousels: `media` array with multiple IMAGE entries. LinkedIn displays these as a swipeable carousel.

## File Summary

| File | Purpose |
|------|---------|
| `src/lib/ai/content-pipeline/image-generator.ts` | Gemini Imagen 3 image generation |
| `src/lib/ai/content-pipeline/carousel-generator.ts` | Claude slide extraction + ScreenshotOne rendering |
| `src/lib/ai/content-pipeline/slide-templates.ts` | HTML/CSS templates for 5 slide types |
| `src/components/content-pipeline/ImagePanel.tsx` | Image generate/upload UI |
| `src/components/content-pipeline/CarouselEditor.tsx` | Carousel slide editor |
| `src/components/content-pipeline/ImageStylePicker.tsx` | Style selector radio group |
| `src/app/api/content-pipeline/posts/[id]/generate-image/route.ts` | Image generation API |
| `src/app/api/content-pipeline/posts/[id]/generate-carousel/route.ts` | Carousel generation API |
| `supabase/migrations/XXXXXXXX_visual_engine.sql` | DB migration |

## Env Vars

No new env vars needed:
- `GOOGLE_GEMINI_API_KEY` — already set (used by enrichment recipes)
- `SCREENSHOTONE_API_KEY` — already set (used by thumbnail generation)
- Supabase Storage — already configured

## Constraints

- LinkedIn carousel max: 20 images (we'll cap at 10)
- LinkedIn image max size: 10MB per image
- Slide dimensions: 1080x1350px (4:5 ratio, optimal for LinkedIn)
- Gemini Imagen 3 output: 1024x1024 default (upscale if needed)
- ScreenshotOne: HTML viewport 1080x1350, device scale 2x for quality
