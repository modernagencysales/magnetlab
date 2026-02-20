# Knowledge Data Lake v2 — Design

## Goal

Extend the Knowledge Data Lake with 5 features: topic summaries, knowledge dashboard UI, knowledge-powered post writing, team knowledge sharing, and comprehensive test coverage.

## Architecture

Builds on the existing Knowledge Data Lake infrastructure (8 knowledge types, topic auto-discovery, quality scoring, deduplication, gap analysis). New features wire up capabilities that exist at the service/RPC layer but aren't exposed in the UI or consumed by the autopilot.

## Features

### 1. Topic Summary Generation (on-demand + cached)

AI-generated summaries that synthesize all knowledge entries under a topic into a concise briefing.

**Data model**:
- Add `summary` (text) and `summary_generated_at` (timestamptz) columns to `cp_knowledge_topics`

**Stale detection**:
- Compare `last_seen` vs `summary_generated_at` — if `last_seen > summary_generated_at`, summary is stale

**AI module**: `src/lib/ai/content-pipeline/topic-summarizer.ts`
- Input: all entries for a topic, grouped by knowledge type
- Output: structured summary with key insights, common patterns, open questions, actionable takeaways
- Model: Claude Haiku (cost efficiency)
- Prompt: synthesize entries into a coherent 200-400 word briefing organized by theme (not by knowledge type)

**API**: `POST /api/content-pipeline/knowledge/topics/[slug]/summary`
- Returns cached summary if fresh
- Generates and caches if stale or missing
- Force regenerate with `?force=true` query param

**UI**: Summary panel at top of topic detail view with "Regenerate" button

### 2. Knowledge Dashboard (replaces AI Brain tab)

Replace `KnowledgeBrainTab` with a richer dashboard surfacing topics, gaps, readiness, and search in one unified view.

**Layout**: 4 subtab views within the Knowledge tab:

| Subtab | Content |
|--------|---------|
| **Overview** | Stats row (total entries, topics, avg quality, transcripts processed) + recent entries list + quick-search |
| **Topics** | Card grid of topics (entry count, avg quality, type breakdown bar, coverage score). Click → topic detail with summary + entries grouped by type |
| **Gaps** | Gap analysis: topic cards with missing knowledge types highlighted, sorted by severity. Readiness assessment panel (enter goal, pick topic, get readiness score) |
| **Search** | Enhanced search with V2 filters: knowledge type, topic, min quality, since date. Plus existing tag/speaker/category filters |

**Components**:
- `KnowledgeDashboard.tsx` — tab container with subtab navigation
- `KnowledgeOverview.tsx` — stats cards + recent entries
- `TopicBrowser.tsx` — topic card grid with type breakdown visualization
- `TopicDetail.tsx` — single topic: summary, entries by type, corroboration badges
- `GapAnalysis.tsx` — gap cards + readiness assessment panel
- `KnowledgeSearch.tsx` — refactored from existing KnowledgeBrainTab search logic

**Reused**: KnowledgeEntryCard, ManualKnowledgeModal, ProfileSwitcher

### 3. Knowledge-Powered Post Writing

Upgrade the autopilot briefing agent to leverage the data lake's richer metadata.

**Changes to `briefing-agent.ts`**:
1. Switch from `searchKnowledge()` to `searchKnowledgeV2()` for quality scores + knowledge type access
2. Restructure compiled context with all 8 knowledge types:
   - Stories → "REAL STORIES FROM YOUR EXPERIENCE"
   - How-tos → "STEP-BY-STEP PROCESSES"
   - Objections → "OBJECTIONS YOUR AUDIENCE HAS"
   - Mistakes → "MISTAKES TO WARN ABOUT"
   - Questions → "QUESTIONS YOUR AUDIENCE ASKS"
   - Insights → "KEY INSIGHTS"
   - Decisions → "DECISIONS & FRAMEWORKS"
   - Market Intel → "MARKET INTELLIGENCE"
3. Sort entries by quality score (highest first) within each section
4. Add corroboration context (entries confirmed by multiple speakers are more credible)

**Changes to `ContentBrief` type**:
- Add optional `topicReadiness?: number` (0-1 score)
- Add optional `topKnowledgeTypes?: KnowledgeType[]` (what types are available)

**Changes to autopilot idea selection**:
- Boost ideas whose topics have higher readiness scores
- Skip ideas for topics with readiness < 0.3 (insufficient material)

### 4. Team Knowledge Sharing (shared pool)

Wire up existing team infrastructure. All team members' knowledge is automatically visible when team scope is active.

**API layer** — add optional `team_id` query param to:
- `GET /api/content-pipeline/knowledge` (search/browse)
- `GET /api/content-pipeline/knowledge/topics`
- `GET /api/content-pipeline/knowledge/topics/[slug]`
- `GET /api/content-pipeline/knowledge/gaps`
- `GET /api/content-pipeline/knowledge/export`
- `GET /api/content-pipeline/knowledge/recent`
- `GET /api/content-pipeline/knowledge/ask`

**Service layer**:
- `searchKnowledgeV2()` — add `teamId`, use `cp_match_team_knowledge_entries` RPC
- `listKnowledgeTopics()` — accept `teamId`, query by team_id OR user_id
- `analyzeTopicGaps()` — accept `teamId` for team-wide gap analysis

**UI**:
- Team/Personal toggle in dashboard header
- Entry cards show contributor name when in team mode

**Autopilot**:
- `buildContentBriefForIdea()` passes `teamId` from `AutoPilotConfig` (field already exists)

### 5. Tests

| Module | Test file | Coverage |
|--------|-----------|----------|
| `knowledge-brain.ts` | `knowledge-brain.test.ts` | searchKnowledgeV2 filter logic, listTopics, exportTopicKnowledge, getAllRecentKnowledge |
| `topic-normalizer.ts` | `topic-normalizer.test.ts` | normalizeTopics dedup, slug generation, upsertTopics |
| `knowledge-dedup.ts` | `knowledge-dedup.test.ts` | checkForDuplicate (supersede/corroborate/insert), supersedeEntry, recordCorroboration |
| `briefing-agent.ts` | `briefing-agent.test.ts` | buildContentBrief with V2 search, context compilation with 8 types |
| `topic-summarizer.ts` | `topic-summarizer.test.ts` | summary generation, stale detection |
| `knowledge-readiness.ts` | `knowledge-readiness.test.ts` | readiness scoring, gap suggestions |
| API routes | `knowledge-api.test.ts` | Auth, param validation, response shapes for gaps/readiness/export/topics |

Approach: Mock Supabase + AI clients. Test business logic, not external APIs.

## Implementation Order

1. Migration (add summary columns)
2. Topic summarizer AI module + tests
3. Summary API route
4. Briefing agent V2 upgrade + tests
5. Autopilot readiness integration
6. API team_id params
7. Service layer team support
8. Knowledge Dashboard UI (Overview, Topics, Gaps, Search subtabs)
9. Topic detail + summary UI
10. Team toggle UI
11. Remaining tests (dedup, normalizer, API routes)
12. Build, deploy, publish MCP
