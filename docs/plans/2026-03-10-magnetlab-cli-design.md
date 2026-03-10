# MagnetLab CLI + Claude Code Integration — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI (`magnetlab`) + project initializer (`magnetlab init`) that makes Claude Code a first-class interface for MagnetLab.

**Architecture:** Thin CLI dispatch layer over existing MCP infrastructure (client, handlers, tool schemas). Same `@magnetlab/mcp` package with second bin entry. `magnetlab init` generates `.claude/commands/` slash commands and CLAUDE.md section for instant Claude Code onboarding.

**Tech Stack:** Commander.js (existing), Node fs/readline (stdlib), Vitest (existing)

---

## Target Users

Agencies building lead magnets for clients, all technical (Claude Code users). They want to quickly create brain-informed lead magnets, funnels, and email sequences using accumulated expertise. CLI-first for lower token usage and no background server process.

## CLI Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `magnetlab exec <tool> [flags]` | Execute any tool | `magnetlab exec search_knowledge --query "cold email"` |
| `magnetlab tools [category]` | List tools (all or by category) | `magnetlab tools knowledge` |
| `magnetlab help <tool>` | Show tool schema + description | `magnetlab help create_lead_magnet` |
| `magnetlab guide <task>` | Print workflow recipe | `magnetlab guide create_lead_magnet` |
| `magnetlab status <id>` | Shortcut for lead_magnet_status | `magnetlab status abc123` |
| `magnetlab init` | Set up Claude Code project | `magnetlab init` |

### `exec` Flag Parsing

- Tool schemas are the source of truth — flags auto-derived from `inputSchema.properties`
- `--query "cold email"` → `{query: "cold email"}`
- `--use-brain` (boolean) → `{use_brain: true}`
- `--limit 20` (number) → `{limit: 20}`
- `--funnel-config '{"slug":"x"}'` (object) → parsed as JSON
- `magnetlab_` prefix optional — `exec search_knowledge` and `exec magnetlab_search_knowledge` both work
- Kebab-case flags → snake_case args: `--lead-magnet-id` → `lead_magnet_id`

### Output

- JSON to stdout by default (Claude Code parses it)
- `--pretty` flag for human-readable formatting
- Non-zero exit code on errors, error JSON to stderr

## `magnetlab init` Flow

1. **API Key** — check `MAGNETLAB_API_KEY` env, prompt if missing, save to `.env`
2. **Generate slash commands** — create `.claude/commands/` with 6 workflow files
3. **Update CLAUDE.md** — append MagnetLab CLI reference section
4. **Verify connection** — test API call, print success/error

## Slash Commands (6 total)

| File | Command | Workflow |
|------|---------|----------|
| `create-lead-magnet.md` | `/create-lead-magnet cold email checklist for B2B founders` | Full brain-informed lead magnet: readiness → research → create → content → email → publish |
| `write-post.md` | `/write-post thought leadership` | Knowledge-grounded LinkedIn post |
| `check-brain.md` | `/check-brain sales objections` | Knowledge readiness + topic summary + recommendations |
| `lead-magnet-status.md` | `/lead-magnet-status abc123` | Completeness check + next step |
| `setup-funnel.md` | `/setup-funnel abc123` | Funnel creation + restyle + email + publish |
| `content-week.md` | `/content-week` | Plan + write + schedule a week of LinkedIn posts |

### Slash Command Principles

- Each uses `$ARGUMENTS` for user input
- Embed literal `magnetlab exec` commands Claude follows exactly
- Include decision points where Claude checks with user before proceeding
- End with structured summary (title, URL, status, brain data used)
- Include error handling guidance (explain error, suggest fix)

## File Structure

```
packages/mcp/src/
├── index.ts              # existing MCP server (magnetlab-mcp serve)
├── cli.ts                # NEW: CLI entry point
├── cli/
│   ├── exec.ts           # Flag parsing from schemas, dispatch to handleToolCall
│   ├── init.ts           # Project setup: API key, slash commands, CLAUDE.md
│   └── commands/         # Slash command templates (string literals)
│       ├── create-lead-magnet.ts
│       ├── write-post.ts
│       ├── check-brain.ts
│       ├── lead-magnet-status.ts
│       ├── setup-funnel.ts
│       └── content-week.ts
├── client.ts             # existing (reused)
├── handlers/             # existing (reused via handleToolCall)
├── tools/                # existing (schemas reused for flag generation)
└── constants.ts          # existing (reused)
```

## Testing

- `cli/exec.test.ts` — flag parsing: kebab→snake, booleans, numbers, JSON objects, prefix stripping
- `cli/init.test.ts` — file generation: slash commands, CLAUDE.md, API key validation
- `cli/commands.test.ts` — all 6 templates non-empty, reference `magnetlab exec`, contain `$ARGUMENTS`
- ~15-20 new tests, Vitest

## Key Reuse

- `exec` → `handleToolCall()` from handlers/index.ts
- `tools` → `toolsByName`, `discoveryCategories` from tools/index.ts
- `help` → tool's inputSchema + description
- `guide` → `workflowRecipes` from category-tools.ts
- `status` → sugar for `exec lead_magnet_status`
