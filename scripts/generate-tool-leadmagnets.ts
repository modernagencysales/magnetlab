#!/usr/bin/env npx tsx
/**
 * generate-tool-leadmagnets.ts
 *
 * Creates 13 lead magnet funnels (one per bootcamp AI tool) in a single run.
 * Calls magnetlab external APIs + writes directly to Supabase for invite codes.
 *
 * Usage:
 *   # Load env from .env.local
 *   source <(grep -v '^#' .env.local | sed 's/^/export /')
 *   npx tsx scripts/generate-tool-leadmagnets.ts
 *
 * Or:
 *   SUPABASE_SERVICE_ROLE_KEY=... EXTERNAL_API_KEY=... npx tsx scripts/generate-tool-leadmagnets.ts
 *
 * Environment:
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key (required)
 *   EXTERNAL_API_KEY          - Magnetlab external API key (required)
 *   MAGNETLAB_URL             - Base URL for magnetlab (default: http://localhost:3000)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// CONFIG
// ============================================================

const SUPABASE_URL = 'https://qvawbxpijxlwdkolmjrs.supabase.co';
const MAS_USER_ID = '0f634817-6db8-4a54-adfd-6ab143950b8c';
const ICLOSED_BOOKING_URL = 'https://app.iclosed.io/e/timkeen/test';
const REGISTRATION_BASE_URL = 'https://www.modernagencysales.com/bootcamp/register';
const COHORT_NAME = 'Lead Magnet';

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY;
const MAGNETLAB_URL = process.env.MAGNETLAB_URL || 'http://localhost:3000';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}
if (!EXTERNAL_API_KEY) {
  console.error('ERROR: EXTERNAL_API_KEY environment variable is required');
  process.exit(1);
}

// ============================================================
// TOOL CATALOG
// ============================================================

interface ToolConfig {
  toolSlug: string;
  title: string;
  code: string;
  funnelSlug: string;
  optinHeadline: string;
  optinSubline: string;
}

const TOOLS: ToolConfig[] = [
  {
    toolSlug: 'offer-generator',
    title: 'Free AI Offer Generator',
    code: 'OFFERGEN',
    funnelSlug: 'free-offer-generator',
    optinHeadline: 'Create Your Perfect Offer in Minutes',
    optinSubline: 'Use our AI-powered Offer Generator to craft an irresistible offer that attracts your ideal clients. Enter your email to get free access.',
  },
  {
    toolSlug: 'niche-finder',
    title: 'Free AI Niche Finder',
    code: 'NICHEFIND',
    funnelSlug: 'free-niche-finder',
    optinHeadline: 'Discover Your Most Profitable Niche',
    optinSubline: 'Our AI Niche Finder analyzes your skills and market demand to identify the niche where you can win. Enter your email for free access.',
  },
  {
    toolSlug: 'lead-magnet-ideator',
    title: 'Free Lead Magnet Ideator',
    code: 'LMIDEATE',
    funnelSlug: 'free-lead-magnet-ideator',
    optinHeadline: 'Generate Lead Magnet Ideas That Convert',
    optinSubline: 'Let AI brainstorm high-converting lead magnet concepts tailored to your expertise and audience. Enter your email to get started.',
  },
  {
    toolSlug: 'lead-magnet-creator',
    title: 'Free Lead Magnet Creator',
    code: 'LMCREATE',
    funnelSlug: 'free-lead-magnet-creator',
    optinHeadline: 'Build Your Lead Magnet with AI',
    optinSubline: 'Turn your expertise into a polished lead magnet in minutes. Our AI handles the structure, copy, and design. Enter your email for free access.',
  },
  {
    toolSlug: 'lead-magnet-post-creator',
    title: 'Free Lead Magnet Post Writer',
    code: 'LMPOST',
    funnelSlug: 'free-lead-magnet-post-writer',
    optinHeadline: 'Write LinkedIn Posts That Promote Your Lead Magnet',
    optinSubline: 'AI generates scroll-stopping LinkedIn posts to drive traffic to your lead magnet. Enter your email for free access.',
  },
  {
    toolSlug: 'lead-magnet-email',
    title: 'Free Lead Magnet Email Writer',
    code: 'LMEMAIL',
    funnelSlug: 'free-lead-magnet-email-writer',
    optinHeadline: 'Write Your Lead Magnet Email Sequence with AI',
    optinSubline: 'Generate a complete 5-email nurture sequence that converts leads into conversations. Enter your email for free access.',
  },
  {
    toolSlug: 'ty-page-vsl',
    title: 'Free Thank-You Page VSL Builder',
    code: 'TYVSL',
    funnelSlug: 'free-ty-page-vsl-builder',
    optinHeadline: 'Build a High-Converting Thank-You Page Script',
    optinSubline: 'AI creates a persuasive video sales letter script for your thank-you page that books more calls. Enter your email for free access.',
  },
  {
    toolSlug: 'profile-optimizer',
    title: 'Free LinkedIn Profile Optimizer',
    code: 'PROFILE',
    funnelSlug: 'free-profile-optimizer',
    optinHeadline: 'Optimize Your LinkedIn Profile with AI',
    optinSubline: 'Get AI-powered recommendations to transform your LinkedIn profile into a client magnet. Enter your email for free access.',
  },
  {
    toolSlug: 'transcript-post-idea-grabber',
    title: 'Free Transcript Idea Extractor',
    code: 'IDEAGRAB',
    funnelSlug: 'free-transcript-idea-extractor',
    optinHeadline: 'Turn Any Conversation Into LinkedIn Content',
    optinSubline: 'Paste a call transcript and let AI extract the best post ideas and insights. Enter your email for free access.',
  },
  {
    toolSlug: 'post-generator',
    title: 'Free LinkedIn Post Generator',
    code: 'POSTGEN',
    funnelSlug: 'free-post-generator',
    optinHeadline: 'Generate LinkedIn Posts That Get Engagement',
    optinSubline: 'Create compelling LinkedIn posts in your voice with AI. Stop staring at a blank screen. Enter your email for free access.',
  },
  {
    toolSlug: 'post-finalizer',
    title: 'Free LinkedIn Post Finalizer',
    code: 'POSTFINAL',
    funnelSlug: 'free-post-finalizer',
    optinHeadline: 'Polish Your LinkedIn Posts to Perfection',
    optinSubline: 'AI reviews and refines your draft posts for maximum impact and engagement. Enter your email for free access.',
  },
  {
    toolSlug: 'dm-chat-helper',
    title: 'Free LinkedIn DM Script GPT',
    code: 'DMHELP',
    funnelSlug: 'free-dm-script-gpt',
    optinHeadline: 'Write LinkedIn DMs That Start Real Conversations',
    optinSubline: 'AI generates personalized DM scripts that feel natural and open doors. Enter your email for free access.',
  },
  {
    toolSlug: 'cold-email-mastermind',
    title: 'Free Cold Email Mastermind',
    code: 'COLDEMAIL',
    funnelSlug: 'free-cold-email-mastermind',
    optinHeadline: 'Master Cold Email with AI',
    optinSubline: 'Get AI-powered guidance on cold email strategy, sequences, and copy that actually gets replies. Enter your email for free access.',
  },
];

// ============================================================
// HELPERS
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${EXTERNAL_API_KEY}`,
    'x-gtm-user-id': MAS_USER_ID,
  };
}

async function apiCall<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: T }> {
  const url = `${MAGNETLAB_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: apiHeaders(),
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as T };
}

function registrationUrl(code: string): string {
  return `${REGISTRATION_BASE_URL}?code=${code}`;
}

// ============================================================
// SETUP: Cohort
// ============================================================

async function ensureCohort(supabase: SupabaseClient): Promise<string> {
  // Check if "Lead Magnet" cohort already exists
  const { data: existing, error: fetchErr } = await supabase
    .from('bootcamp_cohorts')
    .select('id')
    .eq('name', COHORT_NAME)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(`Failed to query cohorts: ${fetchErr.message}`);
  }

  if (existing) {
    console.log(`  Cohort "${COHORT_NAME}" already exists (${existing.id})`);
    return existing.id;
  }

  // Create new cohort
  const { data: created, error: createErr } = await supabase
    .from('bootcamp_cohorts')
    .insert({
      name: COHORT_NAME,
      description: 'Leads from tool-specific lead magnets. Access level: Lead Magnet (single tool, 10 credits).',
      status: 'Active',
    })
    .select('id')
    .single();

  if (createErr || !created) {
    throw new Error(`Failed to create cohort: ${createErr?.message}`);
  }

  console.log(`  Created cohort "${COHORT_NAME}" (${created.id})`);
  return created.id;
}

// ============================================================
// STEP 1: Create invite code
// ============================================================

async function ensureInviteCode(
  supabase: SupabaseClient,
  tool: ToolConfig,
  cohortId: string
): Promise<void> {
  // Check if code already exists
  const { data: existing } = await supabase
    .from('bootcamp_invite_codes')
    .select('id')
    .eq('code', tool.code)
    .maybeSingle();

  if (existing) {
    console.log(`    [invite] Code ${tool.code} already exists — skipped`);
    return;
  }

  const { error } = await supabase
    .from('bootcamp_invite_codes')
    .insert({
      code: tool.code,
      cohort_id: cohortId,
      status: 'Active',
      max_uses: 5000,
      use_count: 0,
      access_level: 'Lead Magnet',
      tool_grants: [{ toolSlug: tool.toolSlug, credits: 10 }],
    });

  if (error) {
    throw new Error(`Failed to create invite code ${tool.code}: ${error.message}`);
  }

  console.log(`    [invite] Created code ${tool.code}`);
}

// ============================================================
// STEP 2: Create lead magnet
// ============================================================

interface LeadMagnetResult {
  id: string;
}

async function createLeadMagnet(tool: ToolConfig): Promise<LeadMagnetResult> {
  const res = await apiCall<LeadMagnetResult>('POST', '/api/external/lead-magnets', {
    title: tool.title,
    archetype: 'prompt',
    concept: {
      contents: `AI-powered ${tool.title.replace('Free ', '')} — enter your details and get instant results. This tool helps you ${tool.optinSubline.split('. ')[0].toLowerCase()}.`,
      deliveryFormat: 'AI Tool Access',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to create lead magnet: ${res.status} ${JSON.stringify(res.data)}`);
  }

  console.log(`    [lead-magnet] Created "${tool.title}" (${res.data.id})`);
  return res.data;
}

// ============================================================
// STEP 3: Create funnel
// ============================================================

interface FunnelResult {
  funnel: {
    id: string;
    slug: string;
  };
}

async function createFunnel(
  tool: ToolConfig,
  leadMagnetId: string
): Promise<{ funnelId: string; funnelSlug: string }> {
  const res = await apiCall<FunnelResult>('POST', '/api/external/funnels', {
    leadMagnetId,
    slug: tool.funnelSlug,
    optinHeadline: tool.optinHeadline,
    optinSubline: tool.optinSubline,
    optinButtonText: 'Get Free Access',
  });

  if (!res.ok) {
    throw new Error(`Failed to create funnel: ${res.status} ${JSON.stringify(res.data)}`);
  }

  const funnelId = res.data.funnel.id;
  const funnelSlug = res.data.funnel.slug;
  console.log(`    [funnel] Created funnel "${funnelSlug}" (${funnelId})`);
  return { funnelId, funnelSlug };
}

// ============================================================
// STEP 4: Apply branding
// ============================================================

async function applyBranding(funnelPageId: string): Promise<void> {
  const res = await apiCall('POST', '/api/external/apply-branding', {
    userId: MAS_USER_ID,
    funnelPageId,
  });

  if (!res.ok) {
    throw new Error(`Failed to apply branding: ${res.status} ${JSON.stringify(res.data)}`);
  }

  console.log(`    [branding] Applied brand kit`);
}

// ============================================================
// STEP 5: Generate quiz
// ============================================================

async function generateQuiz(funnelPageId: string): Promise<void> {
  const res = await apiCall('POST', '/api/external/generate-quiz', {
    userId: MAS_USER_ID,
    funnelPageId,
  });

  if (!res.ok) {
    throw new Error(`Failed to generate quiz: ${res.status} ${JSON.stringify(res.data)}`);
  }

  const data = res.data as { questionCount?: number };
  console.log(`    [quiz] Generated ${data.questionCount || '?'} questions`);
}

// ============================================================
// STEP 6: Setup thank-you page
// ============================================================

async function setupThankyou(
  supabase: SupabaseClient,
  funnelPageId: string,
  tool: ToolConfig
): Promise<void> {
  const res = await apiCall('POST', '/api/external/setup-thankyou', {
    userId: MAS_USER_ID,
    funnelPageId,
    bookingUrl: ICLOSED_BOOKING_URL,
    resourceTitle: tool.title,
  });

  if (!res.ok) {
    throw new Error(`Failed to setup thank-you: ${res.status} ${JSON.stringify(res.data)}`);
  }

  // Set calendly_url on funnel_pages for iClosed embed
  const { error } = await supabase
    .from('funnel_pages')
    .update({ calendly_url: ICLOSED_BOOKING_URL })
    .eq('id', funnelPageId);

  if (error) {
    console.warn(`    [thankyou] WARNING: Failed to set calendly_url: ${error.message}`);
  }

  console.log(`    [thankyou] Setup complete with iClosed booking`);
}

// ============================================================
// STEP 7: Generate email sequence
// ============================================================

interface EmailSequenceResult {
  emailSequence: {
    id: string;
    emails: Array<{ day: number; subject: string; body: string; replyTrigger: string }>;
  };
}

async function generateEmailSequence(leadMagnetId: string): Promise<EmailSequenceResult> {
  const res = await apiCall<EmailSequenceResult>('POST', '/api/external/email-sequence/generate', {
    userId: MAS_USER_ID,
    leadMagnetId,
  });

  if (!res.ok) {
    throw new Error(`Failed to generate email sequence: ${res.status} ${JSON.stringify(res.data)}`);
  }

  const count = res.data.emailSequence?.emails?.length || 0;
  console.log(`    [email-seq] Generated ${count} emails`);
  return res.data;
}

// ============================================================
// STEP 8: Inject registration links into emails
// ============================================================

async function injectRegistrationLinks(
  supabase: SupabaseClient,
  leadMagnetId: string,
  tool: ToolConfig,
  emailData: EmailSequenceResult
): Promise<void> {
  const regUrl = registrationUrl(tool.code);
  const emails = emailData.emailSequence.emails;

  if (!emails || emails.length === 0) {
    console.warn(`    [inject] No emails to inject into — skipped`);
    return;
  }

  // Build the registration CTA block
  const registrationBlock = `\n\n---\n\nGet your free access to the ${tool.title}:\n${regUrl}\n\nUse code: ${tool.code}\n(10 free credits included)\n\n---`;

  const reminderBlock = `\n\nP.S. Haven't claimed your free access yet? Get your ${tool.title} here: ${regUrl}`;

  // Inject into emails
  const updatedEmails = emails.map((email) => {
    if (email.day === 0) {
      // Day 0: Add full registration block near the end of the body
      return {
        ...email,
        body: email.body + registrationBlock,
      };
    } else if (email.day === 2 || email.day === 4) {
      // Day 2 and Day 4: Add reminder P.S.
      return {
        ...email,
        body: email.body + reminderBlock,
      };
    }
    return email;
  });

  // Update the email sequence in the database
  const { error } = await supabase
    .from('email_sequences')
    .update({ emails: updatedEmails })
    .eq('lead_magnet_id', leadMagnetId)
    .eq('user_id', MAS_USER_ID);

  if (error) {
    throw new Error(`Failed to inject registration links: ${error.message}`);
  }

  const injectedDays = updatedEmails
    .filter((e, i) => e.body !== emails[i].body)
    .map((e) => `Day ${e.day}`);
  console.log(`    [inject] Added registration links to: ${injectedDays.join(', ')}`);
}

// ============================================================
// STEP 9: Activate email sequence
// ============================================================

async function activateEmailSequence(leadMagnetId: string): Promise<void> {
  const res = await apiCall('POST', `/api/external/email-sequence/${leadMagnetId}/activate`, {
    userId: MAS_USER_ID,
  });

  if (!res.ok) {
    throw new Error(`Failed to activate email sequence: ${res.status} ${JSON.stringify(res.data)}`);
  }

  console.log(`    [email-seq] Activated`);
}

// ============================================================
// STEP 10: Publish funnel
// ============================================================

interface PublishResult {
  publicUrl: string | null;
}

async function publishFunnel(funnelId: string): Promise<string | null> {
  const res = await apiCall<PublishResult>('POST', `/api/external/funnels/${funnelId}/publish`, {
    publish: true,
  });

  if (!res.ok) {
    throw new Error(`Failed to publish funnel: ${res.status} ${JSON.stringify(res.data)}`);
  }

  const publicUrl = res.data.publicUrl || null;
  console.log(`    [publish] Published${publicUrl ? ` at ${publicUrl}` : ''}`);
  return publicUrl;
}

// ============================================================
// MAIN: Process one tool
// ============================================================

interface ToolResult {
  toolSlug: string;
  code: string;
  funnelUrl: string | null;
  registrationUrl: string;
  success: boolean;
  error?: string;
}

async function processTool(
  supabase: SupabaseClient,
  tool: ToolConfig,
  cohortId: string,
  index: number
): Promise<ToolResult> {
  console.log(`\n[${ index + 1}/13] Processing: ${tool.title} (${tool.toolSlug})`);

  try {
    // Step 1: Create invite code (idempotent)
    await ensureInviteCode(supabase, tool, cohortId);
    await sleep(500);

    // Step 2: Create lead magnet
    const leadMagnet = await createLeadMagnet(tool);
    await sleep(500);

    // Step 3: Create funnel
    const { funnelId } = await createFunnel(tool, leadMagnet.id);
    await sleep(500);

    // Step 4: Apply branding
    await applyBranding(funnelId);
    await sleep(500);

    // Step 5: Generate quiz
    await generateQuiz(funnelId);
    await sleep(500);

    // Step 6: Setup thank-you page
    await setupThankyou(supabase, funnelId, tool);
    await sleep(500);

    // Step 7: Generate email sequence
    const emailData = await generateEmailSequence(leadMagnet.id);
    await sleep(500);

    // Step 8: Inject registration links
    await injectRegistrationLinks(supabase, leadMagnet.id, tool, emailData);
    await sleep(500);

    // Step 9: Activate email sequence
    await activateEmailSequence(leadMagnet.id);
    await sleep(500);

    // Step 10: Publish funnel
    const publicUrl = await publishFunnel(funnelId);

    return {
      toolSlug: tool.toolSlug,
      code: tool.code,
      funnelUrl: publicUrl,
      registrationUrl: registrationUrl(tool.code),
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`    [ERROR] ${message}`);
    return {
      toolSlug: tool.toolSlug,
      code: tool.code,
      funnelUrl: null,
      registrationUrl: registrationUrl(tool.code),
      success: false,
      error: message,
    };
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('=================================================');
  console.log('  Tool-as-Lead-Magnet Generator');
  console.log('=================================================');
  console.log(`  Magnetlab URL: ${MAGNETLAB_URL}`);
  console.log(`  Supabase URL:  ${SUPABASE_URL}`);
  console.log(`  User ID:       ${MAS_USER_ID}`);
  console.log(`  Tools:         ${TOOLS.length}`);
  console.log('=================================================\n');

  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Step 0: Ensure cohort exists
  console.log('Setting up cohort...');
  const cohortId = await ensureCohort(supabase);

  // Process each tool
  const results: ToolResult[] = [];

  for (let i = 0; i < TOOLS.length; i++) {
    const result = await processTool(supabase, TOOLS[i], cohortId, i);
    results.push(result);

    // Delay between tools to avoid rate limits
    if (i < TOOLS.length - 1) {
      console.log(`\n  Waiting 2s before next tool...`);
      await sleep(2000);
    }
  }

  // Print summary
  console.log('\n\n=================================================');
  console.log('  SUMMARY');
  console.log('=================================================\n');

  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`  Total:     ${results.length}`);
  console.log(`  Succeeded: ${succeeded.length}`);
  console.log(`  Failed:    ${failed.length}`);

  // Table header
  console.log('\n' + '-'.repeat(120));
  console.log(
    padRight('Tool Slug', 32) +
    padRight('Code', 12) +
    padRight('Funnel URL', 50) +
    padRight('Status', 10)
  );
  console.log('-'.repeat(120));

  for (const r of results) {
    console.log(
      padRight(r.toolSlug, 32) +
      padRight(r.code, 12) +
      padRight(r.funnelUrl || '(not published)', 50) +
      padRight(r.success ? 'OK' : 'FAILED', 10)
    );
  }

  console.log('-'.repeat(120));

  // Registration URLs table
  console.log('\n  Registration URLs:');
  console.log('-'.repeat(80));
  for (const r of results) {
    console.log(`  ${padRight(r.code, 12)} ${r.registrationUrl}`);
  }
  console.log('-'.repeat(80));

  // Print failures if any
  if (failed.length > 0) {
    console.log('\n  FAILURES:');
    for (const r of failed) {
      console.log(`  - ${r.toolSlug}: ${r.error}`);
    }
  }

  console.log('\nDone.');
  process.exit(failed.length > 0 ? 1 : 0);
}

function padRight(str: string, len: number): string {
  if (str.length >= len) return str.substring(0, len);
  return str + ' '.repeat(len - str.length);
}

// Run
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
