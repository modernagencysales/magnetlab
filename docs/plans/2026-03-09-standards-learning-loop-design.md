# AI Standards Learning Loop — Design

## Problem

AI-built features on experiments branches go through developer review before merging to main. The developer's fixes and refinements contain valuable signal about what the AI gets wrong, but this knowledge is lost — it doesn't feed back into the coding standards that guide future AI work.

## Solution

Two GitHub Actions that automate the handoff and learning loop:
1. **Feature Handoff** — auto-creates Linear issues when PRs are opened from experiments branches
2. **Standards Review** — analyzes what the developer changed after merge, proposes rule updates

## Action 1: Feature Handoff (`feature-handoff.yml`)

- **Trigger:** PR opened targeting `main` from `early-users/*`
- **What it does:**
  - Scans commits for `Co-Authored-By: Claude` to confirm AI-built
  - Extracts summary from commit messages + changed `docs/plans/*.md` files
  - Creates Linear issue in "Experimental Feature Pipeline" project with: commit range, key files, design doc link, PR link
  - Labels: `ai-built`, `needs-dev-review`, `magnetlab`
  - Comments on the PR with Linear issue link
- **Cost:** Free (no API calls)

## Action 2: Standards Review (`standards-review.yml`)

- **Trigger:** PR merged to `main` from `early-users/*` with Claude co-authored commits
- **What it does:**
  1. Extracts diff between AI-authored commits and final merged code
  2. Sends to Claude Sonnet with current `docs/coding-standards.md` and `CLAUDE.md`
  3. Claude categorizes developer changes into:
     - **New rules** — developer does X consistently, no existing rule covers it → proposed addition
     - **Violated rules** — rule exists, AI didn't follow it → flagged for reinforcement
     - **Style preferences** — naming, structure patterns → proposed addition if 2+ instances
     - **Bug fixes** — logic errors, noted but not a standards issue
  4. Creates Linear issue tagged `standards-review` with categorized findings
  5. Opens draft PR adding proposed rules (categories 1 and 3) to `docs/coding-standards.md`
- **Cost:** ~$0.50-2 per analysis (Sonnet on limited-spend workspace)

## Architecture

```
.github/
├── workflows/
│   ├── feature-handoff.yml       (new — PR opened)
│   └── standards-review.yml      (new — PR merged)
└── scripts/
    └── analyze-standards.ts      (new — diff analysis + Linear + PR creation)
```

## Linear Configuration

- **Project:** "Experimental Feature Pipeline" (`43e6d56e-b1dc-43bd-8631-d99070bb942b`)
- **Team:** `c7f962be-0a7e-470b-9d61-ccf0808aaa7d`
- **Labels:**
  - `ai-built` (`23784952-472d-455a-a2bd-4cf7cdf95ea8`) — purple
  - `needs-dev-review` (`2f30c1ef-0178-4d5b-9a3e-cd7713b4b07f`) — amber
  - `standards-review` (`da37046b-de12-4681-a4e5-e44ba4c0bb17`) — green
  - `magnetlab` (`46736281-ed8d-4f9d-8d2d-f6eb9d25a6a6`) — existing

## GitHub Secrets Required

- `ANTHROPIC_API_KEY_STANDARDS` — dedicated workspace key (spend-limited)
- `LINEAR_API_KEY` — for creating issues

## Constraints

- Standards PRs require human review (no auto-merge)
- Forward-looking only (no retroactive analysis)
- Sonnet model for cost efficiency (not Opus)
- Analysis only fires on PRs with Claude co-authored commits
- No Trigger.dev tasks (GitHub Actions is simpler for this use case)
