/** Diagnostic Rules Seed Script.
 *  Seeds the diagnostic_rules table with initial rules derived from SOPs.
 *  Run: npx tsx scripts/seed-diagnostic-rules.ts */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const RULES = [
  // ─── M4: Cold Email ──────────────────────────────────
  {
    symptom: 'Low email open rate',
    module_id: 'm4',
    metric_key: 'email_open_rate',
    threshold_operator: '<',
    threshold_value: 20,
    diagnostic_questions: [
      'Are your subject lines personalized with first name + pain point?',
      'What is your daily sending volume per account?',
      'Are you sending to validated emails only?',
    ],
    common_causes: [
      {
        cause: 'Generic subject lines',
        fix: 'Use {first_name} + specific pain point in every subject line',
        severity: 'critical',
      },
      {
        cause: 'Sending too fast',
        fix: 'Reduce to 30 emails/day/account and ensure 2-week warmup',
        severity: 'critical',
      },
      {
        cause: 'Poor list quality',
        fix: 'Re-validate emails through ZeroBounce, remove catch-all',
        severity: 'warning',
      },
    ],
    priority: 10,
  },
  {
    symptom: 'High email bounce rate',
    module_id: 'm4',
    metric_key: 'email_bounce_rate',
    threshold_operator: '>',
    threshold_value: 5,
    diagnostic_questions: [
      'When was your email list last validated?',
      'Are you using catch-all emails?',
      'How old is your TAM list?',
    ],
    common_causes: [
      {
        cause: 'Unvalidated emails',
        fix: 'Run all emails through ZeroBounce or BounceBan before sending',
        severity: 'critical',
      },
      {
        cause: 'Stale list',
        fix: 'Re-enrich TAM list — email addresses decay ~30% per year',
        severity: 'warning',
      },
    ],
    priority: 5,
  },
  {
    symptom: 'Low email reply rate',
    module_id: 'm4',
    metric_key: 'email_reply_rate',
    threshold_operator: '<',
    threshold_value: 2,
    diagnostic_questions: [
      'Does your email lead with their problem, not your solution?',
      'Is your CTA a simple yes/no question?',
      'Are you following up at least 3 times?',
    ],
    common_causes: [
      {
        cause: 'Feature-focused copy',
        fix: 'Rewrite opening to lead with prospect pain point from ICP research',
        severity: 'critical',
      },
      {
        cause: 'Weak CTA',
        fix: 'End with simple binary question: "Would it be worth a 15-min call to explore?"',
        severity: 'warning',
      },
      {
        cause: 'No follow-ups',
        fix: 'Add 3-4 follow-up emails spaced 3-5 days apart',
        severity: 'warning',
      },
    ],
    priority: 15,
  },

  // ─── M3: LinkedIn DMs ────────────────────────────────
  {
    symptom: 'Low DM acceptance rate',
    module_id: 'm3',
    metric_key: 'dm_acceptance_rate',
    threshold_operator: '<',
    threshold_value: 25,
    diagnostic_questions: [
      'Is your LinkedIn profile optimized with a clear headline?',
      'Are connection requests personalized?',
      'Are you targeting people who match your ICP?',
    ],
    common_causes: [
      {
        cause: 'Weak profile',
        fix: 'Update headline to "I help [ICP] achieve [outcome]" format',
        severity: 'critical',
      },
      {
        cause: 'Generic connection requests',
        fix: 'Reference something specific — mutual connection, recent post, company news',
        severity: 'warning',
      },
      {
        cause: 'Wrong audience',
        fix: 'Review ICP definition and tighten Sales Navigator filters',
        severity: 'warning',
      },
    ],
    priority: 10,
  },
  {
    symptom: 'Low DM reply rate',
    module_id: 'm3',
    metric_key: 'dm_reply_rate',
    threshold_operator: '<',
    threshold_value: 8,
    diagnostic_questions: [
      'Are you leading with value or a pitch?',
      'How long is your first message after connection?',
      'Are you engaging with their content before DM-ing?',
    ],
    common_causes: [
      {
        cause: 'Pitching too soon',
        fix: 'First message should offer value — share a relevant insight or resource',
        severity: 'critical',
      },
      {
        cause: 'Messages too long',
        fix: 'Keep first DM under 3 sentences. Ask one question.',
        severity: 'warning',
      },
    ],
    priority: 15,
  },

  // ─── M2: TAM ─────────────────────────────────────────
  {
    symptom: 'Low TAM email coverage',
    module_id: 'm2',
    metric_key: 'tam_email_coverage',
    threshold_operator: '<',
    threshold_value: 30,
    diagnostic_questions: [
      'Did you run the full enrichment waterfall (LeadMagic → Prospeo → BlitzAPI)?',
      'Are you including catch-all emails?',
    ],
    common_causes: [
      {
        cause: 'Incomplete enrichment',
        fix: 'Run all 3 enrichment providers in waterfall order',
        severity: 'critical',
      },
      {
        cause: 'Filtering too aggressively',
        fix: 'Include catch-all emails for cold outreach (validate individually)',
        severity: 'info',
      },
    ],
    priority: 20,
  },

  // ─── M7: Content ─────────────────────────────────────
  {
    symptom: 'Low content engagement',
    module_id: 'm7',
    metric_key: 'content_avg_engagement',
    threshold_operator: '<',
    threshold_value: 2,
    diagnostic_questions: [
      'Are you posting at least 3x per week?',
      'Are your hooks stopping the scroll?',
      "Are you engaging with others' posts before and after publishing?",
    ],
    common_causes: [
      {
        cause: 'Low posting frequency',
        fix: 'Increase to 4-5 posts/week. Use content pipeline autopilot.',
        severity: 'warning',
      },
      {
        cause: 'Weak hooks',
        fix: 'First line must create curiosity gap or state a bold claim',
        severity: 'critical',
      },
      {
        cause: 'No engagement strategy',
        fix: 'Spend 15 min engaging with ICP posts before and after publishing',
        severity: 'warning',
      },
    ],
    priority: 20,
  },

  // ─── M1: Funnel ──────────────────────────────────────
  {
    symptom: 'Low funnel opt-in rate',
    module_id: 'm1',
    metric_key: 'funnel_opt_in_rate',
    threshold_operator: '<',
    threshold_value: 15,
    diagnostic_questions: [
      'Does your lead magnet title promise a specific outcome?',
      'Is the opt-in form above the fold?',
      'Are you using social proof?',
    ],
    common_causes: [
      {
        cause: 'Vague value proposition',
        fix: 'Lead magnet title should promise specific, measurable outcome',
        severity: 'critical',
      },
      {
        cause: 'Too many form fields',
        fix: 'Reduce to email only (add name if needed for personalization)',
        severity: 'warning',
      },
    ],
    priority: 15,
  },
];

async function seedRules() {
  console.log('Seeding diagnostic rules...\n');

  for (const rule of RULES) {
    const { data: existing } = await supabase
      .from('diagnostic_rules')
      .select('id')
      .eq('symptom', rule.symptom)
      .eq('module_id', rule.module_id)
      .single();

    if (existing) {
      const { error } = await supabase.from('diagnostic_rules').update(rule).eq('id', existing.id);

      if (error) console.error(`  ERROR updating "${rule.symptom}": ${error.message}`);
      else console.log(`  Updated: ${rule.symptom}`);
    } else {
      const { error } = await supabase.from('diagnostic_rules').insert(rule);

      if (error) console.error(`  ERROR inserting "${rule.symptom}": ${error.message}`);
      else console.log(`  Inserted: ${rule.symptom}`);
    }
  }

  console.log(`\nDone! ${RULES.length} rules processed.`);
}

seedRules().catch(console.error);
