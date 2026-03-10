export const leadMagnetStatus = {
  filename: 'lead-magnet-status.md',
  description: 'Check completeness of a lead magnet',
  content: `Check the status of lead magnet: $ARGUMENTS

\`\`\`bash
magnetlab exec lead_magnet_status --lead-magnet-id "$ARGUMENTS"
\`\`\`

Present the results clearly:
- **Lead magnet**: [title] — [status]
- **Content**: generated / missing
- **Funnel**: exists / missing — published / draft
- **Email sequence**: exists / missing — [status] ([N] emails)
- **Brain enriched**: yes/no ([N] entries)
- **Next step**: [what to do next]

If there are missing items, offer to complete them.
`,
};
