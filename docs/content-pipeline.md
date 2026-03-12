# Content Pipeline + AI Brain

Transcripts → knowledge extraction → ideas → posts. pgvector semantic search, topic auto-discovery, gap analysis.

## Tables (cp_ prefix)

`cp_call_transcripts`, `cp_knowledge_entries`, `cp_knowledge_topics`, `cp_content_ideas`, `cp_pipeline_posts`, `cp_posting_slots`, `cp_post_templates`, `cp_writing_styles`, `cp_edit_history`

RPCs: `cp_match_knowledge_entries()`, `cp_match_knowledge_entries_v2()`, `cp_match_team_knowledge_entries()`

## API Routes

| Area | Routes |
|------|--------|
| Webhooks | `grain`, `fireflies`, `fathom/[userId]` |
| Transcripts | `content-pipeline/transcripts` (paste, upload, list) |
| Knowledge | `knowledge`, `knowledge/topics`, `knowledge/gaps`, `knowledge/readiness`, `knowledge/ask`, `knowledge/export` |
| Ideas | `ideas` (list, update, delete, write-from-idea) |
| Posts | `posts` (CRUD, polish, publish), `schedule/slots`, `schedule/autopilot`, `schedule/buffer` |

## Knowledge Types

`how_to`, `insight`, `story`, `question`, `objection`, `mistake`, `decision`, `market_intel` — each with `quality_score`, `topics`, `specificity`, `actionability`.

## Data Flow

```
Transcript → process-transcript → extractKnowledge → normalizeTopics → generateEmbedding
  → checkForDuplicate → insert cp_knowledge_entries → extractIdeas → cp_content_ideas
```

## Key Files

- `src/lib/services/knowledge-brain.ts` — search, topics, dedup
- `src/lib/ai/content-pipeline/briefing-agent.ts` — V2 briefing with 8 knowledge types
- `src/trigger/process-transcript.ts` — transcript processing
- `src/trigger/consolidate-knowledge.ts` — weekly dedup (Sundays 3 AM UTC)
