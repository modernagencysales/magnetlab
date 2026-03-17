<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## AI Standards Learning Loop

Automated GitHub Actions workflow that tracks AI-built features from experiment branches through developer review, then analyzes what the developer changed to improve coding standards over time.

### How It Works

Two GitHub Actions fire on PRs between `early-users/*` and `main`:

| Trigger | Action | Output |
|---------|--------|--------|
| PR **opened** from `early-users/*` | Feature Handoff | Linear issue in Experimental Feature Pipeline + PR comment |
| PR **merged** from `early-users/*` (with Claude co-authored commits) | Standards Review | Claude Sonnet diff analysis → Linear issue + draft PR to `docs/coding-standards.md` |

### Feature Handoff Flow

1. PR opened targeting `main` from `early-users/*`
2. Workflow scans commits for `Co-Authored-By: Claude`
3. Extracts context: commit summaries, changed files, design docs
4. Creates Linear issue with `ai-built` + `needs-dev-review` labels
5. Comments on PR with Linear issue link

### Standards Review Flow

1. PR merged to `main` from `early-users/*`
2. Workflow checks for Claude co-authored commits
3. Extracts diff between base SHA and merge commit (TypeScript files only, excludes tests)
4. Sends diff + current `docs/coding-standards.md` + `CLAUDE.md` to Claude Sonnet
5. Claude categorizes developer changes into:
   - **New rules** — developer does X consistently, no existing rule covers it
   - **Violated rules** — rule exists, AI didn't follow it
   - **Style preferences** — naming/structure patterns (only if 2+ instances)
   - **Bug fixes** — logic errors (noted, not a standards issue)
6. Creates Linear issue tagged `standards-review` with categorized findings table
7. Opens draft PR appending proposed rules to `docs/coding-standards.md`

### Linear Configuration

| Resource | ID |
|----------|----|
| Project: Experimental Feature Pipeline | `43e6d56e-b1dc-43bd-8631-d99070bb942b` |
| Label: `ai-built` | `23784952-472d-455a-a2bd-4cf7cdf95ea8` |
| Label: `needs-dev-review` | `2f30c1ef-0178-4d5b-9a3e-cd7713b4b07f` |
| Label: `standards-review` | `da37046b-de12-4681-a4e5-e44ba4c0bb17` |
| Label: `magnetlab` | `46736281-ed8d-4f9d-8d2d-f6eb9d25a6a6` |

### GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `ANTHROPIC_API_KEY_STANDARDS` | Dedicated spend-limited workspace key for Sonnet analysis |
| `LINEAR_API_KEY` | Creates issues in Experimental Feature Pipeline project |

### Key Files

- `.github/workflows/feature-handoff.yml` — PR opened trigger, Linear issue creation, PR comment
- `.github/workflows/standards-review.yml` — PR merged trigger, script orchestration
- `.github/scripts/analyze-standards.ts` — Claude Sonnet analysis, Linear issue, draft PR creation
- `.github/scripts/package.json` — Script dependencies (@anthropic-ai/sdk, @actions/github, @actions/core)
- `docs/coding-standards.md` — Target file for proposed rule additions

### Cost

- Feature Handoff: free (no API calls, just Linear GraphQL + GitHub API)
- Standards Review: ~$0.50–2 per analysis (Claude Sonnet on spend-limited workspace)

### Constraints

- Standards PRs require human review (no auto-merge)
- Forward-looking only (no retroactive analysis of old PRs)
- Analysis only fires on PRs with Claude co-authored commits
- Diff truncated at 50,000 characters to stay within token limits
- Draft PR appends a "Proposed Rules" section — human must review and move rules to the right place
