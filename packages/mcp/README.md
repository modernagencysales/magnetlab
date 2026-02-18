# @magnetlab/mcp

MCP server for [MagnetLab](https://magnetlab.ai) -- control your lead magnets, funnels, content pipeline, and analytics from Claude Code or Claude Desktop.

## Quick Setup

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "magnetlab": {
      "command": "npx",
      "args": ["-y", "--package", "@magnetlab/mcp", "magnetlab-mcp", "serve"],
      "env": {
        "MAGNETLAB_API_KEY": "ml_live_your_key_here"
      }
    }
  }
}
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "magnetlab": {
      "command": "npx",
      "args": ["-y", "--package", "@magnetlab/mcp", "magnetlab-mcp", "serve"],
      "env": {
        "MAGNETLAB_API_KEY": "ml_live_your_key_here"
      }
    }
  }
}
```

## Getting Your API Key

1. Log in to [MagnetLab](https://magnetlab.ai)
2. Go to **Settings > API Keys**
3. Click **Create API Key**
4. Copy the key (starts with `ml_live_`)

## Available Tools

| Category | Tools | What You Can Do |
|----------|------:|-----------------|
| Lead Magnets | 7 | List, create, delete, get stats, analyze competitors and transcripts |
| Ideation | 6 | Generate lead magnet ideas, extract and generate content, write LinkedIn posts, polish |
| Funnels | 9 | Create opt-in pages, customize copy/theme, publish/unpublish, AI-generate funnel content |
| Leads | 2 | List captured leads with filters, export as CSV |
| Analytics | 1 | Get per-funnel stats (views, leads, conversion rates) |
| Brand Kit | 3 | Get/update business context, extract context from raw text |
| Email Sequences | 4 | Generate AI welcome sequences, edit emails, activate drip campaigns |
| Content Pipeline | 34 | Transcripts, AI Brain knowledge base, content ideas, pipeline posts, autopilot, writing styles, templates, content planner, business context |
| Swipe File | 3 | Browse community posts and lead magnets, submit your own |
| Libraries | 7 | Create content libraries, manage items, gate behind funnels |
| Qualification Forms | 5 | Create forms with scoring questions, attach to funnels |
| **Total** | **81** | |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MAGNETLAB_API_KEY` | Yes | Your MagnetLab API key (starts with `ml_live_`) |
| `MAGNETLAB_BASE_URL` | No | Override the API base URL (default: `https://magnetlab.ai`) |

## CLI Usage

Start the MCP server (stdio transport):

```bash
# Using environment variable
MAGNETLAB_API_KEY=ml_live_xxx npx --package @magnetlab/mcp magnetlab-mcp serve

# Using --api-key flag
npx --package @magnetlab/mcp magnetlab-mcp serve --api-key ml_live_xxx

# With custom base URL
npx --package @magnetlab/mcp magnetlab-mcp serve --base-url http://localhost:3000
```

## Example Prompts

Once the MCP server is connected, try these in Claude:

**Lead magnets:**
- "List all my lead magnets"
- "Create a new lead magnet called 'LinkedIn Growth Playbook' with the focused-toolkit archetype"
- "What are the stats on my best-performing lead magnet?"

**Funnels:**
- "Create an opt-in page for my latest lead magnet with a dark theme"
- "Generate funnel copy for lead magnet [id]"
- "Publish my funnel and give me the live URL"

**Content pipeline:**
- "Search my AI Brain for insights about pricing objections"
- "Write a LinkedIn post about [topic]"
- "Show me my content buffer and what's scheduled this week"
- "Trigger autopilot to generate 5 new posts"

**Lead management:**
- "How many leads did I capture this month?"
- "Export all qualified leads as CSV"

**Brand kit:**
- "Extract my business context from this offer document: [paste text]"
- "Update my brand kit with these pain points: ..."

## License

MIT
