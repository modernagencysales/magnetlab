export const contentWeek = {
  filename: 'content-week.md',
  description: 'Plan and schedule a week of LinkedIn content',
  content: `Plan a week of LinkedIn content.

## Steps

### 1. Check Knowledge Strength
\`\`\`bash
magnetlab exec list_topics
magnetlab exec knowledge_gaps
\`\`\`

### 2. Review Existing Ideas
\`\`\`bash
magnetlab exec list_ideas --status extracted --limit 20
\`\`\`

### 3. Check Current Schedule
\`\`\`bash
magnetlab exec get_autopilot_status
magnetlab exec list_posting_slots
\`\`\`

### 4. Generate Plan
\`\`\`bash
magnetlab exec generate_plan --week-count 1
\`\`\`

### 5. Review with Me
Present the plan: which topics, which days, what angles.
Ask if I want to adjust anything.

### 6. Approve & Execute
\`\`\`bash
magnetlab exec approve_plan --plan-id "<id>"
magnetlab exec trigger_autopilot --posts-per-batch 5
\`\`\`

## Summary
Report:
- **Posts planned**: [N] posts for [dates]
- **Topics covered**: bullet list
- **Posting slots**: [schedule]
- **Buffer status**: [N] posts ready
`,
};
