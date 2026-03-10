# AI Standards Learning Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automate feature handoff from AI-built experiment branches to developer review, and learn from developer fixes to improve coding standards.

**Architecture:** Two GitHub Actions + one Node script. Feature Handoff creates Linear issues when PRs are opened from `early-users/*`. Standards Review runs after merge, uses Claude Sonnet to analyze what the developer changed vs AI code, then creates Linear issues with findings and draft PRs with proposed rule updates.

**Tech Stack:** GitHub Actions, Node.js 20, Anthropic SDK (Claude Sonnet), Linear GraphQL API, GitHub REST API (via `@actions/github`)

---

### Task 1: Create the Feature Handoff Workflow

**Files:**
- Create: `.github/workflows/feature-handoff.yml`

**Step 1: Write the workflow file**

```yaml
name: Feature Handoff

on:
  pull_request:
    types: [opened]
    branches: [main]

jobs:
  handoff:
    name: Create Linear Issue
    runs-on: ubuntu-latest
    # Only run for PRs from early-users/* branches
    if: startsWith(github.head_ref, 'early-users/')

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check for Claude co-authored commits
        id: check-claude
        run: |
          CLAUDE_COMMITS=$(git log origin/main..HEAD --format="%H %s" | head -20)
          HAS_CLAUDE=$(git log origin/main..HEAD --format="%b" | grep -ci "Co-Authored-By.*Claude" || true)
          echo "has_claude=$HAS_CLAUDE" >> "$GITHUB_OUTPUT"
          echo "Found $HAS_CLAUDE Claude co-authored commits"

      - name: Extract PR context
        if: steps.check-claude.outputs.has_claude != '0'
        id: context
        run: |
          # Get commit summaries
          COMMITS=$(git log origin/main..HEAD --format="- %s" | head -20)
          echo "commits<<EOF" >> "$GITHUB_OUTPUT"
          echo "$COMMITS" >> "$GITHUB_OUTPUT"
          echo "EOF" >> "$GITHUB_OUTPUT"

          # Get changed files
          FILES=$(git diff --name-only origin/main...HEAD | head -30)
          echo "files<<EOF" >> "$GITHUB_OUTPUT"
          echo "$FILES" >> "$GITHUB_OUTPUT"
          echo "EOF" >> "$GITHUB_OUTPUT"

          # Check for design docs
          DOCS=$(git diff --name-only origin/main...HEAD | grep "docs/plans/" || true)
          echo "docs<<EOF" >> "$GITHUB_OUTPUT"
          echo "$DOCS" >> "$GITHUB_OUTPUT"
          echo "EOF" >> "$GITHUB_OUTPUT"

      - name: Create Linear issue
        if: steps.check-claude.outputs.has_claude != '0'
        env:
          LINEAR_API_KEY: ${{ secrets.LINEAR_API_KEY }}
        run: |
          TITLE="[AI Feature] ${{ github.event.pull_request.title }}"

          # Build description
          DESCRIPTION="## AI-Built Feature for Review

          **PR:** ${{ github.event.pull_request.html_url }}
          **Branch:** \`${{ github.head_ref }}\`
          **Author:** ${{ github.event.pull_request.user.login }}

          ### Commits
          ${{ steps.context.outputs.commits }}

          ### Key Files Changed
          \`\`\`
          ${{ steps.context.outputs.files }}
          \`\`\`

          ### Design Docs
          ${{ steps.context.outputs.docs }}

          ---
          *Auto-created by Feature Handoff workflow*"

          # Create Linear issue via GraphQL
          RESPONSE=$(curl -s -X POST https://api.linear.app/graphql \
            -H "Content-Type: application/json" \
            -H "Authorization: $LINEAR_API_KEY" \
            -d "{
              \"query\": \"mutation { issueCreate(input: { teamId: \\\"c7f962be-0a7e-470b-9d61-ccf0808aaa7d\\\", title: \\\"$TITLE\\\", description: $(echo "$DESCRIPTION" | jq -Rs .), projectId: \\\"43e6d56e-b1dc-43bd-8631-d99070bb942b\\\", labelIds: [\\\"23784952-472d-455a-a2bd-4cf7cdf95ea8\\\", \\\"2f30c1ef-0178-4d5b-9a3e-cd7713b4b07f\\\", \\\"46736281-ed8d-4f9d-8d2d-f6eb9d25a6a6\\\"] }) { success issue { identifier url } } }\"
            }")

          ISSUE_URL=$(echo "$RESPONSE" | jq -r '.data.issueCreate.issue.url // empty')
          ISSUE_ID=$(echo "$RESPONSE" | jq -r '.data.issueCreate.issue.identifier // empty')

          if [ -n "$ISSUE_URL" ]; then
            echo "Created Linear issue: $ISSUE_ID ($ISSUE_URL)"
            echo "issue_url=$ISSUE_URL" >> "$GITHUB_OUTPUT"
            echo "issue_id=$ISSUE_ID" >> "$GITHUB_OUTPUT"
          else
            echo "Failed to create Linear issue"
            echo "$RESPONSE" | jq .
            exit 1
          fi

      - name: Comment on PR
        if: steps.check-claude.outputs.has_claude != '0'
        uses: actions/github-script@v7
        with:
          script: |
            const issueUrl = '${{ steps.create-issue.outputs.issue_url }}';
            const issueId = '${{ steps.create-issue.outputs.issue_id }}';
            if (issueUrl) {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: `🔗 Linear issue created: [${issueId}](${issueUrl})\n\nThis PR contains AI-built code (Claude co-authored commits detected). A developer review issue has been created in the Experimental Feature Pipeline project.`
              });
            }
```

**Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/feature-handoff.yml'))" && echo "Valid YAML"`
Expected: "Valid YAML"

**Step 3: Commit**

```bash
git add .github/workflows/feature-handoff.yml
git commit -m "feat: add Feature Handoff GitHub Action

Creates Linear issue when PRs are opened from early-users/* branches
with Claude co-authored commits. Links PR to Experimental Feature Pipeline."
```

---

### Task 2: Create the Standards Analysis Script

**Files:**
- Create: `.github/scripts/analyze-standards.ts`
- Create: `.github/scripts/tsconfig.json`
- Create: `.github/scripts/package.json`

**Step 1: Create package.json for the script**

```json
{
  "name": "standards-analysis",
  "private": true,
  "type": "module",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@actions/github": "^6.0.0",
    "@actions/core": "^1.11.1"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^20.0.0"
  }
}
```

**Step 2: Create tsconfig.json for the script**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": ".",
    "skipLibCheck": true
  },
  "include": ["*.ts"]
}
```

**Step 3: Write the analysis script**

`.github/scripts/analyze-standards.ts`:

```typescript
/**
 * Standards Analysis Script
 * Analyzes developer changes to AI-built code, categorizes findings,
 * creates Linear issues and draft PRs with proposed rule updates.
 *
 * Runs as a GitHub Action step — reads context from environment variables.
 * Never imports from the main app codebase.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

// ─── Constants ─────────────────────────────────────────────────────────────────

const LINEAR_API_URL = 'https://api.linear.app/graphql';
const LINEAR_TEAM_ID = 'c7f962be-0a7e-470b-9d61-ccf0808aaa7d';
const LINEAR_PROJECT_ID = '43e6d56e-b1dc-43bd-8631-d99070bb942b';
const TRIAGE_STATE_ID = 'f2412f79-de1d-4cf5-a7ff-2e5f9308280a';

const LABELS = {
  standardsReview: 'da37046b-de12-4681-a4e5-e44ba4c0bb17',
  aiBuild: '23784952-472d-455a-a2bd-4cf7cdf95ea8',
  magnetlab: '46736281-ed8d-4f9d-8d2d-f6eb9d25a6a6',
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Finding {
  category: 'new_rule' | 'violated_rule' | 'style_preference' | 'bug_fix';
  description: string;
  file: string;
  aiCode: string;
  devCode: string;
  proposedRule: string | null;
}

interface AnalysisResult {
  findings: Finding[];
  summary: string;
  proposedAdditions: string[];
}

// ─── Diff Extraction ──────────────────────────────────────────────────────────

function extractDiff(): string {
  const prNumber = process.env.PR_NUMBER;
  const baseSha = process.env.BASE_SHA;
  const headSha = process.env.HEAD_SHA;

  if (!baseSha || !headSha) {
    throw new Error('BASE_SHA and HEAD_SHA environment variables required');
  }

  core.info(`Extracting diff: ${baseSha}..${headSha}`);

  // Get the diff of what was changed between the original AI commits and final merged code
  const diff = execSync(
    `git diff ${baseSha}..${headSha} -- '*.ts' '*.tsx' ':!*.test.ts' ':!*.test.tsx' ':!node_modules'`,
    { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 }
  );

  if (!diff.trim()) {
    core.info('No TypeScript changes found in diff');
    return '';
  }

  // Truncate very large diffs to stay within token limits
  const MAX_DIFF_CHARS = 50000;
  if (diff.length > MAX_DIFF_CHARS) {
    core.warning(`Diff truncated from ${diff.length} to ${MAX_DIFF_CHARS} chars`);
    return diff.slice(0, MAX_DIFF_CHARS) + '\n... (truncated)';
  }

  return diff;
}

// ─── Claude Analysis ──────────────────────────────────────────────────────────

async function analyzeWithClaude(
  diff: string,
  codingStandards: string,
  claudeMd: string
): Promise<AnalysisResult> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = `You are a coding standards analyst. You analyze diffs between AI-generated code and developer-refined code to identify patterns that should become coding standards.

You have access to:
1. The current coding standards document
2. The project CLAUDE.md
3. A diff showing what a developer changed after reviewing AI-generated code

Your job is to categorize each meaningful change into one of four categories:
- **new_rule**: Developer consistently does something that no existing rule covers. This should become a new rule.
- **violated_rule**: An existing rule was not followed by the AI. Flag for reinforcement.
- **style_preference**: Naming, structure, or formatting patterns. Only flag if 2+ instances.
- **bug_fix**: Logic errors the AI made. Note but don't propose a rule.

For each finding, provide:
- The category
- A description of what the developer changed and why
- The file path
- A brief snippet of the AI code vs developer code
- A proposed rule (for new_rule and style_preference only)

Respond in JSON format:
{
  "findings": [
    {
      "category": "new_rule" | "violated_rule" | "style_preference" | "bug_fix",
      "description": "What the developer changed and why",
      "file": "path/to/file.ts",
      "aiCode": "brief AI code snippet",
      "devCode": "brief developer code snippet",
      "proposedRule": "Proposed rule text or null"
    }
  ],
  "summary": "2-3 sentence summary of overall patterns",
  "proposedAdditions": ["Full rule text to add to coding-standards.md"]
}

Guidelines:
- Only flag MEANINGFUL changes. Ignore whitespace, import reordering, comment tweaks.
- Focus on patterns, not one-off fixes.
- Proposed rules should match the style of existing rules in the coding standards doc.
- Be conservative — only propose rules that clearly improve code quality.
- If the diff is small or the developer made no substantive changes, return empty findings.`;

  const userPrompt = `## Current Coding Standards

${codingStandards}

## Project CLAUDE.md (relevant sections)

${claudeMd}

## Diff (AI code → Developer-refined code)

\`\`\`diff
${diff}
\`\`\`

Analyze this diff and categorize the developer's changes. Respond with JSON only.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      { role: 'user', content: userPrompt },
    ],
    system: systemPrompt,
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  // Extract JSON from response (may be wrapped in markdown code block)
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from Claude response');
  }

  return JSON.parse(jsonMatch[1]) as AnalysisResult;
}

// ─── Linear Issue Creation ────────────────────────────────────────────────────

async function createLinearIssue(
  analysis: AnalysisResult,
  prUrl: string,
  prTitle: string
): Promise<{ id: string; identifier: string; url: string }> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error('LINEAR_API_KEY not set');

  const findingsTable = analysis.findings
    .map((f) => `| ${f.category} | ${f.description} | \`${f.file}\` |`)
    .join('\n');

  const proposedRules = analysis.proposedAdditions.length > 0
    ? `### Proposed Rule Additions\n\n${analysis.proposedAdditions.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
    : '_No new rules proposed._';

  const description = `## Standards Review: ${prTitle}

**PR:** ${prUrl}

### Summary
${analysis.summary}

### Findings

| Category | Description | File |
|----------|-------------|------|
${findingsTable || '| — | No findings | — |'}

${proposedRules}

---
*Auto-generated by Standards Review workflow*`;

  const title = `[Standards Review] ${prTitle}`;

  const mutation = `
    mutation CreateStandardsIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `;

  const res = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          teamId: LINEAR_TEAM_ID,
          title,
          description,
          projectId: LINEAR_PROJECT_ID,
          stateId: TRIAGE_STATE_ID,
          labelIds: [LABELS.standardsReview, LABELS.aiBuild, LABELS.magnetlab],
        },
      },
    }),
  });

  const data = await res.json();

  if (data.errors) {
    throw new Error(`Linear API error: ${JSON.stringify(data.errors)}`);
  }

  const issue = data.data?.issueCreate?.issue;
  if (!issue) {
    throw new Error('No issue returned from Linear');
  }

  core.info(`Created Linear issue: ${issue.identifier} (${issue.url})`);
  return issue;
}

// ─── Draft PR Creation ────────────────────────────────────────────────────────

async function createDraftPR(
  analysis: AnalysisResult,
  prTitle: string,
  linearIssueUrl: string
): Promise<string | null> {
  if (analysis.proposedAdditions.length === 0) {
    core.info('No proposed additions — skipping draft PR');
    return null;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not set');

  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;

  // Create a new branch
  const branchName = `standards-update/${Date.now()}`;
  const mainRef = await octokit.rest.git.getRef({ owner, repo, ref: 'heads/main' });
  const mainSha = mainRef.data.object.sha;

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: mainSha,
  });

  // Read current coding standards
  const standardsPath = 'docs/coding-standards.md';
  const { data: fileData } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path: standardsPath,
    ref: 'main',
  });

  if (!('content' in fileData)) {
    throw new Error('Could not read coding-standards.md');
  }

  const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

  // Append proposed rules
  const additions = analysis.proposedAdditions
    .map((rule) => `- ${rule}`)
    .join('\n');

  const newContent = currentContent.trimEnd() + `\n\n\n## Proposed Rules (Auto-Generated)\n\n> These rules were proposed by the Standards Review workflow based on developer changes.\n> Review and move to the appropriate section above, then delete this section.\n\n${additions}\n`;

  // Update file on new branch
  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: standardsPath,
    message: `chore: propose coding standards updates from review`,
    content: Buffer.from(newContent).toString('base64'),
    sha: fileData.sha,
    branch: branchName,
  });

  // Create draft PR
  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: `[Standards Update] From: ${prTitle}`,
    body: `## Proposed Coding Standards Updates

Based on developer changes in the merged PR, the following rule updates are proposed:

${analysis.proposedAdditions.map((r, i) => `${i + 1}. ${r}`).join('\n')}

### Summary
${analysis.summary}

**Linear Issue:** ${linearIssueUrl}

---
*Auto-generated by Standards Review workflow. Review, edit, and merge manually.*`,
    head: branchName,
    base: 'main',
    draft: true,
  });

  core.info(`Created draft PR: ${pr.html_url}`);
  return pr.html_url;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  try {
    // Read current standards files
    const codingStandards = existsSync('docs/coding-standards.md')
      ? readFileSync('docs/coding-standards.md', 'utf-8')
      : '';
    const claudeMd = existsSync('CLAUDE.md')
      ? readFileSync('CLAUDE.md', 'utf-8')
      : '';

    if (!codingStandards) {
      core.warning('No docs/coding-standards.md found — skipping analysis');
      return;
    }

    // Extract diff
    const diff = extractDiff();
    if (!diff) {
      core.info('No meaningful diff — skipping analysis');
      return;
    }

    core.info(`Analyzing ${diff.length} chars of diff...`);

    // Analyze with Claude
    const analysis = await analyzeWithClaude(diff, codingStandards, claudeMd);
    core.info(`Analysis complete: ${analysis.findings.length} findings`);

    if (analysis.findings.length === 0) {
      core.info('No findings — developer changes were minimal or non-substantive');
      return;
    }

    // Create Linear issue
    const prUrl = process.env.PR_URL || '';
    const prTitle = process.env.PR_TITLE || 'Unknown PR';
    const linearIssue = await createLinearIssue(analysis, prUrl, prTitle);

    // Create draft PR if there are proposed additions
    const draftPrUrl = await createDraftPR(analysis, prTitle, linearIssue.url);

    // Output results
    core.setOutput('linear_issue_url', linearIssue.url);
    core.setOutput('linear_issue_id', linearIssue.identifier);
    core.setOutput('findings_count', analysis.findings.length);
    core.setOutput('draft_pr_url', draftPrUrl || '');

    core.info('Standards review complete!');
    core.info(`  Linear issue: ${linearIssue.identifier}`);
    core.info(`  Findings: ${analysis.findings.length}`);
    if (draftPrUrl) {
      core.info(`  Draft PR: ${draftPrUrl}`);
    }
  } catch (error) {
    core.setFailed(`Standards analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

main();
```

**Step 4: Commit**

```bash
git add .github/scripts/
git commit -m "feat: add standards analysis script

Node script that uses Claude Sonnet to analyze developer changes to AI code,
categorizes findings, creates Linear issues, and opens draft PRs."
```

---

### Task 3: Create the Standards Review Workflow

**Files:**
- Create: `.github/workflows/standards-review.yml`

**Step 1: Write the workflow file**

```yaml
name: Standards Review

on:
  pull_request:
    types: [closed]
    branches: [main]

jobs:
  review:
    name: Analyze Standards
    runs-on: ubuntu-latest
    # Only run on merged PRs from early-users/* branches
    if: >
      github.event.pull_request.merged == true &&
      startsWith(github.event.pull_request.head.ref, 'early-users/')

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check for Claude co-authored commits
        id: check-claude
        run: |
          HAS_CLAUDE=$(git log ${{ github.event.pull_request.base.sha }}..${{ github.event.pull_request.merge_commit_sha }} --format="%b" | grep -ci "Co-Authored-By.*Claude" || true)
          echo "has_claude=$HAS_CLAUDE" >> "$GITHUB_OUTPUT"
          echo "Found $HAS_CLAUDE Claude co-authored commits"

      - name: Setup Node.js
        if: steps.check-claude.outputs.has_claude != '0'
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install script dependencies
        if: steps.check-claude.outputs.has_claude != '0'
        working-directory: .github/scripts
        run: npm install

      - name: Build script
        if: steps.check-claude.outputs.has_claude != '0'
        working-directory: .github/scripts
        run: npx tsc

      - name: Run standards analysis
        if: steps.check-claude.outputs.has_claude != '0'
        working-directory: .github/scripts
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY_STANDARDS }}
          LINEAR_API_KEY: ${{ secrets.LINEAR_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.merge_commit_sha }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          PR_URL: ${{ github.event.pull_request.html_url }}
          PR_TITLE: ${{ github.event.pull_request.title }}
        run: node dist/analyze-standards.js

      - name: Post results to PR
        if: steps.check-claude.outputs.has_claude != '0'
        uses: actions/github-script@v7
        with:
          script: |
            const findingsCount = '${{ steps.run-analysis.outputs.findings_count }}';
            const linearUrl = '${{ steps.run-analysis.outputs.linear_issue_url }}';
            const draftPrUrl = '${{ steps.run-analysis.outputs.draft_pr_url }}';

            if (findingsCount && findingsCount !== '0') {
              let body = `## 📊 Standards Review Complete\n\n`;
              body += `**Findings:** ${findingsCount} patterns identified\n`;
              body += `**Linear Issue:** ${linearUrl}\n`;
              if (draftPrUrl) {
                body += `**Standards Update PR:** ${draftPrUrl}\n`;
              }
              body += `\n---\n*Auto-generated by Standards Review workflow*`;

              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: ${{ github.event.pull_request.number }},
                body
              });
            }
```

**Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/standards-review.yml'))" && echo "Valid YAML"`
Expected: "Valid YAML"

**Step 3: Commit**

```bash
git add .github/workflows/standards-review.yml
git commit -m "feat: add Standards Review GitHub Action

Runs after PRs from early-users/* merge to main. If Claude co-authored
commits are found, analyzes developer changes with Claude Sonnet and
creates Linear issues + draft PRs with proposed coding standards updates."
```

---

### Task 4: Test the Analysis Script Locally

**Step 1: Install dependencies**

Run: `cd .github/scripts && npm install`
Expected: Packages installed successfully

**Step 2: Build the script**

Run: `cd .github/scripts && npx tsc`
Expected: Compiles with no errors

**Step 3: Verify the compiled output exists**

Run: `ls -la .github/scripts/dist/analyze-standards.js`
Expected: File exists

**Step 4: Add dist/ to .gitignore**

Add `.github/scripts/dist/` to `.gitignore` (if not already present).

**Step 5: Commit**

```bash
git add .github/scripts/package-lock.json .gitignore
git commit -m "chore: add script lockfile and gitignore dist"
```

---

### Task 5: Update CLAUDE.md with Learning Loop Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add Learning Loop section to CLAUDE.md**

Add the following section after the "Enhanced Page Builder" section:

```markdown
## AI Standards Learning Loop (Mar 2026)

Automated workflow for AI-to-developer feature handoff and coding standards improvement.

### How It Works

1. **Feature Handoff** — When a PR is opened from `early-users/*` to `main` with Claude co-authored commits, a Linear issue is auto-created in the "Experimental Feature Pipeline" project
2. **Standards Review** — When that PR is merged, Claude Sonnet analyzes the diff between AI code and developer-refined code, categorizes findings, creates a Linear issue, and opens a draft PR proposing coding standards updates

### Key Files

| File | Purpose |
|------|---------|
| `.github/workflows/feature-handoff.yml` | PR opened → Linear issue creation |
| `.github/workflows/standards-review.yml` | PR merged → diff analysis trigger |
| `.github/scripts/analyze-standards.ts` | Claude Sonnet analysis + Linear + draft PR |

### Linear Configuration

- **Project:** Experimental Feature Pipeline (`43e6d56e-b1dc-43bd-8631-d99070bb942b`)
- **Labels:** `ai-built`, `needs-dev-review`, `standards-review`, `magnetlab`

### GitHub Secrets

- `ANTHROPIC_API_KEY_STANDARDS` — Dedicated workspace key (spend-limited)
- `LINEAR_API_KEY` — For creating issues
```

**Step 2: Add to Feature Documentation table**

Add row: `| AI Standards Learning Loop | [docs/plans/2026-03-09-standards-learning-loop-design.md](docs/plans/2026-03-09-standards-learning-loop-design.md) |`

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add AI Standards Learning Loop to CLAUDE.md"
```

---

### Task 6: Final Integration Test

**Step 1: Verify all files exist**

Run:
```bash
ls -la .github/workflows/feature-handoff.yml .github/workflows/standards-review.yml .github/scripts/analyze-standards.ts .github/scripts/package.json .github/scripts/tsconfig.json
```
Expected: All 5 files present

**Step 2: Validate both workflow YAML files**

Run:
```bash
python3 -c "
import yaml
for f in ['.github/workflows/feature-handoff.yml', '.github/workflows/standards-review.yml']:
    yaml.safe_load(open(f))
    print(f'{f}: valid')
"
```
Expected: Both files valid

**Step 3: Verify script compiles**

Run: `cd .github/scripts && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit any remaining changes**

```bash
git add -A
git status
# Only commit if there are changes
```
