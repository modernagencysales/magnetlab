/** Diagnostic Rules Seed Script.
 *  Seeds the diagnostic_rules table with rules for the troubleshooter agent.
 *  Covers all 8 modules (m0–m7) with 14 rules total.
 *  Run: npx tsx scripts/seed-diagnostic-rules.ts
 *  Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env. */

import { createClient } from '@supabase/supabase-js';

// ─── Client ──────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiagnosticRuleInsert {
  module_id: string;
  symptom: string;
  metric_key: string;
  threshold_operator: '<' | '>' | '<=' | '>=' | '=';
  threshold_value: number;
  diagnostic_questions: string[];
  common_causes: string[];
  priority: number;
  is_active: boolean;
}

// ─── Rules ────────────────────────────────────────────────────────────────────

const RULES: DiagnosticRuleInsert[] = [
  // ─── M0: Positioning ─────────────────────────────────────────────────────
  {
    module_id: 'm0',
    symptom: 'Low ICP clarity score',
    metric_key: 'icp_clarity',
    threshold_operator: '<',
    threshold_value: 50,
    diagnostic_questions: [
      'Can you describe your ideal client in one sentence including their role, company size, and core pain?',
      'Have you interviewed at least 5 past clients to validate your ICP assumptions?',
      'Do you have a documented niche statement that distinguishes you from generalist competitors?',
    ],
    common_causes: [
      'ICP definition is too broad — targeting multiple industries or roles dilutes messaging',
      'Positioning based on services offered rather than outcome delivered to a specific buyer',
      'No documented ICP worksheet completed — working from gut feel instead of research',
      'Attempting to serve both SMB and enterprise simultaneously without a clear primary ICP',
    ],
    priority: 10,
    is_active: true,
  },

  // ─── M1: Lead Magnets ────────────────────────────────────────────────────
  {
    module_id: 'm1',
    symptom: 'No live lead magnets',
    metric_key: 'lm_count',
    threshold_operator: '<',
    threshold_value: 1,
    diagnostic_questions: [
      'Have you completed the 6-step lead magnet wizard in MagnetLab?',
      'Is there a specific obstacle stopping you from publishing — content, design, or technical?',
    ],
    common_causes: [
      'Wizard started but not completed — draft sitting unpublished',
      'Perfectionism blocking launch — waiting for "perfect" content instead of shipping',
      'Not clear what expertise to package — needs ICP and positioning work first (m0)',
    ],
    priority: 5,
    is_active: true,
  },
  {
    module_id: 'm1',
    symptom: 'Low lead magnet opt-in rate',
    metric_key: 'lm_optin_rate',
    threshold_operator: '<',
    threshold_value: 15,
    diagnostic_questions: [
      'Does your lead magnet title promise a specific, measurable outcome for your ICP?',
      'Is the opt-in form visible above the fold without scrolling?',
      'Are you using social proof (testimonials, subscriber count) on the landing page?',
    ],
    common_causes: [
      'Vague value proposition — headline does not state a concrete outcome or timeframe',
      'Too many form fields — every extra field beyond email drops conversions significantly',
      'Landing page copy focuses on features of the lead magnet rather than the result the reader gets',
      'Traffic mismatch — sending cold LinkedIn traffic to a page optimized for warm email traffic',
    ],
    priority: 15,
    is_active: true,
  },

  // ─── M2: TAM Building ────────────────────────────────────────────────────
  {
    module_id: 'm2',
    symptom: 'TAM too small to sustain outreach',
    metric_key: 'tam_size',
    threshold_operator: '<',
    threshold_value: 100,
    diagnostic_questions: [
      'What filters are you applying in Sales Navigator — are any overly restrictive?',
      'Have you considered adjacent verticals or secondary roles that also experience the same pain?',
      'Are you targeting geography too narrowly?',
    ],
    common_causes: [
      'Niche too narrow — ICP definition has too many layered filters simultaneously',
      'Geographic restriction applied when the product or service works remotely',
      'Only targeting top decision-makers when economic buyers one level down are equally valid',
    ],
    priority: 20,
    is_active: true,
  },

  // ─── M3: LinkedIn Outreach ───────────────────────────────────────────────
  {
    module_id: 'm3',
    symptom: 'Low LinkedIn connection acceptance rate',
    metric_key: 'li_accept_rate',
    threshold_operator: '<',
    threshold_value: 25,
    diagnostic_questions: [
      'Is your LinkedIn profile headline written as "I help [ICP] achieve [outcome]" rather than a job title?',
      'Are your connection request notes personalized with a specific reason for reaching out?',
      'Are you targeting people who match your defined ICP, or casting wider to hit volume?',
    ],
    common_causes: [
      'Weak profile — headline reads as a job title instead of a value promise visible in search results',
      'Generic connection notes — "I would like to connect" or blank notes get ignored',
      'Targeting too broadly — low relevance between the prospect and your offer signals spam',
      'Sending too many requests per day — LinkedIn throttling or SSI score suppression',
    ],
    priority: 10,
    is_active: true,
  },
  {
    module_id: 'm3',
    symptom: 'Low LinkedIn DM reply rate',
    metric_key: 'li_reply_rate',
    threshold_operator: '<',
    threshold_value: 10,
    diagnostic_questions: [
      'Does your first DM after connection open with a relevant insight or question, not a pitch?',
      'Is your first message under 3 sentences with a single clear ask?',
      "Are you engaging with the prospect's content before or after sending the DM?",
    ],
    common_causes: [
      'Pitching too soon — first message after connection immediately promotes a service or books a call',
      'Message too long — dense walls of text are deleted without reading on mobile',
      'No warm-up engagement — cold DM with no prior interaction has lower response rates than after a comment',
    ],
    priority: 15,
    is_active: true,
  },

  // ─── M4: Cold Email ──────────────────────────────────────────────────────
  {
    module_id: 'm4',
    symptom: 'Low cold email reply rate',
    metric_key: 'email_reply_rate',
    threshold_operator: '<',
    threshold_value: 3,
    diagnostic_questions: [
      "Does your email open with the prospect's problem rather than who you are or what you do?",
      'Is your call-to-action a simple yes/no question rather than a direct meeting request?',
      'Are you running at least 3 follow-up emails spaced 3–5 days apart?',
    ],
    common_causes: [
      'Feature-focused copy — email leads with your credentials or service description instead of their pain',
      'Aggressive CTA — asking for a 30-minute call in email one is too much commitment for a cold prospect',
      'No follow-up sequence — most replies come on follow-ups 2 and 3, not the initial send',
      'Generic personalization — {first_name} only, no reference to their company, role, or recent activity',
    ],
    priority: 15,
    is_active: true,
  },
  {
    module_id: 'm4',
    symptom: 'High cold email bounce rate',
    metric_key: 'email_bounce_rate',
    threshold_operator: '>',
    threshold_value: 5,
    diagnostic_questions: [
      'When were the emails on your list last validated through ZeroBounce or BounceBan?',
      'Are you including catch-all email addresses in your sends without individual validation?',
      'How old is the TAM list you are sending from?',
    ],
    common_causes: [
      'Unvalidated email list — sending without running through an email validation service first',
      'Stale TAM data — email addresses decay approximately 30% per year as people change jobs',
      'Catch-all domains included without per-address verification inflating bounce rate',
    ],
    priority: 5,
    is_active: true,
  },

  // ─── M5: LinkedIn Ads ────────────────────────────────────────────────────
  {
    module_id: 'm5',
    symptom: 'High cost per lead on LinkedIn Ads',
    metric_key: 'ads_cpl',
    threshold_operator: '>',
    threshold_value: 150,
    diagnostic_questions: [
      'Are you using LinkedIn Lead Gen Forms or sending traffic to an external landing page?',
      'Have you tested at least 2 different audience segments to identify the most responsive?',
      'Is your daily budget concentrated into your 1–2 best-performing campaigns?',
    ],
    common_causes: [
      'External landing page friction — Lead Gen Forms (pre-filled LinkedIn data) typically cut CPL by 30–50%',
      'Budget spread too thin across too many simultaneous campaigns — algorithm cannot optimize without volume',
      'Audience too competitive or too broad — CPL rises when targeting overlaps with high-bidding advertisers',
    ],
    priority: 20,
    is_active: true,
  },
  {
    module_id: 'm5',
    symptom: 'Low LinkedIn Ads click-through rate',
    metric_key: 'ads_ctr',
    threshold_operator: '<',
    threshold_value: 0.3,
    diagnostic_questions: [
      'Does your ad headline name the specific outcome or result your ICP wants?',
      'Are you running at least 2 creative variations to identify which performs better?',
      'Is your target audience size between 50K and 300K to balance relevance and reach?',
    ],
    common_causes: [
      'Weak headline — generic or benefit-vague copy does not stop the scroll or prompt action',
      'Audience too broad — low relevance between the ad and the viewer drives down CTR',
      'Stock image creative — person photos and authentic visuals outperform generic graphics',
    ],
    priority: 10,
    is_active: true,
  },

  // ─── M6: Operating System ────────────────────────────────────────────────
  {
    module_id: 'm6',
    symptom: 'Low daily GTM session completion',
    metric_key: 'os_daily_sessions',
    threshold_operator: '<',
    threshold_value: 15,
    diagnostic_questions: [
      'Is your daily GTM session the first task of the workday before email or Slack?',
      'Do you have a calendar block protecting this time — is it recurring and treated as non-negotiable?',
      'Is your session scoped to 15 minutes or less, or is it ballooning into an open-ended task?',
    ],
    common_causes: [
      'GTM session not protected by a calendar block — reactive work fills the time instead',
      'Session scope too large — trying to do too much makes it easy to skip when busy',
      'GTM work deprioritized behind client delivery — common in early-stage agency operators',
    ],
    priority: 20,
    is_active: true,
  },

  // ─── M7: Content ─────────────────────────────────────────────────────────
  {
    module_id: 'm7',
    symptom: 'Insufficient content posting frequency',
    metric_key: 'content_posts',
    threshold_operator: '<',
    threshold_value: 3,
    diagnostic_questions: [
      'Do you have a content calendar with posts planned at least one week ahead?',
      "Are you using MagnetLab's content pipeline autopilot to maintain a post buffer?",
      'What is the biggest bottleneck — ideas, writing time, or approval/review?',
    ],
    common_causes: [
      'No content buffer — creating posts day-of makes consistency impossible during busy weeks',
      'All content written from scratch — not repurposing existing expertise, transcripts, or SOPs',
      'Perfectionism — posts sitting in draft awaiting final polish instead of being published',
    ],
    priority: 15,
    is_active: true,
  },
  {
    module_id: 'm7',
    symptom: 'Low content engagement rate',
    metric_key: 'content_engagement',
    threshold_operator: '<',
    threshold_value: 2,
    diagnostic_questions: [
      'Does every post open with a hook that creates a curiosity gap or makes a bold claim?',
      'Are you spending 15 minutes engaging with ICP content before and after publishing?',
      "Are you posting at your audience's peak activity window (typically Tuesday–Thursday, 7–9 AM)?",
    ],
    common_causes: [
      'Weak opening hook — first line is informational instead of curiosity-driving or pattern-interrupting',
      'No engagement strategy — posting and disappearing means the algorithm deprioritizes the post',
      'Content too polished or corporate — personal stories and contrarian takes outperform how-to lists',
      'Posting at low-traffic times — weekend or late-evening posts receive a fraction of weekday morning reach',
    ],
    priority: 20,
    is_active: true,
  },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seedDiagnosticRules(): Promise<void> {
  console.log(
    `Seeding ${RULES.length} diagnostic rules across ${new Set(RULES.map((r) => r.module_id)).size} modules...\n`
  );

  const { error } = await supabase
    .from('diagnostic_rules')
    .upsert(RULES, { onConflict: 'module_id,metric_key' });

  if (error) {
    console.error('ERROR during upsert:', error.message);
    process.exit(1);
  }

  console.log(`Done! ${RULES.length} rules upserted.`);

  // Log summary by module
  const byModule = RULES.reduce<Record<string, number>>((acc, rule) => {
    acc[rule.module_id] = (acc[rule.module_id] ?? 0) + 1;
    return acc;
  }, {});

  console.log('\nRules by module:');
  for (const [moduleId, count] of Object.entries(byModule).sort()) {
    console.log(`  ${moduleId}: ${count} rule${count > 1 ? 's' : ''}`);
  }
}

seedDiagnosticRules().catch((err: unknown) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
