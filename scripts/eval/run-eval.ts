#!/usr/bin/env npx tsx
/** Accelerator AI Eval Runner.
 *  Runs coaching scenarios through the actual AI pipeline, judges quality.
 *  Usage: npx tsx scripts/eval/run-eval.ts [--scenario=id] [--category=coaching]
 *
 *  Requires ANTHROPIC_API_KEY in .env.local or environment. */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { EVAL_SCENARIOS } from './scenarios';
import type { EvalScenario, MockProgramState } from './scenarios';
import { judgeResponse } from './judge';
import type { JudgeResult } from './judge';
import { MODULE_NAMES } from '../../src/lib/types/accelerator';
import type { ModuleId, CoachingMode } from '../../src/lib/types/accelerator';

// ─── Config ──────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-20250514';

// ─── Mock System Prompt Builder ──────────────────────────
// Simplified version of buildAcceleratorPromptSection that works without DB

const COACHING_INSTRUCTIONS: Record<CoachingMode, string> = {
  do_it: `## Coaching Mode: DO IT
Execute tasks quickly and present results for approval. Minimize explanation.
When you have enough context, just build it. Show the result, ask "Good to go?"`,
  guide_me: `## Coaching Mode: GUIDE ME
Do the heavy lifting but explain key decisions. Ask for input at decision points.
"Here's what I'm thinking... does this match your situation?"`,
  teach_me: `## Coaching Mode: TEACH ME
Walk through each step. Explain the why behind every decision. Let the user drive.
"The reason we do this is... what do you think makes sense for your case?"`,
};

async function loadCoachingRules(moduleId?: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return '';

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from('program_coaching_rules')
    .select('rule, category, severity, module_id')
    .eq('active', true)
    .order('severity')
    .order('created_at', { ascending: false });

  if (error || !data?.length) return '';

  // Filter to global rules + module-specific rules
  const applicable = data.filter(
    (r: { module_id: string | null }) => !r.module_id || r.module_id === moduleId
  );
  if (applicable.length === 0) return '';

  const critical = applicable.filter((r: { severity: string }) => r.severity === 'critical');
  const important = applicable.filter((r: { severity: string }) => r.severity === 'important');
  const suggestions = applicable.filter((r: { severity: string }) => r.severity === 'suggestion');

  const sections: string[] = [
    '## Learned Coaching Rules\nThese rules were learned from feedback and quality evaluations. Follow them strictly.',
  ];
  if (critical.length > 0) {
    sections.push('**CRITICAL (must follow):**');
    critical.forEach((r: { rule: string }) => sections.push(`- ${r.rule}`));
  }
  if (important.length > 0) {
    sections.push('**Important:**');
    important.forEach((r: { rule: string }) => sections.push(`- ${r.rule}`));
  }
  if (suggestions.length > 0) {
    sections.push('**Suggestions:**');
    suggestions.forEach((r: { rule: string }) => sections.push(`- ${r.rule}`));
  }
  return sections.join('\n');
}

function buildMockSystemPrompt(state: MockProgramState, rulesSection: string): string {
  const sections: string[] = [];

  sections.push(`## GTM Accelerator Mode
You are now operating as the GTM Accelerator coach. This user is enrolled in the self-paced GTM bootcamp program. Your job is to help them build their go-to-market machine step by step.

**CRITICAL RULES:**
- Always check program state before suggesting actions
- Never skip ahead — modules must be completed in order
- Validate deliverables against quality bars before marking complete
- When in doubt, dispatch the specialist sub-agent for the active module`);

  const moduleName = MODULE_NAMES[state.activeModule];
  sections.push(`## Program State
Enrollment: eval-enrollment (active)
Coaching: ${state.coachingMode}
Onboarded: ${state.onboardingCompleted ? 'yes' : 'NO — run onboarding first'}
Active Module: ${state.activeModule} — ${moduleName} (${state.activeModuleStatus})
Current Step: ${state.currentStep || 'Ready to start'}
Deliverables: ${state.deliverablesCount} total
Review Queue: ${state.reviewQueueCount} pending`);

  if (state.intakeData) {
    sections.push(`## User Profile (from intake)
${Object.entries(state.intakeData)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}`);
  }

  sections.push(COACHING_INSTRUCTIONS[state.coachingMode]);

  if (state.reviewQueueCount > 0) {
    sections.push(`## Review Queue — ACTION REQUIRED
${state.reviewQueueCount} item(s) awaiting user review.
Start the session by presenting these for review.`);
  }

  if (!state.onboardingCompleted) {
    sections.push(`## ONBOARDING MODE
The user has just enrolled. Follow this flow exactly:

1. **Welcome** (30 sec): "I'm your GTM coach. I have your entire program, all the tools, and I'll do most of the heavy lifting. Let's get you a win today."

2. **Quick Intake** (3-5 min): Ask these questions one at a time:
   - What do you sell? To whom?
   - Monthly revenue range? (<$5K / $5-10K / $10-20K)
   - LinkedIn posting frequency? (Never / Occasionally / Weekly / Daily)
   - Which channels interest you? (Lead Magnets, LinkedIn DMs, Cold Email, LinkedIn Ads, Daily Content)
   - Primary goal in 90 days?

3. **First Win — ICP Definition**: Run the Caroline Framework for ICP definition.

4. **Second Win — Lead Magnet Ideation**: Generate 5 concepts. User picks one.

5. **Close Session**: Recap deliverables, show progress, set expectation for next session.`);
  }

  if (rulesSection) {
    sections.push(rulesSection);
  }

  return sections.join('\n\n');
}

// ─── Runner ──────────────────────────────────────────────

async function runScenario(
  client: Anthropic,
  scenario: EvalScenario,
  rulesSection: string
): Promise<{ response: string; inputTokens: number; outputTokens: number }> {
  const systemPrompt = buildMockSystemPrompt(scenario.programState, rulesSection);

  const result = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: scenario.userMessage }],
  });

  const response = result.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return {
    response,
    inputTokens: result.usage.input_tokens,
    outputTokens: result.usage.output_tokens,
  };
}

// ─── Reporting ───────────────────────────────────────────

function printReport(results: JudgeResult[], totalTokens: { input: number; output: number }) {
  console.log('\n' + '═'.repeat(70));
  console.log('  GTM ACCELERATOR AI QUALITY EVAL');
  console.log('═'.repeat(70));
  console.log(`  Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`  Model: ${MODEL}`);
  console.log(`  Scenarios: ${results.length}`);
  console.log(
    `  Tokens: ${totalTokens.input.toLocaleString()} in / ${totalTokens.output.toLocaleString()} out`
  );
  console.log('─'.repeat(70));

  // Per-scenario results
  for (const r of results) {
    const statusIcon = r.weightedScore >= 70 ? 'PASS' : r.weightedScore >= 50 ? 'WARN' : 'FAIL';
    console.log(`\n  [${statusIcon}] ${r.scenarioName} (${r.scenarioId})`);
    console.log(`        Weighted: ${r.weightedScore}/100  |  Raw: ${r.overallScore}/100`);

    if (!r.mustIncludePass) console.log(`        !! FAILED must-include checks`);
    if (!r.mustNotIncludePass) console.log(`        !! FAILED must-not-include checks`);

    // Show criteria
    for (const c of r.criteria) {
      const bar = '█'.repeat(Math.round(c.score / 2)) + '░'.repeat(5 - Math.round(c.score / 2));
      const scoreColor = c.score >= 7 ? '' : c.score >= 5 ? '' : ' !!';
      console.log(`        ${bar} ${c.score}/10 ${c.criterion}${scoreColor}`);
      if (c.score < 7) {
        console.log(`              → ${c.reasoning}`);
      }
    }

    if (r.judgeNotes) {
      console.log(`        Notes: ${r.judgeNotes.substring(0, 120)}...`);
    }
  }

  // Summary
  console.log('\n' + '─'.repeat(70));
  const avgWeighted = Math.round(results.reduce((s, r) => s + r.weightedScore, 0) / results.length);
  const avgRaw = Math.round(results.reduce((s, r) => s + r.overallScore, 0) / results.length);
  const passCount = results.filter((r) => r.weightedScore >= 70).length;
  const failCount = results.filter((r) => r.weightedScore < 50).length;

  console.log(`  SUMMARY`);
  console.log(`  Average Weighted Score: ${avgWeighted}/100`);
  console.log(`  Average Raw Score:      ${avgRaw}/100`);
  console.log(`  Pass (>=70): ${passCount}/${results.length}`);
  console.log(`  Fail (<50):  ${failCount}/${results.length}`);

  // Category breakdown
  const categories = [
    ...new Set(
      results.map((r) => {
        const scenario = EVAL_SCENARIOS.find((s) => s.id === r.scenarioId);
        return scenario?.category || 'unknown';
      })
    ),
  ];

  console.log('\n  By Category:');
  for (const cat of categories) {
    const catResults = results.filter((r) => {
      const scenario = EVAL_SCENARIOS.find((s) => s.id === r.scenarioId);
      return scenario?.category === cat;
    });
    const catAvg = Math.round(
      catResults.reduce((s, r) => s + r.weightedScore, 0) / catResults.length
    );
    console.log(`    ${cat.padEnd(16)} ${catAvg}/100 (${catResults.length} scenarios)`);
  }

  console.log('\n' + '═'.repeat(70));

  // Save results to JSON
  return { avgWeighted, avgRaw, passCount, failCount };
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set. Add it to .env.local or set in environment.');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  // Parse args
  const args = process.argv.slice(2);
  const scenarioFilter = args.find((a) => a.startsWith('--scenario='))?.split('=')[1];
  const categoryFilter = args.find((a) => a.startsWith('--category='))?.split('=')[1];

  let scenarios = EVAL_SCENARIOS;
  if (scenarioFilter) {
    scenarios = scenarios.filter((s) => s.id === scenarioFilter);
  }
  if (categoryFilter) {
    scenarios = scenarios.filter((s) => s.category === categoryFilter);
  }

  if (scenarios.length === 0) {
    console.error('No scenarios matched filters.');
    process.exit(1);
  }

  // Load coaching rules from DB (applied to all scenarios)
  const rulesSection = await loadCoachingRules();
  const rulesCount = rulesSection ? (rulesSection.match(/^- /gm) || []).length : 0;
  console.log(`Loaded ${rulesCount} coaching rules from database.`);
  console.log(`Running ${scenarios.length} eval scenario(s)...\n`);

  const results: JudgeResult[] = [];
  const totalTokens = { input: 0, output: 0 };

  for (const scenario of scenarios) {
    process.stdout.write(`  Running: ${scenario.name}...`);

    try {
      // Get AI response
      // Load module-specific rules for this scenario
      const moduleRules = await loadCoachingRules(scenario.programState.activeModule);
      const { response, inputTokens, outputTokens } = await runScenario(
        client,
        scenario,
        moduleRules
      );
      totalTokens.input += inputTokens;
      totalTokens.output += outputTokens;

      // Judge the response
      const judgeResult = await judgeResponse(client, scenario, response);
      results.push(judgeResult);

      const icon =
        judgeResult.weightedScore >= 70
          ? 'PASS'
          : judgeResult.weightedScore >= 50
            ? 'WARN'
            : 'FAIL';
      process.stdout.write(` ${icon} (${judgeResult.weightedScore}/100)\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(` ERROR: ${msg}\n`);
    }
  }

  const summary = printReport(results, totalTokens);

  // Save raw results to file for tracking over time
  const fs = await import('fs');
  const resultsDir = 'scripts/eval/results';
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = `${resultsDir}/eval-${timestamp}.json`;
  fs.writeFileSync(
    resultsFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        model: MODEL,
        summary,
        results,
        totalTokens,
      },
      null,
      2
    )
  );
  console.log(`\nResults saved to ${resultsFile}`);
}

main().catch((err) => {
  console.error('Eval failed:', err);
  process.exit(1);
});
