/** Guided Fallback Provider.
 *  Generates step-by-step instructions when no API integration is available.
 *  The agent presents these steps to the user for manual execution.
 *  Never imports NextRequest, NextResponse, or cookies. */

import type { GuidedProvider, GuidedStep, ChecklistItem, CapabilityType } from './types';

// ─── Setup Step Libraries ───────────────────────────────

const DM_OUTREACH_STEPS: GuidedStep[] = [
  {
    stepNumber: 1,
    title: 'Choose a LinkedIn outreach tool',
    instructions:
      'Sign up for a LinkedIn outreach tool (HeyReach, Dripify, or Expandi). HeyReach is recommended for multi-account management.',
    verificationPrompt: 'What tool did you sign up for?',
  },
  {
    stepNumber: 2,
    title: 'Connect your LinkedIn account',
    instructions:
      'Connect your LinkedIn account to the tool. Use cookie-based auth (li_at cookie) for most reliable connection.',
    verificationPrompt: 'Is your LinkedIn account connected and active?',
  },
  {
    stepNumber: 3,
    title: 'Create your first campaign',
    instructions:
      'Create a connection request campaign. Set daily limits to 20-30 invites per day to stay safe.',
    verificationPrompt: 'Share the campaign name and daily invite limit you set.',
  },
  {
    stepNumber: 4,
    title: 'Write your connection request message',
    instructions:
      'Write a personalized connection request (under 300 chars). Focus on common ground, not selling. I can help you write this.',
  },
  {
    stepNumber: 5,
    title: 'Import your TAM list',
    instructions:
      'Upload your segmented TAM list (Warm+LinkedIn Active segment first). Map LinkedIn URL, first name, last name fields.',
    verificationPrompt: 'How many leads did you import?',
  },
];

const EMAIL_OUTREACH_STEPS: GuidedStep[] = [
  {
    stepNumber: 1,
    title: 'Purchase sending domains',
    instructions:
      'Buy 2-3 domains similar to your main domain (.com only). Use Namecheap, GoDaddy, or Porkbun. Example: if your domain is "acme.com", buy "acmehq.com" and "getacme.com".',
    verificationPrompt: 'What domains did you purchase?',
  },
  {
    stepNumber: 2,
    title: 'Set up Google Workspace mailboxes',
    instructions:
      'Create Google Workspace accounts on each domain. 2 mailboxes per domain max. Use real-sounding names (e.g., sarah@acmehq.com).',
    verificationPrompt: 'How many mailboxes did you create?',
  },
  {
    stepNumber: 3,
    title: 'Configure DNS records (SPF, DKIM, DMARC)',
    instructions:
      'Set up SPF, DKIM, and DMARC records for each domain. Your email tool usually provides the DNS records to add.',
    verificationPrompt: 'Are SPF, DKIM, and DMARC all set up?',
  },
  {
    stepNumber: 4,
    title: 'Sign up for a cold email platform',
    instructions:
      'Sign up for PlusVibe (recommended), Instantly, or Smartlead. Connect all your mailboxes.',
    verificationPrompt: 'Which platform did you choose and how many mailboxes are connected?',
  },
  {
    stepNumber: 5,
    title: 'Start warmup',
    instructions:
      'Enable email warmup for all accounts. Minimum 2 weeks warmup before sending any campaigns. Set ramp-up to start at 5 emails/day.',
    verificationPrompt: 'Is warmup running on all accounts?',
  },
  {
    stepNumber: 6,
    title: 'Write cold email sequences',
    instructions:
      'Write a 3-step email sequence. I can help you write personalized, high-converting copy for your ICP.',
  },
];

const DOMAIN_STEPS: GuidedStep[] = [
  {
    stepNumber: 1,
    title: 'Choose sending domains',
    instructions:
      'Pick 2-3 domain names similar to your main brand. Only use .com TLDs. Avoid hyphens and numbers.',
    verificationPrompt: 'What domain names are you considering?',
  },
  {
    stepNumber: 2,
    title: 'Purchase domains',
    instructions: 'Purchase through your preferred registrar (Namecheap, GoDaddy, Porkbun).',
    verificationPrompt: 'Which domains did you purchase?',
  },
  {
    stepNumber: 3,
    title: 'Point DNS to email provider',
    instructions:
      'Add MX, SPF, DKIM, and DMARC records as required by your email provider (Google Workspace or Microsoft 365).',
    verificationPrompt: 'Are all DNS records configured?',
  },
];

const SETUP_STEPS: Record<CapabilityType, GuidedStep[]> = {
  dm_outreach: DM_OUTREACH_STEPS,
  email_outreach: EMAIL_OUTREACH_STEPS,
  domain: DOMAIN_STEPS,
};

// ─── Provider Implementation ────────────────────────────

export class GuidedFallbackProvider implements GuidedProvider {
  readonly id = 'guided' as const;
  readonly name = 'Guided Setup';

  getSetupSteps(capability: CapabilityType): GuidedStep[] {
    return SETUP_STEPS[capability] || [];
  }

  getVerificationChecklist(capability: CapabilityType): ChecklistItem[] {
    return VERIFICATION_CHECKLISTS[capability] || [];
  }
}

const VERIFICATION_CHECKLISTS: Record<CapabilityType, ChecklistItem[]> = {
  dm_outreach: [
    { item: 'LinkedIn account connected and active', required: true },
    { item: 'First campaign created with daily limits set', required: true },
    { item: 'Connection request message written (under 300 chars)', required: true },
    { item: 'TAM leads imported to campaign', required: true },
  ],
  email_outreach: [
    { item: 'Sending domains purchased (.com only)', required: true },
    { item: 'DNS records configured (SPF, DKIM, DMARC)', required: true },
    { item: 'Mailboxes created (max 2 per domain)', required: true },
    { item: 'All accounts connected to email platform', required: true },
    { item: 'Warmup enabled and running for 2+ weeks', required: true },
    { item: 'First email sequence written (3 steps)', required: false },
  ],
  domain: [
    { item: 'Domains purchased (2-3, .com only)', required: true },
    { item: 'MX records pointing to email provider', required: true },
    { item: 'SPF record configured', required: true },
    { item: 'DKIM record configured', required: true },
    { item: 'DMARC record configured', required: true },
  ],
};
