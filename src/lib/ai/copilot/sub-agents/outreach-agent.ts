/** Outreach Setup Agent (M3 + M4).
 *  Handles both LinkedIn outreach (HeyReach/DM) and cold email (PlusVibe/ZapMail) setup.
 *  Routes through provider registry to determine setup approach.
 *  Never imports NextRequest, NextResponse, or cookies. */

import type { SubAgentType, IntakeData } from '@/lib/types/accelerator';

export const OUTREACH_AGENT_TYPE: SubAgentType = 'outreach';

// ─── Prompt Builder ───────────────────────────────────────

export function buildOutreachAgentPrompt(
  sops: Array<{ title: string; content: string; quality_bars: unknown[] }>,
  userContext: { intake_data: IntakeData | null; coaching_mode: string },
  focus: 'linkedin' | 'email'
): string {
  const coachingSection =
    userContext.coaching_mode === 'do_it'
      ? `## Mode: Do It For Me
Execute setup steps automatically through provider APIs where possible.
For provisionable tools, trigger the provisioning flow directly.
For guided setup, provide exact click-by-click instructions.`
      : userContext.coaching_mode === 'teach_me'
        ? `## Mode: Teach Me
Explain the strategy behind outreach infrastructure.
Cover deliverability, warmup science, LinkedIn's algorithm, and risk management.
Make sure the user understands the "why" before any setup.`
        : `## Mode: Guide Me
Walk through setup together. Explain each step and why it matters.
For API-connected tools, show what you're configuring.
For manual steps, provide clear instructions and wait for confirmation.`;

  const focusSection =
    focus === 'linkedin'
      ? `## LinkedIn Outreach Rules (M3)

### Campaign Setup
- Create a connection request campaign first (highest acceptance rates)
- Daily limits: 20-30 connection requests per day (LinkedIn's safe zone)
- Always personalize connection request messages (under 300 characters)
- NEVER automate second messages — coach the user on persona-matching DM replies instead

### Message Templates
- Connection request: Focus on common ground, NOT selling
- Follow-up DM (after acceptance): Provide value first, then soft ask
- Lead magnet delivery: Short, personalized, link to funnel page

### Quality Bars
- Connection acceptance rate should target >30%
- Response rate on DMs should target >15%
- If acceptance rate < 20%, the message needs rewriting
- If LinkedIn flags the account, STOP immediately and reduce daily limits`
      : `## Cold Email Rules (M4)

### Infrastructure Setup
These rules are non-negotiable:
- **Domains**: .com only, 2-3 domains similar to main brand, NO hyphens or numbers
- **Mailboxes**: Maximum 2 accounts per domain (Google Workspace recommended)
- **DNS**: SPF, DKIM, and DMARC records MUST be configured before any sending
- **Warmup**: Minimum 2 weeks warmup before first cold email campaign. Start at 5 emails/day.
- **Daily volume**: Never exceed 30 emails/day per account (across all campaigns)

### Email Copy Framework
- Subject: 3-5 words, lowercase, no punctuation, personal feel
- Body: Under 100 words, one clear ask, personalized opening
- Sequence: 3 steps max (Day 1, Day 3, Day 7)
- NEVER use: "I hope this finds you well", "touching base", "synergy"`;

  const contextSection = userContext.intake_data
    ? `## User Context
Business: ${userContext.intake_data.business_description ?? 'Not provided'}
Target Audience: ${userContext.intake_data.target_audience ?? 'Not provided'}
Primary Goal: ${userContext.intake_data.primary_goal ?? 'Not provided'}`
    : '';

  const sopsSection =
    sops.length > 0
      ? `## Available SOPs\n${sops.map((s) => `### ${s.title}\n${s.content}`).join('\n\n')}`
      : '';

  const moduleId = focus === 'linkedin' ? 'm3' : 'm4';
  const deliverableType = focus === 'linkedin' ? 'dm_campaign' : 'email_campaign';

  return [
    `You are the Outreach Setup specialist in the GTM Accelerator program.
Your job is to help the user set up their ${focus === 'linkedin' ? 'LinkedIn DM outreach' : 'cold email'} infrastructure and campaigns.`,

    coachingSection,

    `## Provider Resolution Flow

ALWAYS start by checking if the user has a provider configured:

1. Call \`check_provider_status\` with capability="${focus === 'linkedin' ? 'dm_outreach' : 'email_outreach'}"
2. If configured and connected → proceed with that provider
3. If not configured:
   a. Call \`list_providers\` to show options
   b. Present recommended option first with benefits
   c. After user chooses → call \`configure_provider\``,

    focusSection,

    ...(contextSection ? [contextSection] : []),
    ...(sopsSection ? [sopsSection] : []),

    `## Output Protocol
Create deliverables via create_deliverable action.
Report progress via update_module_progress with module_id="${moduleId}".

When finished, return a handoff JSON block:
\`\`\`json
{
  "deliverables_created": [{"type": "${deliverableType}"}],
  "progress_updates": [{"module_id": "${moduleId}", "step": "campaign_launched"}],
  "validation_results": [],
  "needs_escalation": false,
  "summary": "Description of what was set up"
}
\`\`\``,
  ]
    .filter(Boolean)
    .join('\n\n');
}
