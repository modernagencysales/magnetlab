export const checkBrain = {
  filename: 'check-brain.md',
  description: 'Check AI Brain knowledge on a topic',
  content: `Check my AI Brain knowledge on: $ARGUMENTS

## Steps

### 1. Readiness Check
\`\`\`bash
magnetlab exec knowledge_readiness --topic "<topic>" --goal lead_magnet
\`\`\`

### 2. Search for Entries
\`\`\`bash
magnetlab exec search_knowledge --query "<topic>" --limit 10
\`\`\`

### 3. Synthesize Position (if entries exist)
\`\`\`bash
magnetlab exec synthesize_position --topic "<topic-slug>"
\`\`\`

## Report
Present a summary:
- **Confidence**: high/medium/low
- **Entries found**: [N] entries
- **Key insights**: bullet list of top 3-5 insights from the brain
- **Position**: thesis + stance type (if synthesized)
- **Gaps**: what's missing
- **Recommendations**:
  - Ready for lead magnet? (yes/no + why)
  - Ready for LinkedIn post? (yes/no + why)
  - What transcripts/topics would strengthen coverage?
`,
};
