export const setupFunnel = {
  filename: 'setup-funnel.md',
  description: 'Create and publish a funnel for an existing lead magnet',
  content: `Set up a funnel for lead magnet: $ARGUMENTS

## Steps

### 1. Check Lead Magnet
\`\`\`bash
magnetlab status $ARGUMENTS
\`\`\`
Verify the lead magnet exists and has content.

### 2. Create Funnel
\`\`\`bash
magnetlab exec create_funnel --lead-magnet-id "$ARGUMENTS" --slug "<auto-from-title>" --optin-headline "<from lead magnet title>" --optin-social-proof ""
\`\`\`
Do NOT fabricate social proof — leave null unless real data is available.

### 3. Restyle (optional)
Ask if I want a specific look. If yes:
\`\`\`bash
magnetlab exec restyle_funnel --funnel-id "<id>" --prompt "<style description>"
magnetlab exec apply_restyle --funnel-id "<id>" --plan '<plan JSON>'
\`\`\`

### 4. Email Sequence (if not exists)
\`\`\`bash
magnetlab exec generate_email_sequence --lead-magnet-id "$ARGUMENTS"
magnetlab exec activate_email_sequence --lead-magnet-id "$ARGUMENTS"
\`\`\`

### 5. Publish
Ask me before publishing:
\`\`\`bash
magnetlab exec publish_funnel --funnel-id "<id>"
\`\`\`

## Summary
Present:
- **Funnel**: [url]
- **Theme**: [dark/light], [color]
- **Email sequence**: [status]
- **Sections**: [count] sections
`,
};
