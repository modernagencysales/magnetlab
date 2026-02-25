# Setting Up a Claude Project for the CEO

**Problem:** CEO needs answers about the system but doesn't use terminal, git, or Claude Code.

**Solution:** A Claude.ai Project with all our docs loaded as knowledge. He just opens a browser, types a question, gets an answer. Like ChatGPT but it knows our entire system.

---

## Setup Steps (you do this, not him)

### 1. Go to claude.ai → Projects → Create Project

### 2. Name it: "Modern Agency Sales — System Knowledge"

### 3. Add this as the Project Instructions:

```
You are an assistant for the CEO of Modern Agency Sales. You have access to detailed technical documentation about the company's software systems.

IMPORTANT RULES:
- Explain everything in plain business English. No code, no technical jargon.
- If the CEO asks "how many X do we have," look in the docs for numbers and give them.
- If the CEO asks "can we do X," explain whether the system supports it and what would be involved.
- If the CEO asks about costs, timelines, or status, give honest answers based on the docs.
- If you don't know something, say "I don't have that information in my docs — ask Tim to update the project knowledge."
- Never suggest the CEO run commands, edit code, or open a terminal.
- When referencing technical systems, translate to business terms:
  - "magnetlab" = "our SaaS product"
  - "gtm-system" = "our backend/operations system"
  - "leadmagnet-backend" = "the Blueprint generator"
  - "copy-of-gtm-os" = "our website and portals"
  - "Trigger.dev" = "our background job system"
  - "Supabase" = "our database"
  - "Railway" = "where our backend runs"
  - "Vercel" = "where our websites run"
  - "RLS" = "database security rules"
  - "API" = "how our systems talk to each other"
  - "webhook" = "automatic notification between systems"
  - "Trigger.dev task" = "automated background process"

The CEO may ask questions like:
- "What does our tech actually do?"
- "How many leads have we processed?"
- "Can we add feature X?"
- "What's the status of the consolidation?"
- "How does the Blueprint thing work?"
- "What are we paying for all these services?"
- "What would break if we changed X?"

Answer these directly and concisely. Use bullet points. Avoid walls of text.
```

### 4. Upload these files as Project Knowledge:

From `magnetlab/docs/plans/`:
- `2026-02-25-ceo-system-overview.md`
- `2026-02-25-ecosystem-current-state.md`
- `2026-02-25-monorepo-consolidation-design.md`
- `2026-02-25-new-dev-handbook.md` (for the service inventory and integration details)
- `2026-02-25-database-schema-reference.md` (for the "how many X" questions)

### 5. Share the Project URL with the CEO

He just bookmarks it and opens it whenever he has a question.

---

## What the CEO Can Ask (examples)

| Question | What Claude will answer from |
|----------|------------------------------|
| "How does the Blueprint work?" | ceo-system-overview.md |
| "How many leads have we processed?" | database-schema-reference.md (row counts) |
| "What services are we paying for?" | ecosystem-current-state.md (service inventory) |
| "What's the plan for simplifying things?" | monorepo-consolidation-design.md |
| "Can we add SMS to the outreach?" | ecosystem docs (what gtm-system integrates with) |
| "What breaks most often?" | new-dev-handbook.md (runbook section) |
| "How many bootcamp students do we have?" | database-schema-reference.md |
| "What would it take to white-label this for another company?" | ecosystem docs (auth, multi-tenancy) |

---

## Keeping It Updated

When you ship significant features or the numbers change materially:
1. Update `ceo-system-overview.md` with new features/numbers
2. Re-upload to the Claude Project
3. That's it — his next conversation will have the latest info

You can also upload meeting notes, strategy docs, or financial reports to give Claude more context for answering business questions.

---

## Why This Works Better Than Claude Code

| | Claude Code (terminal) | Claude.ai Project (browser) |
|---|---|---|
| Installation | CLI tool, requires terminal | None — just a URL |
| Interface | Command line | Chat in browser |
| Learning curve | Needs git, terminal basics | Type a question, get an answer |
| Access to code | Reads actual repo files | Reads uploaded docs (curated) |
| Best for | Developers | Everyone else |

The CEO doesn't need to read code. He needs to ask questions and get answers in English. A Claude Project does exactly that.
