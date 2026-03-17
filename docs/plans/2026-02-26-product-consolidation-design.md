# Product Consolidation Design: MagnetLab → Conductor

**Date:** 2026-02-26
**Status:** Draft — pending team review
**Authors:** Tim Keen, Claude (analysis + synthesis)
**Context:** Read after [ecosystem-current-state.md](./2026-02-25-ecosystem-current-state.md) and [monorepo-consolidation-design.md](./2026-02-25-monorepo-consolidation-design.md)

---

## The Question

MagnetLab started as a lead magnet SaaS. gtm-system started as an internal back-office orchestrator. Over time, magnetlab grew into a content operating system (transcripts → knowledge → posts → funnels → leads). The question: should features from gtm-system migrate into magnetlab, turning it into a full agency operating system?

**Answer: Yes, selectively.** Not feature parity with GoHighLevel. Not replacing best-in-class tools. The product becomes the **orchestration layer** — the glue that connects an agency's tools, centralizes their business knowledge, and uses AI to make everything smarter over time.

Working name for the vision: **Conductor**.

---

## The Insight

Agencies today use 5-10 tools that don't talk to each other: Instantly for cold email, HeyReach for LinkedIn, Attio/HubSpot for CRM, Cal.com for scheduling, Clay for enrichment (or nothing because Clay is too complex), spreadsheets for financials. No single place answers "what's working?" or "what should I do today?"

GoHighLevel tried to solve this by replacing everything. It does everything poorly.

**Conductor solves this by replacing nothing.** Users keep their CRM, their cold email tool, their LinkedIn tool. Conductor is the intelligence layer that sits on top — it connects to their tools, centralizes the data, and uses AI to make the whole system smarter.

The moat: **the Brain.** The longer someone uses Conductor, the more it knows about their business — their expertise, their ICP, what content converts, which outreach works, how leads move through their pipeline. This compound knowledge makes every feature better over time. Tools are replaceable. The Brain is not.

---

## The Mental Model: Brain-Centric Architecture

MagnetLab today organizes around output types (Lead Magnets, Pages, Posts, Email). The UI redesign reorganizes around Brain → Assets → Distribution.

Conductor extends this into a hub-and-spoke model with the Brain at the center:

```
┌─────────────────────────────────────────────────────┐
│                   CONDUCTOR                          │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │              THE BRAIN                         │  │
│  │   Semantic intelligence layer over all data    │  │
│  │                                                │  │
│  │   • Knowledge base (transcripts, expertise)    │  │
│  │   • ICP model (learned from wins/losses)       │  │
│  │   • Performance patterns (what works)          │  │
│  │   • Business context (positioning, voice)      │  │
│  │   • Enrichment data (leads, companies)         │  │
│  │                                                │  │
│  │   Queryable via MCP, UI, and AI agents         │  │
│  └───────┬────────┬────────┬────────┬─────────────┘  │
│          │        │        │        │                 │
│   ┌──────▼──┐ ┌───▼────┐ ┌▼──────┐ ┌▼──────────┐    │
│   │ Assets  │ │Outreach│ │Pipe-  │ │Performance│    │
│   │         │ │        │ │line   │ │           │    │
│   │ Create  │ │Enrich, │ │What's │ │ Revenue,  │    │
│   │ from    │ │connect,│ │hap-   │ │ ROI,      │    │
│   │ Brain   │ │auto-   │ │pening │ │ channel   │    │
│   │         │ │mate    │ │across │ │ metrics   │    │
│   └─────────┘ └───┬────┘ │tools? │ └───────────┘    │
│                   │      └──┬────┘                   │
│              ┌────▼─────────▼──────┐                 │
│              │  CONNECTED TOOLS    │                 │
│              │  Cold email, LinkedIn│                 │
│              │  CRM, Calendar,     │                 │
│              │  Stripe, DMs, Calls │                 │
│              │  (user brings own)  │                 │
│              └─────────────────────┘                 │
└─────────────────────────────────────────────────────┘
```

### What the Brain IS and IS NOT

**IS:** A semantic intelligence layer. AI-extracted insights, embeddings, classified patterns, ICP models, performance learnings. The thing that makes raw data queryable and actionable.

**IS NOT:** A renamed database. Raw data lives in normal tables (leads, revenue_events, enrichment results). The Brain is the intelligence on top — when you ask it "what do I know about agencies in the video production space?" it traverses knowledge entries, lead enrichment data, content performance, and conversation history to synthesize an answer.

### Data Signal Tiers

Not all data is equally valuable to the Brain:

| Tier | Signal | Lifespan | Examples |
|------|--------|----------|---------|
| **Core** | Very high | Permanent | Extracted expertise, business positions, ICP definition |
| **Strategic** | High | Evolves slowly | Writing style, content performance patterns, ICP model |
| **Operational** | Medium | Weeks-months | Lead enrichment, campaign metrics, reply sentiment |
| **Ephemeral** | Low | Transient | Webhook events, delivery status, click tracking |

The Brain's AI weights permanent high-signal data over ephemeral low-signal data when synthesizing answers. A morning brief that says "write about objection handling — it's your highest-performing topic AND three pipeline leads this week are in industries where you have deep expertise on this" is the compound effect working across tiers.

---

## The CRM Boundary (Sacred)

**Conductor does NOT replace CRM. It enriches CRM.**

| Conductor Owns | CRM Owns |
|---------------|----------|
| Business knowledge + expertise | Contact records |
| Enrichment data + ICP scoring | Deal stages + pipeline |
| Content + distribution | Activity history |
| Orchestration logic + automations | Contact ownership + assignment |
| Performance analytics | Revenue forecasting |

**Data flows bidirectionally:**
- Conductor → CRM: ICP score, enrichment data, content engagement signals, reply sentiment, "this person replied positively to cold email"
- CRM → Conductor: Deal stages, meeting bookings, revenue events, contact changes

**Pipeline in Conductor's nav is NOT "here are all your leads in a table."** That's the CRM's job. Pipeline is: "here's what's happening right now across all your connected tools, enriched with Brain intelligence." A unified activity feed with AI commentary — not a contact database.

Supported CRMs (via integration): Attio (built), HubSpot (planned), GoHighLevel (planned), Pipedrive (planned). Users connect their CRM and the sync runs automatically.

---

## What Migrates from gtm-system

### Moves to Conductor (becomes product)

| Feature | Nav Section | What Users Get |
|---------|------------|---------------|
| **Webhook ingestion framework** | Outreach (Settings) | "Connect PlusVibe/HeyReach/Cal.com — events flow in automatically" |
| **Enrichment recipes** | Outreach | "Upload a CSV, pick a recipe, get enriched leads back." Enrichment for people who don't use Clay. |
| **Reply classification** | Outreach | AI classifies incoming replies as positive/negative/objection. Ships with webhook ingestion. |
| **CRM sync (bidirectional)** | Settings (Connections) | "Connect your CRM. Brain insights push to it, pipeline data pulls from it." |
| **Cold email campaign visibility** | Outreach | "See all your campaigns across sending platforms in one dashboard" |
| **DM Intelligence** (contact enrichment, ICP scoring) | Pipeline | "Your LinkedIn contacts scored, ranked, and enriched with Brain data" |
| **DM/call/conversation tracking** | Pipeline | "All conversations — email replies, DMs, calls — on a unified timeline per contact" |
| **Conductor signals + morning brief** | Home (Dashboard) | "Here's what happened overnight and what needs your attention" — AI daily brief |
| **Analytics dashboard** (multi-channel attribution) | Performance | "How many leads from each channel? What converted? What's the funnel look like?" |
| **Financial tracking** (revenue, P&L) | Performance | "Revenue, expenses, ROI per channel, unit economics" |
| **Automation rules** | Outreach (Automations) | "When positive reply → generate Blueprint → deliver" — user-configurable |
| **AI recommendations** | Home (Dashboard) | "Based on your Brain: write about X, follow up with Y, pause campaign Z" |

### Stays in gtm-system (becomes thin backend engine)

| Feature | Why It Stays |
|---------|-------------|
| Blueprint generation orchestration | Backend engine — magnetlab calls it via API |
| DFY engagement management | Internal ops, too bespoke for product |
| Intro offer / sprint fulfillment | Tim's specific service offering |
| Infrastructure provisioning (Zapmail) | Niche operational tool |
| TAM analysis pipeline | Specific research workflow |
| Proposal generation | Tied to specific sales process — maybe revisit later |
| Facebook lead capture | Too niche |
| Slack integration | Internal notifications only |
| Linear integration | Internal project management |

After migration, gtm-system becomes a small API service on Railway with no dashboard UI. It handles heavyweight backend processing that's too long-running for Vercel, plus internal operations features.

### Dies (deprecated or redundant)

| Feature | Reason |
|---------|--------|
| gtm-system content pipeline (non-cp_ tables) | Already migrated to magnetlab |
| gtm-system lead magnet creation routes | magnetlab owns this |
| MCP bridge routes in gtm-system | MCP talks directly to magnetlab |
| LeadShark integration | Replaced by Unipile |
| Airtable integration | Legacy |
| Clarify CRM | Unused |
| N8n integration | Legacy |
| Webflow integration | Legacy |
| SMS/Voice channels (Twilio) | Not core — revisit if demand emerges |

---

## Migration Waves

### Wave 1: Feed the Brain (Months 1-3)

**Goal:** Data starts flowing in. Users connect tools, enrichment data accumulates.

| What Moves | Complexity | User Impact |
|-----------|-----------|-------------|
| Webhook ingestion framework | Medium | Events from connected tools flow into Conductor automatically |
| Enrichment recipes | Medium | Upload → enrich → get results. No Clay required. |
| Reply classification | Low | Ships with webhook ingestion |
| CRM bidirectional sync | Medium | Brain enrichments push to CRM, pipeline data pulls back |

**Brain impact:** After Wave 1, the Brain knows who users are talking to (enriched leads), how conversations are going (reply sentiment), and where deals stand (CRM sync) — not just what the user is an expert in (transcripts).

**Architecture note:** Webhook handlers currently assume single-tenant (Tim's tenant ID). Migration requires per-user credential storage and routing. The `user_integrations` table in magnetlab already handles this pattern (used for email marketing integrations) — extend it for outreach tools.

### Wave 2: Make the Brain Visible (Months 3-6)

**Goal:** Users can see what the Brain knows across all their data.

| What Moves | Complexity | User Impact |
|-----------|-----------|-------------|
| Pipeline view (leads + DM intelligence) | Medium | Every lead across every channel, Brain-enriched, in one view |
| Analytics dashboard | Medium | Multi-channel attribution, funnel conversion, campaign comparison |
| Conductor signals + morning brief | Medium | AI daily brief: "what happened, what needs attention" |
| Outreach campaign visibility | Low | All campaigns across tools in one dashboard |
| Conversation tracking (DMs, email, calls) | Medium | Unified timeline per contact across channels |

**Brain impact:** Users start trusting the Brain because they can see it working. The morning brief proves the AI understands their business.

### Wave 3: Make the Brain Actionable (Months 6-9)

**Goal:** The Brain doesn't just show — it does things.

| What Moves | Complexity | User Impact |
|-----------|-----------|-------------|
| Automation rules engine | High | "When X happens → do Y" — user-configurable, not hardcoded |
| Financial tracking | Low | Revenue + expenses + P&L, tied to pipeline for true ROI |
| AI recommendations | Medium | "Based on your Brain, you should..." — data-informed suggestions |
| Brain-informed content generation (enhanced) | Medium | Content generation draws from pipeline + performance data, not just transcripts |

**Brain impact:** The compound effect kicks in. By month 6, content generation considers performance data + pipeline data + knowledge base together. Recommendations are informed by 6 months of accumulated intelligence.

### Wave 4: MCP Excellence (Parallel, ongoing)

Every migrated feature gets MCP tools simultaneously. The MCP is the Brain's API.

| MCP Tool Category | Wave | Key Tools |
|------------------|------|-----------|
| Enrichment | 1 | `enrich_leads`, `run_recipe`, `check_enrichment_status` |
| Connections | 1 | `list_connections`, `get_campaign_stats`, `sync_crm` |
| Pipeline | 2 | `search_leads`, `get_pipeline_summary`, `get_lead_timeline` |
| Analytics | 2 | `get_channel_performance`, `get_conversion_funnel` |
| Automations | 3 | `create_automation`, `list_automations` |
| Brain (flagship) | All | `ask_brain` — natural language query across ALL Brain data |

The `ask_brain` tool is the crown jewel. By Wave 3: *"Which of my current pipeline leads are in industries where I have deep expertise, and draft a personalized follow-up for each?"* — and the Brain has enough data to answer well.

**The MCP reduces the need for built-in integration UIs.** Instead of building a HeyReach settings page, you build great MCP tools and users wire up custom workflows via Claude Code. The long tail of integrations is handled by AI, not by engineering time.

---

## Implications for Current Work

### UI Redesign (Ankur, in progress)

The UI redesign (Brain → Assets → Distribution) is Phase 1 of this vision. It should be designed with extensibility in mind:

- **Nav structure:** The sidebar should accommodate 2-3 more top-level sections later (Outreach, Pipeline, Performance). Don't hardcode 5 items — use a flexible nav system.
- **Brain section:** Should be designed as the center of the product, not just "Knowledge." It will eventually surface enrichment data, pipeline intelligence, and performance patterns alongside transcript knowledge.
- **Settings/Connections:** The integrations settings page should be designed as a "Connected Tools" hub that can grow — not just email marketing providers.

### MCP Upgrade (Ankur, in progress)

The MCP bugs (MOD-242 through MOD-255) are prerequisites. The MCP must work reliably before it becomes the primary programmatic interface. Priorities:

1. Fix broken tools (search, topics, quality scores) — trust
2. Add filtering/pagination — scalability
3. Wire Brain into content generation — compound value
4. Design `ask_brain` as the unified query tool — the flagship

### Monorepo Consolidation (planned)

The monorepo plan (Turborepo, 3 deployable apps) aligns with this product consolidation. The key adjustment: as features migrate from gtm-system to magnetlab, the engine/ app in the monorepo shrinks rather than grows. The migration waves here should inform the monorepo phase sequencing.

---

## What This Is NOT

- **Not a CRM.** Users keep Attio/HubSpot/GHL. Conductor enriches CRMs, doesn't replace them.
- **Not an email sending platform.** Users keep Instantly/PlusVibe/SmartLead. Conductor orchestrates across them.
- **Not a LinkedIn automation tool.** Users keep HeyReach. Conductor tracks what happens and acts on signals.
- **Not Clay.** Clay is a data spreadsheet IDE. Conductor offers pre-built enrichment recipes that non-technical users can run without learning a new tool.
- **Not GoHighLevel.** GHL replaces everything poorly. Conductor replaces nothing — it makes your existing tools work together intelligently.

**Conductor is the operating system for your agency's go-to-market.** It's AI-native from the ground up. The Brain gets smarter the longer you use it. Tools plug in at the edges. The intelligence in the middle is permanent and compounding.

---

## Remote MCP Server: The Brain as a Service

### Inspiration: Spydr (spydr.dev)

Spydr built one of the first OAuth-authenticated remote MCP servers — a "Universal Context Layer" where AI agents query per-user memory via `FindWebs` and `FindMemories` tools. Their key architectural decision: using **Stytch** (stytch.com) for OAuth 2.1 with dynamic client registration, so every AI agent that connects gets isolated, per-user scoped credentials automatically. No shared API keys, no memory bleed between users.

Stack: Cloudflare Workers + Hono + Stytch + MCP over HTTP/SSE. Open-source MCP server: github.com/fadeleke57/spydr-memory-mcp.

### How This Applies to Conductor

The `@magnetlab/mcp` package currently runs locally via stdio (Claude Code spawns it as a child process). For Conductor to be a hosted Brain that any AI client can query remotely, we need a remote MCP endpoint — something like `POST https://magnetlab.app/mcp` that handles the protocol over HTTP with SSE streaming.

This unlocks Claude Desktop, Cursor, ChatGPT, or any MCP-compatible client connecting to a user's Brain from anywhere, without Claude Code running locally.

### Architecture (Wave 4)

```
AI Agent (Claude Desktop, Cursor, etc.)
  │
  │  MCP over HTTP/SSE
  │  OAuth 2.1 Bearer token (per-user scoped)
  │
  ▼
magnetlab.app/mcp (remote MCP endpoint)
  │
  │  Token introspection → user_id
  │
  ▼
Brain query layer (same searchKnowledgeV2, ask_brain, etc.)
  │
  ▼
Supabase (pgvector, cp_* tables, RLS on user_id)
```

**Auth approach:** Stytch (stytch.com) for OAuth 2.1 — supports dynamic client registration (agents self-register), M2M tokens (service-to-service), and token introspection. Spydr proved this works at scale with thousands of AI agents. Alternative: build on NextAuth's existing OAuth, but Stytch's MCP-specific support and developer experience may save significant time.

**MCP tools exposed remotely** (same as local, but authenticated):

| Tool | Purpose |
|------|---------|
| `ask_brain` | Natural language query across all Brain data (flagship) |
| `search_knowledge_v2` | Semantic search with type/topic/quality filters |
| `list_knowledge_topics` | Browse topic taxonomy |
| `enrich_leads` | Run enrichment recipes |
| `get_pipeline_summary` | Pipeline intelligence |
| `get_channel_performance` | Multi-channel analytics |

### Competitive Context

The AI memory MCP space is active but entirely horizontal:

| Product | Approach | Why We're Different |
|---------|----------|---------------------|
| **Mem0** ($19-249/mo) | Generic fact extraction from conversations | No domain intelligence, no quality scoring |
| **Zep/Graphiti** | Temporal knowledge graph (facts with valid_at/invalid_at) | Interesting pattern for tracking ICP evolution — worth monitoring |
| **Letta (MemGPT)** | Agents manage their own memory blocks | Relevant for Wave 3 automation agents that learn from outcomes |
| **Spydr** | Multimodal project-organized context | Generic. The OAuth/MCP architecture is the valuable part |

None are competitors — they're horizontal memory layers. The Brain is a **vertical intelligence layer for agency GTM** with 8 knowledge types, quality scoring, topic taxonomy, gap analysis, style evolution, and cross-domain synthesis. The defensible asset is the intelligence, not the protocol.

### Implementation Notes

- **Not now.** This is a Wave 4 concern. Current local MCP via stdio works fine for single-user.
- **Stytch free tier** supports the initial build. Paid tiers scale with agent connections.
- **MCP spec (2025-11-25)** mandates OAuth 2.1 with PKCE for remote servers — Stytch is spec-compliant out of the box.
- The remote endpoint can coexist with the local stdio MCP — same tool definitions, different transport.

---

## Open Questions (For Team Discussion)

1. **Naming timeline:** When does MagnetLab become Conductor? Before or after the product matches the vision? A rename too early confuses existing users. Too late and the brand doesn't match the product.

2. **Pricing model:** Does the current free/pro/unlimited tier structure work for an operating system? Outreach + Pipeline + Performance features may warrant a higher tier or usage-based pricing.

3. **Enrichment recipe marketplace:** Should users be able to share or sell enrichment recipes? If recipes become a key differentiator, a community marketplace could drive adoption.

4. **Which CRM integration first?** Attio is built but niche. HubSpot has the largest market. GHL has the most dissatisfied users. The first CRM integration should target the largest overlap with our user base.

5. **Self-serve vs. assisted onboarding:** Connecting 3-5 tools and configuring automations is complex. Do users need a guided setup wizard? Or does MCP + Claude Code handle this?

6. **Data portability:** If the Brain is the moat, should we offer data export? Good for trust, potentially bad for retention. Leaning toward full export (knowledge, enrichment, analytics) because it builds trust and the *intelligence* on top of the data is the real moat, not the data itself.
