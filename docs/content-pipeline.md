<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

### Content Pipeline Tables (cp_ prefix)

- `cp_call_transcripts` -- raw transcripts from Grain, Fireflies, Fathom, or paste (source: `'grain' | 'fireflies' | 'fathom' | 'paste'`). All three notetaker integrations are webhook-based (Fathom migrated from OAuth polling to per-user webhook auth in Feb 2026).
- `cp_knowledge_entries` -- extracted insights/questions/intel with vector embeddings + knowledge_type, quality_score, topics, specificity, actionability, source_date
- `cp_knowledge_tags` -- tag usage tracking per user
- `cp_knowledge_topics` -- auto-discovered topic taxonomy per user (slug, display_name, description, entry_count, avg_quality)
- `cp_knowledge_corroborations` -- links between entries that corroborate each other (entry_id, corroborated_by, unique constraint)
- `cp_content_ideas` -- post-worthy ideas extracted from transcripts
- `cp_pipeline_posts` -- posts in the autopilot pipeline (draft → review → schedule → publish)
- `cp_posting_slots` -- user's publishing schedule (time slots per day)
- `cp_post_templates` -- reusable post templates with embeddings
- `cp_writing_styles` -- user style profiles

RPCs: `cp_match_knowledge_entries()` (pgvector cosine similarity), `cp_match_knowledge_entries_v2()` (v2 with type/topic/quality/since filters), `cp_decrement_buffer_positions()` (buffer reordering), `cp_update_topic_stats()` (recalculate topic entry_count + avg_quality)

### Content Pipeline API Routes

- `api/webhooks/grain/` -- Grain transcript webhook
- `api/webhooks/fireflies/` -- Fireflies transcript webhook
- `api/webhooks/fathom/[userId]/` -- Fathom transcript webhook (per-user secret auth)
- `api/integrations/fathom/webhook-url/` -- Fathom webhook URL generation (GET/POST/DELETE)
- `api/content-pipeline/transcripts/` -- paste/upload + list transcripts
- `api/content-pipeline/knowledge/` -- search/browse AI Brain knowledge base (supports V2 filters: type, topic, min_quality, since)
- `api/content-pipeline/knowledge/topics/` -- list auto-discovered topics
- `api/content-pipeline/knowledge/topics/[slug]/` -- topic detail with entries
- `api/content-pipeline/knowledge/gaps/` -- gap analysis + readiness assessment
- `api/content-pipeline/knowledge/recent/` -- recent knowledge digest (last N days)
- `api/content-pipeline/knowledge/ask/` -- AI Q&A over knowledge base
- `api/content-pipeline/knowledge/readiness/` -- content readiness assessment (topic + goal)
- `api/content-pipeline/knowledge/export/` -- export knowledge by topic (structured or markdown)
- `api/content-pipeline/ideas/` -- list, update, delete ideas; write post from idea
- `api/content-pipeline/posts/` -- CRUD + polish posts
- `api/content-pipeline/schedule/slots/` -- posting slots CRUD
- `api/content-pipeline/schedule/autopilot/` -- trigger autopilot + status
- `api/content-pipeline/schedule/buffer/` -- approve/reject buffer posts

### Knowledge Data Lake

Extends the AI Brain from 3 basic categories to a rich taxonomy with quality scoring, topic auto-discovery, gap analysis, readiness assessment, topic summaries, and a full Knowledge Dashboard UI.

#### Knowledge Types (8 types)

`how_to`, `insight`, `story`, `question`, `objection`, `mistake`, `decision`, `market_intel`

Each knowledge entry also has: `quality_score` (1-5), `specificity` (boolean), `actionability` (immediately_actionable / contextual / theoretical), `topics` (array of topic slugs), `source_date`.

#### Topic Auto-Discovery

AI normalizes free-form topic suggestions into a canonical taxonomy per user. Topics stored in `cp_knowledge_topics` with auto-computed stats (entry_count, avg_quality, summary, summary_generated_at).

#### Topic Summaries (v2)

On-demand AI-generated summaries cached in `cp_knowledge_topics.summary`. Stale detection: regenerate when `last_seen > summary_generated_at`. API: `POST /api/content-pipeline/knowledge/topics/[slug]/summary?force=true`. AI module: `topic-summarizer.ts` (Claude Haiku, 200-400 word briefings organized by theme).

#### Knowledge Dashboard (v2)

Replaced `KnowledgeBrainTab` with `KnowledgeDashboard` containing 4 subtabs:

| Subtab | Component | Content |
|--------|-----------|---------|
| **Overview** | `KnowledgeOverview` | Stats cards (entries, topics, new topics, highlights), most active topics, high-quality highlights |
| **Topics** | `TopicBrowser` + `TopicDetail` | Card grid with quality stars + type breakdown. Detail view with summary generation, type bar, entries by type |
| **Gaps** | `GapAnalysis` | Coverage bars, missing types, gap patterns. Readiness assessment panel (pick topic + goal) |
| **Search** | `KnowledgeSearch` | Enhanced search with V2 filters: knowledge type, topic, min quality, since date. Plus existing tag/category/speaker filters |

Team/Personal toggle in header when user belongs to a team. `teamId` flows to all child components.

#### Briefing Agent V2 (v2)

`buildContentBrief()` uses `searchKnowledgeV2()` with quality-aware retrieval. Groups context by 8 knowledge types with labels. Quality sorting (highest first), `[HIGH QUALITY]` tags for entries >= 4. Computes `topicReadiness` heuristic and `topKnowledgeTypes`. Backward-compatible `relevantInsights/Questions/ProductIntel` fields retained.

#### Team Knowledge Sharing (v2)

All knowledge API routes accept `team_id` query param. `searchKnowledgeV2()` uses `cp_match_team_knowledge_entries` RPC for team-wide semantic search with client-side V2 filters. `listKnowledgeTopics()` queries by team_id when provided.

#### Data Flow

```
Transcript → process-transcript task
  → classifyTranscript() → transcript_type
  → extractKnowledge() → entries with knowledge_type, quality_score, topics, specificity, actionability
  → normalizeTopics() → canonical topic slugs
  → upsertTopics() → cp_knowledge_topics
  → generateEmbedding() → pgvector embeddings
  → checkForDuplicate() → insert/supersede/corroborate
  → insert cp_knowledge_entries
  → extractIdeas() → cp_content_ideas
```

#### Gap Analysis + Readiness

- `analyzeTopicGaps()` identifies coverage gaps across knowledge types per topic
- `assessContentReadiness()` scores how ready the knowledge base is for content generation
- Both exposed via `GET /api/content-pipeline/knowledge/gaps` and `GET /api/content-pipeline/knowledge/readiness`

#### Deduplication

- `checkForDuplicate()` uses `cp_match_knowledge_entries` RPC (cosine similarity > 0.90 = supersede/corroborate, 0.85-0.90 = insert)
- `supersedeEntry()` marks old entry with `superseded_by` pointer
- `recordCorroboration()` links entries in `cp_knowledge_corroborations`
- Weekly consolidation via `consolidate-knowledge` Trigger.dev task (Sundays 3 AM UTC)

#### Backfill

- `backfill-knowledge-types` Trigger.dev task — classifies existing entries without knowledge_type using Claude Haiku
- Processes in batches of 10, normalizes topics, updates quality scores

#### Key Files

- `src/lib/ai/content-pipeline/topic-summarizer.ts` — AI topic summary generation (Claude Haiku)
- `src/lib/ai/content-pipeline/briefing-agent.ts` — V2 briefing with 8 knowledge types + quality scoring
- `src/lib/ai/content-pipeline/topic-normalizer.ts` — AI topic normalization + upsert
- `src/lib/ai/content-pipeline/knowledge-gap-analyzer.ts` — gap analysis + readiness scoring
- `src/lib/services/knowledge-brain.ts` — searchKnowledgeV2, topic listing, summary caching, dedup, gap/readiness
- `src/lib/services/knowledge-dedup.ts` — checkForDuplicate, supersedeEntry, recordCorroboration
- `src/lib/types/content-pipeline.ts` — KnowledgeType, TopicEntry, GapAnalysis, ContentBrief types
- `src/components/content-pipeline/KnowledgeDashboard.tsx` — 4-subtab dashboard container with team toggle
- `src/components/content-pipeline/KnowledgeOverview.tsx` — Overview stats + highlights
- `src/components/content-pipeline/TopicBrowser.tsx` — Topic card grid
- `src/components/content-pipeline/TopicDetail.tsx` — Topic detail with summary generation
- `src/components/content-pipeline/GapAnalysis.tsx` — Gap cards + readiness assessment
- `src/components/content-pipeline/KnowledgeSearch.tsx` — Enhanced search with V2 filters
- `src/trigger/process-transcript.ts` — updated with topic normalization + dedup
- `src/trigger/consolidate-knowledge.ts` — weekly dedup + topic stats
- `src/trigger/backfill-knowledge-types.ts` — backfill task for existing entries
- `supabase/migrations/20260220400000_knowledge_topic_summaries.sql` — summary columns migration

#### MCP Tools (7 new, in @magnetlab/mcp v0.2.0)

`search_knowledge_v2`, `list_knowledge_topics`, `get_topic_detail`, `analyze_knowledge_gaps`, `assess_content_readiness`, `get_recent_knowledge_digest`, `ask_knowledge`
