export const createLeadMagnet = {
  filename: 'create-lead-magnet.md',
  description: 'Create a brain-informed lead magnet with funnel and email sequence',
  content: `Create a brain-informed lead magnet based on: $ARGUMENTS

Interpret the input to extract topic, format preference (checklist/guide/framework/template/swipe-file), and target audience. If any are unclear, ask before proceeding.

## Steps

### 1. Check Brain Readiness
\`\`\`bash
magnetlab exec knowledge_readiness --topic "<topic from input>" --goal lead_magnet
\`\`\`
- If confidence is "high" or "medium": proceed
- If confidence is "low": tell me what's missing, how many entries exist, and ask if I want to proceed with limited brain data or upload more transcripts first

### 2. Research & Synthesize
\`\`\`bash
magnetlab exec search_knowledge --query "<topic>"
magnetlab exec synthesize_position --topic "<topic-slug>"
\`\`\`
Review the position: thesis, differentiators, key stories, data points.

### 3. Propose Angle
Present what the brain has on this topic. Propose:
- A specific title that leads with the user's differentiator
- An archetype (single-breakdown, single-system, focused-toolkit, prompt, assessment, workflow, etc.)
- The hook angle based on their unique position

**Get my approval before creating.**

### 4. Create Lead Magnet + Funnel
\`\`\`bash
magnetlab exec create_lead_magnet --title "<title>" --archetype "<archetype>" --use-brain --funnel-config '{"slug":"<slug>","optin_headline":"<headline>","optin_social_proof":null,"publish":false}'
\`\`\`
Extract lead_magnet.id and funnel.funnel.id from the response.

### 5. Generate Content (30-90s)
\`\`\`bash
magnetlab exec generate_lead_magnet_content --lead-magnet-id "<id>"
\`\`\`

### 6. Generate Email Sequence (30-60s)
\`\`\`bash
magnetlab exec generate_email_sequence --lead-magnet-id "<id>"
\`\`\`
Review the response for placeholder text like [INSERT TIP] or [YOUR NAME]. If found, fix them:
\`\`\`bash
magnetlab exec update_email_sequence --lead-magnet-id "<id>" --emails '<fixed emails JSON>'
\`\`\`
Then activate:
\`\`\`bash
magnetlab exec activate_email_sequence --lead-magnet-id "<id>"
\`\`\`

### 7. Review & Publish
Ask me if I want to publish. If yes:
\`\`\`bash
magnetlab exec publish_funnel --funnel-id "<funnel-id>"
\`\`\`

## Error Handling
If any step fails, explain the error and suggest a fix. Check status anytime with:
\`\`\`bash
magnetlab status <lead-magnet-id>
\`\`\`

## Summary
After completing all steps, present a summary:
- **Lead magnet**: [title] (id: xxx)
- **Funnel**: [url or "draft"]
- **Email sequence**: [status] ([N] emails)
- **Brain data**: [N] entries used, position: [yes/no]
- **Warnings**: any issues (e.g., "Social proof omitted — no real data")
`,
};
