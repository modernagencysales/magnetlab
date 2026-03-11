/** Seed M5/M6 Diagnostic Rules.
 *  Run: npx tsx scripts/seed-diagnostic-rules-m5m6.ts */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface DiagnosticRuleSeed {
  symptom: string;
  module_id: string;
  metric_key: string | null;
  threshold_operator: string | null;
  threshold_value: number | null;
  diagnostic_questions: string[];
  common_causes: Array<{ cause: string; fix: string; severity: string }>;
  priority: number;
}

const M5_RULES: DiagnosticRuleSeed[] = [
  {
    symptom: 'LinkedIn Ads CTR below 0.3%',
    module_id: 'm5',
    metric_key: 'ads_ctr',
    threshold_operator: '<',
    threshold_value: 0.3,
    diagnostic_questions: [
      'What ad format are you using (single image, carousel, video)?',
      'Does your headline clearly state the value proposition?',
      'Is your audience size between 50K-300K?',
      'Are you running at least 2 ad variations?',
    ],
    common_causes: [
      {
        cause: 'Weak headline — not specific enough',
        fix: 'Rewrite headline with concrete outcome or number',
        severity: 'critical',
      },
      {
        cause: 'Audience too broad',
        fix: 'Narrow targeting: add job title + seniority + industry filters',
        severity: 'critical',
      },
      {
        cause: 'Generic creative',
        fix: 'Use person photo instead of stock image, add social proof',
        severity: 'warning',
      },
    ],
    priority: 10,
  },
  {
    symptom: 'LinkedIn Ads CPL above $150',
    module_id: 'm5',
    metric_key: 'ads_cpl',
    threshold_operator: '>',
    threshold_value: 150,
    diagnostic_questions: [
      'What is your current daily budget per campaign?',
      'Are you using Lead Gen Forms or sending to a landing page?',
      'How many campaigns are running simultaneously?',
      'Have you tested different audiences?',
    ],
    common_causes: [
      {
        cause: 'Landing page friction',
        fix: 'Switch to LinkedIn Lead Gen Forms (pre-filled data = higher conversion)',
        severity: 'critical',
      },
      {
        cause: 'Audience too competitive',
        fix: 'Test smaller niche audiences or lookalike audiences',
        severity: 'warning',
      },
      {
        cause: 'Budget spread too thin',
        fix: 'Consolidate budget into 1-2 best-performing campaigns',
        severity: 'warning',
      },
    ],
    priority: 20,
  },
  {
    symptom: 'LinkedIn Ads ROAS below 1x',
    module_id: 'm5',
    metric_key: 'ads_roas',
    threshold_operator: '<',
    threshold_value: 1,
    diagnostic_questions: [
      'What is your average deal value?',
      'What is your current close rate from ad-generated leads?',
      'Are you following up with ad leads within 24 hours?',
      'Do you have a nurture sequence for ad leads?',
    ],
    common_causes: [
      {
        cause: 'No follow-up sequence',
        fix: 'Set up immediate email + LinkedIn DM follow-up for every ad lead',
        severity: 'critical',
      },
      {
        cause: 'Wrong offer for cold traffic',
        fix: 'Use lead magnet (free value) instead of direct sales pitch',
        severity: 'critical',
      },
      {
        cause: 'Slow follow-up',
        fix: 'Set up instant notification + response template for new leads',
        severity: 'warning',
      },
    ],
    priority: 15,
  },
];

const M6_RULES: DiagnosticRuleSeed[] = [
  {
    symptom: 'Weekly reviews not happening consistently',
    module_id: 'm6',
    metric_key: 'os_weekly_reviews',
    threshold_operator: '<',
    threshold_value: 3,
    diagnostic_questions: [
      'Do you have a recurring calendar block for weekly reviews?',
      'What usually causes you to skip the review?',
      'Do you have a review template/checklist ready?',
      'Is anyone else involved in the review (accountability partner)?',
    ],
    common_causes: [
      {
        cause: 'No calendar block',
        fix: 'Block 60 min every Friday 2-3pm — non-negotiable, treat like a client meeting',
        severity: 'critical',
      },
      {
        cause: 'Review feels overwhelming',
        fix: 'Use the 5-number scorecard: just track 5 metrics, nothing else',
        severity: 'warning',
      },
      {
        cause: 'No accountability',
        fix: 'Share weekly scorecard with a peer or post in community',
        severity: 'info',
      },
    ],
    priority: 10,
  },
  {
    symptom: 'Daily GTM sessions below 15 per month',
    module_id: 'm6',
    metric_key: 'os_daily_sessions',
    threshold_operator: '<',
    threshold_value: 15,
    diagnostic_questions: [
      'Do you have a morning GTM routine scheduled?',
      'What time do you typically start your GTM work?',
      'Is your GTM session the FIRST thing you do or after other work?',
      'How long is your typical daily GTM session?',
    ],
    common_causes: [
      {
        cause: 'GTM not first priority',
        fix: 'Move GTM to first 30 min of workday — before email, before Slack',
        severity: 'critical',
      },
      {
        cause: 'Session too long/ambitious',
        fix: 'Shorten to 15 min: check replies (5), send outreach (5), post content (5)',
        severity: 'warning',
      },
      {
        cause: 'No tracking system',
        fix: 'Use a simple daily checkbox — just mark done/not done',
        severity: 'info',
      },
    ],
    priority: 20,
  },
];

async function seedRules() {
  console.log('Seeding M5/M6 diagnostic rules...\n');
  const allRules = [...M5_RULES, ...M6_RULES];
  let inserted = 0;

  for (const rule of allRules) {
    // Check if rule already exists (by symptom + module_id)
    const { data: existing } = await supabase
      .from('diagnostic_rules')
      .select('id')
      .eq('symptom', rule.symptom)
      .eq('module_id', rule.module_id)
      .single();

    if (existing) {
      console.log(`  Skipping (exists): ${rule.symptom}`);
      continue;
    }

    const { error } = await supabase.from('diagnostic_rules').insert(rule);
    if (error) {
      console.error(`  ERROR: ${rule.symptom} — ${error.message}`);
    } else {
      console.log(`  Inserted: ${rule.symptom}`);
      inserted++;
    }
  }

  console.log(`\nDone! ${inserted} rules inserted.`);
}

seedRules().catch(console.error);
