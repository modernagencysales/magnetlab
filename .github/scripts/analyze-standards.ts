/**
 * Standards Analysis Script.
 *
 * Analyzes PR diffs against coding standards using Claude, then:
 * 1. Creates a Linear issue with categorized findings
 * 2. Opens a draft PR proposing new rules for docs/coding-standards.md
 *
 * Constraint: Never writes to stdout directly -- uses @actions/core for all logging.
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import * as github from '@actions/github';
import * as core from '@actions/core';

// ─── Constants ─────────────────────────────────────────────────────────────────

const LINEAR_API_URL = 'https://api.linear.app/graphql';
const LINEAR_TEAM_ID = 'c7f962be-0a7e-470b-9d61-ccf0808aaa7d';
const LINEAR_PROJECT_ID = '43e6d56e-b1dc-43bd-8631-d99070bb942b';
const TRIAGE_STATE_ID = 'f2412f79-de1d-4cf5-a7ff-2e5f9308280a';

const LABEL_IDS = {
  standardsReview: 'da37046b-de12-4681-a4e5-e44ba4c0bb17',
  aiBuild: '23784952-472d-455a-a2bd-4cf7cdf95ea8',
  magnetlab: '46736281-ed8d-4f9d-8d2d-f6eb9d25a6a6',
} as const;

const MAX_DIFF_SIZE = 50_000;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const CODING_STANDARDS_PATH = 'docs/coding-standards.md';

// ─── Types ─────────────────────────────────────────────────────────────────────

type FindingCategory = 'new_rule' | 'violated_rule' | 'style_preference' | 'bug_fix';

interface Finding {
  category: FindingCategory;
  file: string;
  line: number | null;
  description: string;
  suggestedRule: string | null;
}

interface AnalysisResult {
  findings: Finding[];
  summary: string;
  proposedAdditions: string[];
}

interface EnvConfig {
  anthropicApiKey: string;
  linearApiKey: string;
  githubToken: string;
  baseSha: string;
  headSha: string;
  prNumber: string;
  prUrl: string;
  prTitle: string;
}

// ─── Diff Extraction ───────────────────────────────────────────────────────────

function extractDiff(baseSha: string, headSha: string): string {
  core.info(`Extracting diff between ${baseSha} and ${headSha}`);

  let diff: string;
  try {
    diff = execSync(
      `git diff ${baseSha}..${headSha} -- '*.ts' '*.tsx' ':!*.test.ts' ':!*.test.tsx' ':!*.spec.ts' ':!*.spec.tsx'`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (err) {
    throw Object.assign(
      new Error(`Failed to extract git diff: ${err instanceof Error ? err.message : String(err)}`),
      {
        step: 'extractDiff',
      }
    );
  }

  if (!diff.trim()) {
    core.warning('No TypeScript file changes found in diff');
    return '';
  }

  if (diff.length > MAX_DIFF_SIZE) {
    core.warning(`Diff exceeds ${MAX_DIFF_SIZE} chars (${diff.length}). Truncating.`);
    diff =
      diff.slice(0, MAX_DIFF_SIZE) +
      '\n\n[... TRUNCATED — diff exceeded 50,000 character limit ...]';
  }

  core.info(`Extracted diff: ${diff.length} characters`);
  return diff;
}

// ─── Claude Analysis ──────────────────────────────────────────────────────────

async function analyzeWithClaude(
  diff: string,
  codingStandards: string,
  claudeMd: string,
  apiKey: string,
  prTitle: string
): Promise<AnalysisResult> {
  core.info('Sending diff to Claude for analysis');

  const anthropic = new Anthropic({ apiKey });

  const systemPrompt = `You are a senior code reviewer analyzing a PR diff against established coding standards.

Your job is to categorize every notable change into one of these categories:
- **new_rule**: A pattern the developer introduced that is NOT covered by existing standards but SHOULD be adopted as a rule.
- **violated_rule**: A change that violates an existing coding standard.
- **style_preference**: A stylistic choice that is consistent but not yet codified (could become a rule).
- **bug_fix**: A change that fixes a bug or addresses an edge case (not a standards issue).

Respond with ONLY valid JSON matching this schema:
{
  "findings": [
    {
      "category": "new_rule" | "violated_rule" | "style_preference" | "bug_fix",
      "file": "path/to/file.ts",
      "line": 42,
      "description": "What the developer did and why it matters",
      "suggestedRule": "If category is new_rule or style_preference, propose a concise rule. Otherwise null."
    }
  ],
  "summary": "2-3 sentence overview of the PR's standards impact",
  "proposedAdditions": [
    "Each string is a rule statement ready to append to coding-standards.md"
  ]
}

Rules for analysis:
- Only flag things that are genuinely important for team consistency
- Do not flag trivial formatting or personal preference
- For violated_rule, cite which specific standard is violated
- For new_rule, explain why this pattern improves code quality
- proposedAdditions should only include rules from new_rule and strong style_preference findings
- If there are no findings, return empty arrays and a summary saying "No notable standards findings"`;

  const userPrompt = `## PR Title
${prTitle}

## Current Coding Standards (docs/coding-standards.md)
${codingStandards || '(No coding standards file found — all patterns are potential new rules)'}

## Project Standards (CLAUDE.md — Code Standards section)
${claudeMd}

## PR Diff (TypeScript files only, excluding tests)
\`\`\`diff
${diff}
\`\`\`

Analyze this diff against the standards above. Respond with JSON only.`;

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
  } catch (err) {
    throw Object.assign(
      new Error(`Claude API call failed: ${err instanceof Error ? err.message : String(err)}`),
      { step: 'analyzeWithClaude' }
    );
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw Object.assign(new Error('Claude returned no text content'), {
      step: 'analyzeWithClaude',
    });
  }

  let parsed: AnalysisResult;
  try {
    const jsonText = textBlock.text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    parsed = JSON.parse(jsonText) as AnalysisResult;
  } catch (err) {
    throw Object.assign(
      new Error(
        `Failed to parse Claude response as JSON: ${err instanceof Error ? err.message : String(err)}`
      ),
      { step: 'analyzeWithClaude', rawResponse: textBlock.text }
    );
  }

  core.info(
    `Analysis complete: ${parsed.findings.length} findings, ${parsed.proposedAdditions.length} proposed rules`
  );
  return parsed;
}

// ─── Linear Issue Creation ─────────────────────────────────────────────────────

async function createLinearIssue(
  analysis: AnalysisResult,
  prUrl: string,
  prTitle: string,
  linearApiKey: string
): Promise<string> {
  core.info('Creating Linear issue for standards review');

  const findingsTable =
    analysis.findings.length > 0
      ? [
          '| Category | File | Line | Description | Suggested Rule |',
          '|----------|------|------|-------------|----------------|',
          ...analysis.findings.map(
            (f) =>
              `| ${f.category} | \`${f.file}\` | ${f.line ?? '—'} | ${f.description} | ${f.suggestedRule ?? '—'} |`
          ),
        ].join('\n')
      : '_No findings._';

  const proposedSection =
    analysis.proposedAdditions.length > 0
      ? `## Proposed Additions to Coding Standards\n\n${analysis.proposedAdditions.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
      : '';

  const description = [
    `## Standards Analysis for PR`,
    `**PR:** [${prTitle}](${prUrl})`,
    '',
    `### Summary`,
    analysis.summary,
    '',
    `### Findings`,
    findingsTable,
    '',
    proposedSection,
    '',
    '---',
    '_Auto-generated by standards-analysis pipeline._',
  ]
    .filter(Boolean)
    .join('\n');

  const mutation = `
    mutation CreateIssue($input: IssueCreateInput!) {
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

  const variables = {
    input: {
      title: `[Standards Review] ${prTitle}`,
      description,
      teamId: LINEAR_TEAM_ID,
      projectId: LINEAR_PROJECT_ID,
      stateId: TRIAGE_STATE_ID,
      labelIds: [LABEL_IDS.standardsReview, LABEL_IDS.aiBuild, LABEL_IDS.magnetlab],
    },
  };

  let responseData: {
    data?: {
      issueCreate?: {
        success: boolean;
        issue?: { id: string; identifier: string; url: string };
      };
    };
    errors?: Array<{ message: string }>;
  };

  try {
    const res = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: linearApiKey,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });

    if (!res.ok) {
      throw Object.assign(new Error(`Linear API returned ${res.status}: ${res.statusText}`), {
        step: 'createLinearIssue',
      });
    }

    responseData = await res.json();
  } catch (err) {
    if (err instanceof Error && 'step' in err) throw err;
    throw Object.assign(
      new Error(`Linear API request failed: ${err instanceof Error ? err.message : String(err)}`),
      { step: 'createLinearIssue' }
    );
  }

  if (responseData.errors?.length) {
    throw Object.assign(
      new Error(`Linear GraphQL errors: ${responseData.errors.map((e) => e.message).join(', ')}`),
      { step: 'createLinearIssue' }
    );
  }

  const issue = responseData.data?.issueCreate?.issue;
  if (!issue) {
    throw Object.assign(new Error('Linear issue creation returned no issue data'), {
      step: 'createLinearIssue',
    });
  }

  core.info(`Created Linear issue: ${issue.identifier} (${issue.url})`);
  return issue.url;
}

// ─── Draft PR Creation ─────────────────────────────────────────────────────────

async function createDraftPR(
  analysis: AnalysisResult,
  githubToken: string,
  prNumber: string
): Promise<string> {
  core.info('Creating draft PR with proposed standards updates');

  const octokit = github.getOctokit(githubToken);
  const { owner, repo } = github.context.repo;
  const branchName = `standards-update/${Date.now()}`;

  const defaultBranchRes = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = defaultBranchRes.data.default_branch;

  const refRes = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` });
  const baseSha = refRes.data.object.sha;

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  core.info(`Created branch: ${branchName}`);

  let existingContent = '';
  let existingSha: string | undefined;
  try {
    const fileRes = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: CODING_STANDARDS_PATH,
      ref: branchName,
    });

    if ('content' in fileRes.data && typeof fileRes.data.content === 'string') {
      existingContent = Buffer.from(fileRes.data.content, 'base64').toString('utf-8');
      existingSha = fileRes.data.sha;
    }
  } catch {
    core.info(`${CODING_STANDARDS_PATH} does not exist yet — will create it`);
  }

  const proposedSection = [
    '',
    '## Proposed Rules (Auto-Generated)',
    '',
    `> From PR #${prNumber} — review and merge manually.`,
    '',
    ...analysis.proposedAdditions.map((rule, i) => `${i + 1}. ${rule}`),
    '',
  ].join('\n');

  const updatedContent = existingContent
    ? existingContent.trimEnd() + '\n' + proposedSection
    : `# Coding Standards\n${proposedSection}`;

  const commitParams: {
    owner: string;
    repo: string;
    path: string;
    message: string;
    content: string;
    branch: string;
    sha?: string;
  } = {
    owner,
    repo,
    path: CODING_STANDARDS_PATH,
    message: `chore: propose standards updates from PR #${prNumber}`,
    content: Buffer.from(updatedContent).toString('base64'),
    branch: branchName,
  };

  if (existingSha) {
    commitParams.sha = existingSha;
  }

  await octokit.rest.repos.createOrUpdateFileContents(commitParams);

  const prRes = await octokit.rest.pulls.create({
    owner,
    repo,
    title: `[Standards] Proposed rules from PR #${prNumber}`,
    body: [
      '## Auto-Generated Standards Proposal',
      '',
      `Triggered by PR #${prNumber}.`,
      '',
      '### Proposed Additions',
      '',
      ...analysis.proposedAdditions.map((rule, i) => `${i + 1}. ${rule}`),
      '',
      '---',
      '_Review each rule. Merge what makes sense, close what does not._',
    ].join('\n'),
    head: branchName,
    base: defaultBranch,
    draft: true,
  });

  core.info(`Created draft PR: ${prRes.data.html_url}`);
  return prRes.data.html_url;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function loadEnv(): EnvConfig {
  const required: Array<[keyof EnvConfig, string]> = [
    ['anthropicApiKey', 'ANTHROPIC_API_KEY'],
    ['linearApiKey', 'LINEAR_API_KEY'],
    ['githubToken', 'GITHUB_TOKEN'],
    ['baseSha', 'BASE_SHA'],
    ['headSha', 'HEAD_SHA'],
    ['prNumber', 'PR_NUMBER'],
    ['prUrl', 'PR_URL'],
    ['prTitle', 'PR_TITLE'],
  ];

  const config: Record<string, string> = {};
  const missing: string[] = [];

  for (const [key, envVar] of required) {
    const value = process.env[envVar];
    if (!value) {
      missing.push(envVar);
    } else {
      config[key] = value;
    }
  }

  if (missing.length > 0) {
    throw Object.assign(
      new Error(`Missing required environment variables: ${missing.join(', ')}`),
      { step: 'loadEnv' }
    );
  }

  return config as unknown as EnvConfig;
}

async function main(): Promise<void> {
  core.info('Starting standards analysis');

  const env = loadEnv();

  // Extract diff
  const diff = extractDiff(env.baseSha, env.headSha);
  if (!diff) {
    core.info('No TypeScript changes to analyze. Exiting.');
    return;
  }

  // Load reference documents
  let codingStandards = '';
  const standardsPath = `${process.cwd()}/${CODING_STANDARDS_PATH}`;
  if (existsSync(standardsPath)) {
    codingStandards = readFileSync(standardsPath, 'utf-8');
    core.info(`Loaded ${CODING_STANDARDS_PATH} (${codingStandards.length} chars)`);
  } else {
    core.warning(
      `${CODING_STANDARDS_PATH} not found — all patterns will be treated as potential new rules`
    );
  }

  let claudeMd = '';
  const claudeMdPath = `${process.cwd()}/CLAUDE.md`;
  if (existsSync(claudeMdPath)) {
    claudeMd = readFileSync(claudeMdPath, 'utf-8');
    core.info(`Loaded CLAUDE.md (${claudeMd.length} chars)`);
  } else {
    core.warning('CLAUDE.md not found');
  }

  // Analyze with Claude
  const analysis = await analyzeWithClaude(
    diff,
    codingStandards,
    claudeMd,
    env.anthropicApiKey,
    env.prTitle
  );

  if (analysis.findings.length === 0 && analysis.proposedAdditions.length === 0) {
    core.info('No standards findings or proposed rules. Exiting.');
    core.setOutput('findings_count', '0');
    core.setOutput('proposed_rules_count', '0');
    return;
  }

  // Create Linear issue
  const linearUrl = await createLinearIssue(analysis, env.prUrl, env.prTitle, env.linearApiKey);
  core.setOutput('linear_issue_url', linearUrl);

  // Create draft PR (only if there are proposed additions)
  if (analysis.proposedAdditions.length > 0) {
    const draftPrUrl = await createDraftPR(analysis, env.githubToken, env.prNumber);
    core.setOutput('draft_pr_url', draftPrUrl);
  } else {
    core.info('No proposed additions — skipping draft PR creation');
  }

  // Output summary
  core.setOutput('findings_count', String(analysis.findings.length));
  core.setOutput('proposed_rules_count', String(analysis.proposedAdditions.length));
  core.info(
    `Standards analysis complete. ${analysis.findings.length} findings, ${analysis.proposedAdditions.length} proposed rules.`
  );
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  const step =
    err instanceof Error && 'step' in err ? (err as Error & { step: string }).step : 'unknown';
  core.setFailed(`Standards analysis failed at step "${step}": ${message}`);
  process.exit(1);
});
