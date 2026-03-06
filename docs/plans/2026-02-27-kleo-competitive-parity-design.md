# Magnetlab → Market Leader: Comprehensive Feature Roadmap

**Date:** 2026-02-27
**Context:** Competitive analysis against Kleo.so (market leader in LinkedIn content creation)
**Goal:** Close critical gaps, leverage our moats, and build features that leapfrog Kleo

---

## Executive Summary

Magnetlab has a significantly deeper backend (knowledge base, transcript pipeline, lead gen, analytics) but Kleo wins on **editor UX, AI interactivity, and content capture**. This plan closes those gaps while building differentiated features Kleo cannot replicate.

**Our moats to leverage:**
- 8-type semantic knowledge base with pgvector
- Transcript → content pipeline (Grain/Fireflies/Fathom)
- Lead generation integration (content → pipeline → delivery)
- Post engagement analytics + performance feedback loop
- Template intelligence (embedding-based matching)
- Autopilot scheduling

---

## Phase 1: LinkedIn Studio Editor (Weeks 1-3)

**Priority: HIGHEST — Users see this every session**

### 1.1 Pixel-Perfect LinkedIn Preview

Build a LinkedIn post preview component that exactly matches LinkedIn's rendering:

- **Avatar + name + headline + "Just now" timestamp**
  - Pull from user's profile (or brand kit)
  - Match LinkedIn's exact font (system font stack), spacing, colors

- **"...see more" truncation**
  - LinkedIn truncates at ~210 characters on desktop, ~150 on mobile
  - Truncation happens at line 3 on desktop, line 2 on mobile (depends on line length)
  - Must calculate actual truncation point based on content + line breaks
  - Show "...see more" link exactly where LinkedIn shows it

- **Device toggle: Desktop / Mobile / Tablet**
  - Desktop: ~540px content width
  - Mobile: ~340px content width
  - Tablet: ~440px content width
  - Each shows different truncation behavior

- **Engagement bar** (like, comment, repost, send icons — static, for realism)

- **Image attachment preview** (if post has image, show it in LinkedIn's aspect ratio)

**Tech approach:**
- New component: `LinkedInPreview.tsx` in `/src/components/content-pipeline/`
- CSS-only rendering (no canvas/image generation) for real-time updates
- LinkedIn's actual CSS values (font-size: 14px body, 16px hook, color: #000000E6, etc.)
- Side-by-side with editor (editor left, preview right — like Kleo's layout)

### 1.2 Hook Only Mode

- Toggle in editor toolbar: "Hook Only"
- When enabled, editor dims everything after the truncation point
- Visual indicator showing exactly where LinkedIn cuts off
- **Hook Score** (our differentiation): AI rates the hook 1-10 with:
  - Curiosity gap assessment
  - First-line power words
  - Pattern interrupt detection
  - Comparison to user's best-performing hooks (from analytics)
  - Specific suggestions: "Add a number" / "Start with 'I'" / "Create tension"

### 1.3 A/B Hook Variants

- "Generate 3 hooks" button in Hook Only mode
- AI generates 3 alternative hooks for the same post body
- Each displayed in LinkedIn preview format
- User picks the winner or edits further
- **Our edge:** Hook variants are scored using engagement data from user's past posts

### 1.4 Enhanced Editor Toolbar

Match Kleo's formatting options:
- Bold, italic, **strikethrough** (add)
- Ordered/unordered lists
- Blockquote (add)
- Emoji picker (add)
- Mentions (add — @-mention LinkedIn users)
- Hashtag suggestions (add — AI-suggested based on post content)
- **Line spacing control** (add)
- Character counter with truncation point indicator
- Real-time word/character count

### 1.5 Image Attachment in Editor

- Upload image directly in editor
- Preview image in LinkedIn format (with correct aspect ratio)
- Image suggestions panel (already have AI image suggestions — surface them)
- Quick-generate graphic from post content (ties to Phase 4)

---

## Phase 2: AI Chat Co-pilot (Weeks 3-5)

**Priority: HIGH — This is the engagement driver that makes the product sticky**

### 2.1 Chat Interface

- Split-pane layout: Chat left, Preview right (or togglable)
- Persistent chat per post (conversation history saved)
- Also available as standalone "brainstorm" mode (not tied to a specific post)
- Message types: text, image upload, voice input, file upload

**Chat capabilities:**
- "Write me a post about [topic]"
- "Make this shorter / punchier / more personal"
- "Add a story from my [knowledge topic]"
- "What performed well last week?"
- "Give me 5 post ideas for this week"
- "Remix this swipe file post in my voice"

### 2.2 Knowledge-Powered Chat (Our Killer Differentiator)

This is where we blow past Kleo. Their chat is generic Claude. Ours has context:

- **Knowledge base integration:** Chat can query pgvector knowledge base
  - "Write a post about pricing objections" → pulls actual objection entries from user's transcripts
  - "What did I say about onboarding in my last call?" → semantic search over knowledge entries

- **Performance data integration:**
  - "Write a post like my best one from January" → queries cp_post_performance
  - "What topics get the most engagement?" → queries engagement analytics
  - "My hook for this post isn't working — suggest alternatives based on what's worked before"

- **Transcript integration:**
  - "Turn my last call into 3 post ideas" → processes latest transcript
  - "I said something great about X in my coaching call — find it"

### 2.3 Voice Input

- Deepgram integration for speech-to-text
- "Talk out your post idea" → transcribe → AI refines into draft
- Works in chat messages and direct-to-editor
- Mobile-friendly (voice is the killer mobile input)

### 2.4 Web Research

- Perplexity or Tavily integration
- "What's trending in B2B SaaS this week?" → real-time research → post ideas
- "Find statistics about LinkedIn engagement rates" → data for posts
- Auto-cite sources

### 2.5 Automatic Memories

- Chat interactions update user's content preferences
- "Never use the word 'leverage'" → saved as banned_phrase in voice profile
- "I prefer posts under 200 words" → saved as content_length preference
- "Always end with a question" → saved as cta_style preference
- Memories displayed in a sidebar, editable/deletable

---

## Phase 3: Chrome Extension — "Content Radar" (Weeks 5-7)

**Priority: HIGH — Passive content capture creates daily habit**

### 3.1 Basic Clipper

- Chrome extension for saving content from any webpage
- One-click save to swipe file
- Auto-detect post content on LinkedIn, Twitter/X, blogs
- Add tags and notes on save
- Syncs to Magnetlab swipe file in real-time

### 3.2 Smart Analysis (Our Differentiator)

When you clip content, AI automatically:
- Identifies the **post structure** (hook type, body pattern, CTA style)
- Tags with relevant **topics from your taxonomy**
- Scores **relevance to your content pillars**
- Suggests **how you could adapt this** for your audience
- Extracts the **template pattern** (can save as reusable template)

### 3.3 "Remix in My Voice" Button

- One-click on any clipped post: "Write my version"
- Opens Magnetlab with AI chat pre-loaded with the clipped content
- AI generates a version in the user's voice using their knowledge base
- Not plagiarism — uses the *structure* and *topic*, but rewrites with user's actual expertise

### 3.4 Content Feed Tracking

- Optional: track what content you engage with (like/comment on LinkedIn)
- Surface patterns: "You've engaged with 12 posts about AI this week — should we write about AI?"
- Privacy-first: all analysis happens locally, only clipped items sent to server

---

## Phase 4: Visual Engine — Image & Carousel Generation (Weeks 7-9)

**Priority: MEDIUM-HIGH — 2x engagement lift from images**

### 4.1 AI Image Generation

- Generate post images from content
- Integration options: DALL-E 3, Ideogram, or Flux (evaluate quality + cost)
- Brand kit applied automatically (colors, fonts, logo watermark)
- Styles: "minimalist," "bold graphic," "photo overlay," "data visualization"

### 4.2 Template-Based Graphics

Pre-built visual templates that auto-populate from post content:
- **Before/After comparison** — two columns with contrasting data
- **3-Step Framework** — numbered steps with icons
- **Stat Highlight** — big number with context
- **Quote Card** — pull quote from post with attribution
- **List Graphic** — key points as visual checklist
- **Timeline** — chronological story visualization

### 4.3 LinkedIn Carousel Generator

**This is a major Kleo gap — they can't create carousels.**

- Turn any post into a swipeable PDF carousel
- Auto-split content into slides
- Brand kit styling applied
- Export as PDF (LinkedIn carousel format)
- Templates: "Listicle," "Story," "How-To," "Framework"

### 4.4 In-App Graphic Editor

- Basic editor for tweaking generated graphics
- Text editing, color changes, element repositioning
- Not a full Canva — just enough to customize AI output
- Tech: Canvas-based editor (Fabric.js or Konva.js)

---

## Phase 5: Daily Engagement Loop — "Content Intelligence" (Weeks 9-11)

**Priority: MEDIUM — Drives daily opens and retention**

### 5.1 Daily Brief

When user opens the app:
- Yesterday's post performance (if published)
- 3 follow-up ideas based on engagement/comments
- Trending topics in their niche
- 1 curated inspiration post (daily drop)
- Today's scheduled content summary

### 5.2 Curated Swipe Drops

- Daily curated high-performing posts from tracked creators
- Countdown timer to next drop (gamification)
- Categorized by post type, industry, engagement level
- "Use as inspiration" → opens in chat or remix flow

### 5.3 Weekly Content Intelligence Report

Automated weekly email/in-app report:
- Top performing post of the week (with analysis of why it worked)
- Content type breakdown (which formats work best)
- Engagement trends (up/down/flat)
- Knowledge gaps identified (topics you haven't posted about)
- Next week's recommended posting plan (leveraging week-planner AI)

### 5.4 Creator Alerts

- Real-time notifications when tracked creators post
- AI summary of their post + how it relates to your content
- "Riff on this" button to write a response/perspective post

---

## Phase 6: Identity Wizard — "Brand Builder" (Weeks 11-12)

**Priority: MEDIUM — Improves onboarding and reduces time-to-value**

### 6.1 Guided Onboarding Wizard

Step-by-step questionnaire (match Kleo's "Update via questions"):
1. "What do you do?" → professional background
2. "Who do you help?" → target audience
3. "What makes you different?" → unique value prop
4. "What's your story?" → personal narrative
5. "How do you sound?" → tone/voice selection (with examples)
6. "Show me your best posts" → paste 3-5 top posts for style extraction

### 6.2 Auto-Import

- **From LinkedIn profile**: One-click import headline, about section, experience
- **From website URL**: Scrape and extract positioning/messaging
- **From existing posts**: Analyze top 10-20 posts to build voice profile
- **From transcripts**: Extract speaking patterns and storytelling style

### 6.3 Brand Consistency Score

Before publishing any post:
- Score against defined identity (voice, tone, banned phrases, etc.)
- Flag inconsistencies: "This post uses 'game-changer' which is in your banned phrases"
- Suggest alternatives that match brand voice
- Track consistency over time

---

## Phase 7: Platform & Infrastructure (Ongoing)

### 7.1 Multi-Platform Publishing

- Twitter/X via Unipile (already supported by SDK)
- Cross-post adaptation (LinkedIn → Twitter length/format adjustment)
- Platform-specific preview for each network

### 7.2 Advanced Analytics Dashboard

- Post-level metrics (views, likes, comments, shares, CTR)
- Content type analysis (which formats perform best)
- Audience growth tracking
- Best posting times (data-driven, not guesswork)
- Comparison to industry benchmarks
- Export reports

### 7.3 Smart Inbox (Comment Management)

- View all LinkedIn comments in one place
- AI-suggested replies
- Priority sorting (ICP commenters first)
- "This commenter is in your CRM" integration

---

## Implementation Priority Matrix

| Phase | Feature | Impact | Effort | Priority |
|---|---|---|---|---|
| 1 | LinkedIn Preview | Very High | Medium | **P0 — Start immediately** |
| 1 | Hook Only Mode | Very High | Low | **P0** |
| 1 | Enhanced Toolbar | High | Low | **P0** |
| 1 | Hook Scoring | High | Medium | **P0** |
| 1 | A/B Hook Variants | High | Medium | **P1** |
| 2 | Chat Interface | Very High | High | **P1** |
| 2 | Knowledge-Powered Chat | Very High | Medium | **P1** |
| 2 | Voice Input | Medium | Medium | **P2** |
| 2 | Web Research | Medium | Medium | **P2** |
| 2 | Automatic Memories | High | Medium | **P1** |
| 3 | Chrome Extension (basic) | High | High | **P1** |
| 3 | Smart Analysis | Medium | Medium | **P2** |
| 3 | Remix in My Voice | High | Low | **P2** |
| 4 | AI Image Generation | High | Medium | **P1** |
| 4 | Carousel Generator | Very High | High | **P1** |
| 4 | Template Graphics | High | Medium | **P2** |
| 4 | Graphic Editor | Medium | High | **P3** |
| 5 | Daily Brief | High | Medium | **P2** |
| 5 | Curated Drops | Medium | Low | **P2** |
| 5 | Weekly Report | Medium | Medium | **P3** |
| 6 | Identity Wizard | Medium | Medium | **P2** |
| 6 | Auto-Import | Medium | Low | **P2** |
| 6 | Consistency Score | Medium | Medium | **P3** |
| 7 | Multi-Platform | Medium | High | **P3** |
| 7 | Analytics Dashboard | High | High | **P2** |
| 7 | Smart Inbox | Medium | High | **P3** |

---

## Competitive Advantages After Full Implementation

1. **Knowledge-grounded content** — Every post draws from user's actual expertise (transcripts, knowledge base), not generic AI output
2. **Transcript → Content pipeline** — Kleo literally cannot do this
3. **Content → Lead pipeline** — Posts connect to enrichment, delivery, CRM
4. **Engagement feedback loop** — Analytics feed back into AI (hook scoring, topic selection, performance prediction)
5. **Carousel creation** — Major gap in Kleo's offering
6. **Autopilot scheduling** — More automated than Kleo's manual drag-and-drop
7. **Template intelligence** — Semantic matching > browse-and-pick
8. **Multi-account team content** — Kleo's is "coming soon"

---

## Phase 1 Detailed Spec (Ready to Build)

### Files to Create/Modify

**New Components:**
- `src/components/content-pipeline/LinkedInPreview.tsx` — Pixel-perfect LinkedIn post preview
- `src/components/content-pipeline/LinkedInPreviewFrame.tsx` — Chrome/frame (avatar, name, timestamp, engagement bar)
- `src/components/content-pipeline/HookOnlyMode.tsx` — Hook isolation + scoring
- `src/components/content-pipeline/HookScorer.tsx` — AI hook rating component
- `src/components/content-pipeline/HookVariants.tsx` — A/B hook generation UI
- `src/components/content-pipeline/DeviceToggle.tsx` — Desktop/Mobile/Tablet toggle

**Modified Components:**
- `src/components/content-pipeline/PostDetailModal.tsx` — Integrate LinkedIn preview, add Hook Only toggle, add device toggle
- `src/components/content/inline-editor/TipTapTextBlock.tsx` — Add strikethrough, blockquote, emoji picker, hashtag suggestions, line spacing
- `src/components/content-pipeline/KanbanCard.tsx` — Show mini LinkedIn preview on hover

**New API Routes:**
- `POST /api/content-pipeline/posts/[id]/hook-score` — AI hook scoring
- `POST /api/content-pipeline/posts/[id]/hook-variants` — Generate alternative hooks

**New AI Module:**
- `src/lib/ai/content-pipeline/hook-scorer.ts` — Hook analysis and scoring
- `src/lib/ai/content-pipeline/hook-generator.ts` — Alternative hook generation

---

## Success Metrics

| Metric | Current | Target (90 days) |
|---|---|---|
| Daily active users | TBD | +40% |
| Posts created per user/week | TBD | +60% |
| Time in editor per session | TBD | +30% |
| Posts published per user/month | TBD | +50% |
| User retention (30-day) | TBD | +25% |
| NPS score | TBD | 50+ |
