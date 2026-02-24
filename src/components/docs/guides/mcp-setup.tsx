'use client';

import Link from 'next/link';

export default function McpSetup() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Create Pages with Claude</h1>
      <p className="text-muted-foreground mb-8">
        Use the MagnetLab MCP server to create landing pages, manage leads, and run your content
        pipeline directly from Claude.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">What is MCP?</h2>
      <p className="text-sm mb-4">
        Model Context Protocol (MCP) lets AI assistants like Claude interact with external tools.
        With the MagnetLab MCP server, you can ask Claude to create lead magnets, build funnels,
        publish pages, manage leads, and more &mdash; all from a conversation.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Step 1: Get Your API Key</h2>
      <ol className="list-decimal list-inside space-y-3 text-sm">
        <li>
          Go to{' '}
          <Link href="/settings" className="text-violet-600 dark:text-violet-400 hover:underline">
            Settings
          </Link>{' '}
          &rarr; <strong>API Keys</strong>
        </li>
        <li>
          Click <strong>Create API Key</strong>
        </li>
        <li>
          Give it a name (e.g., &ldquo;Claude MCP&rdquo;)
        </li>
        <li>
          Copy the key &mdash; it starts with{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">ml_live_</code> and is
          only shown once
        </li>
      </ol>

      <h2 className="text-xl font-semibold mt-8 mb-4">Step 2: Add to Claude</h2>

      <h3 className="text-lg font-medium mt-6 mb-3">Claude Code</h3>
      <p className="text-sm mb-2">
        Run this command in your terminal:
      </p>
      <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto my-4">
{`claude mcp add magnetlab -e MAGNETLAB_API_KEY=ml_live_your_key_here -- npx -y --package @magnetlab/mcp magnetlab-mcp serve`}
      </pre>
      <p className="text-sm text-muted-foreground">
        Then restart Claude Code.
      </p>

      <h3 className="text-lg font-medium mt-6 mb-3">Claude Desktop</h3>
      <p className="text-sm mb-2">
        Add to your{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
          claude_desktop_config.json
        </code>
        :
      </p>
      <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto my-4">
{`{
  "mcpServers": {
    "magnetlab": {
      "command": "npx",
      "args": ["-y", "--package", "@magnetlab/mcp", "magnetlab-mcp", "serve"],
      "env": {
        "MAGNETLAB_API_KEY": "ml_live_your_key_here"
      }
    }
  }
}`}
      </pre>

      <h2 className="text-xl font-semibold mt-8 mb-4">Step 3: Try It</h2>
      <p className="text-sm mb-4">Once connected, try these prompts:</p>
      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>
            &ldquo;Create a landing page called &lsquo;Free SEO Audit Checklist&rsquo;&rdquo;
          </li>
          <li>&ldquo;List my funnels and show me their stats&rdquo;</li>
          <li>&ldquo;Publish my latest funnel and give me the live URL&rdquo;</li>
          <li>&ldquo;Show me my leads from the last 7 days&rdquo;</li>
          <li>&ldquo;Generate an email sequence for my lead magnet&rdquo;</li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">What Can You Do?</h2>
      <p className="text-sm mb-4">
        The MCP server gives Claude access to 81 tools across 11 categories. See the full list in
        the{' '}
        <Link
          href="/docs/mcp-tools"
          className="text-violet-600 dark:text-violet-400 hover:underline"
        >
          MCP Tool Reference
        </Link>
        .
      </p>
      <p className="text-sm">
        For real-world examples of what you can build, see{' '}
        <Link
          href="/docs/mcp-workflows"
          className="text-violet-600 dark:text-violet-400 hover:underline"
        >
          Example Workflows &rarr;
        </Link>
      </p>
    </div>
  );
}
