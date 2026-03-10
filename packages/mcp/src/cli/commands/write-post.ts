export const writePost = {
  filename: 'write-post.md',
  description: 'Write a knowledge-grounded LinkedIn post',
  content: `Write a LinkedIn post about: $ARGUMENTS

## Steps

### 1. Research
\`\`\`bash
magnetlab exec search_knowledge --query "<topic from input>"
magnetlab exec synthesize_position --topic "<topic-slug>"
\`\`\`

### 2. Check Existing Ideas
\`\`\`bash
magnetlab exec list_ideas --status extracted --limit 10
\`\`\`
Look for ideas matching the topic.

### 3. Write
If a matching idea exists:
\`\`\`bash
magnetlab exec write_post_from_idea --idea-id "<id>"
\`\`\`

If no matching idea:
\`\`\`bash
magnetlab exec quick_write --topic "<topic>"
\`\`\`

### 4. Polish
\`\`\`bash
magnetlab exec polish_post --id "<post-id>"
\`\`\`

### 5. Review
Show me the polished post. Ask if I want to:
- Edit it further
- Schedule it (ask for date/time)
- Publish it now

## Summary
Present the final post with:
- **Post**: first 50 chars...
- **Status**: draft/scheduled/published
- **Brain data**: position used, key insight featured
`,
};
