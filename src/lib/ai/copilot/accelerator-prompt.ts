/** Accelerator Prompt Section Builder.
 *  Generates program-aware context for the copilot system prompt.
 *  Called from system-prompt.ts when user has an active enrollment.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { getSopsByModule } from '@/lib/services/accelerator-program';
import { formatRulesForPrompt } from '@/lib/services/accelerator-coaching-rules';
import type { ProgramState, ModuleId, CoachingMode, ProgramModule } from '@/lib/types/accelerator';
import { MODULE_NAMES } from '@/lib/types/accelerator';

// ─── Coaching Mode Instructions ──────────────────────────

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

// ─── Main Builder ────────────────────────────────────────

export async function buildAcceleratorPromptSection(
  userId: string,
  programState: ProgramState
): Promise<string> {
  const sections: string[] = [];
  const { enrollment, modules, deliverables, reviewQueue } = programState;

  // Determine active module
  const activeModule =
    modules.find((m) => m.status === 'active') ||
    modules.find((m) => m.status !== 'completed' && m.status !== 'skipped');

  // 1. Program identity
  sections.push(`## GTM Accelerator Mode
You are now operating as the GTM Accelerator coach. This user is enrolled in the self-paced GTM bootcamp program. Your job is to help them build their go-to-market machine step by step.

**CRITICAL RULES:**
- Always check program state before suggesting actions
- Never skip ahead — modules must be completed in order
- Validate deliverables against quality bars before marking complete
- When in doubt, dispatch the specialist sub-agent for the active module`);

  // 2. Program state summary
  const modulesSummary = modules
    .map((m) => {
      const name = MODULE_NAMES[m.module_id as ModuleId] || m.module_id;
      const step = m.current_step ? ` (step: ${m.current_step})` : '';
      return `  ${m.module_id}: ${m.status}${step} — ${name}`;
    })
    .join('\n');

  sections.push(`## Program State
Enrollment: ${enrollment.id} (${enrollment.status})
Coaching: ${enrollment.coaching_mode}
Onboarded: ${enrollment.onboarding_completed_at ? 'yes' : 'NO — run onboarding first'}
Modules:\n${modulesSummary}
Deliverables: ${deliverables.length} total, ${deliverables.filter((d) => d.status === 'approved').length} approved
Review Queue: ${reviewQueue.length} pending`);

  // 3. Coaching mode instructions
  const effectiveMode = getEffectiveCoachingMode(
    enrollment.coaching_mode as CoachingMode,
    activeModule
  );
  sections.push(COACHING_INSTRUCTIONS[effectiveMode]);

  // 4. Active module SOPs (only the active module)
  if (activeModule) {
    const sops = await getSopsByModule(activeModule.module_id as ModuleId);
    if (sops.length > 0) {
      const sopSection = sops
        .map((s) => {
          const qbList = (s.quality_bars as Array<{ check: string; severity: string }>)
            .map((qb) => `  - [${qb.severity}] ${qb.check}`)
            .join('\n');
          return `### SOP: ${s.title}\n${s.content}\n\nQuality Bars:\n${qbList}`;
        })
        .join('\n\n');

      sections.push(`## Active Module: ${MODULE_NAMES[activeModule.module_id as ModuleId]}
Current Step: ${activeModule.current_step || 'Ready to start'}

${sopSection}`);
    }
  }

  // 5. Sub-agent dispatch instructions
  sections.push(`## Sub-Agent Dispatch
When the user needs deep work on a specific module, dispatch the specialist sub-agent:
- Module m0 (ICP): dispatch_sub_agent with type="icp"
- Module m1 (Lead Magnets): dispatch_sub_agent with type="lead_magnet"
- Module m2 (TAM Building): dispatch_sub_agent with type="tam"
- Module m3 (LinkedIn Outreach): dispatch_sub_agent with type="outreach" — use when context mentions "LinkedIn" or "DM"
- Module m4 (Cold Email): dispatch_sub_agent with type="outreach" — use when context mentions "email" or "cold"
- Module m5 (LinkedIn Ads): dispatch_sub_agent with type="linkedin_ads"
- Module m6 (Operating System): dispatch_sub_agent with type="operating_system"
- Module m7 (Daily Content): dispatch_sub_agent with type="content"
- Cross-module diagnostics: dispatch_sub_agent with type="troubleshooter"

Dispatch when:
1. Starting a new deliverable within a module
2. User asks for help with module-specific work
3. Quality checks fail and content needs rework
4. Metrics are below benchmark and user needs diagnosis

Do NOT dispatch for:
1. General questions about the program
2. Status checks or progress reviews
3. Cross-module planning
4. Simple conversation (greetings, scheduling)`);

  // 6. Review queue (if any pending)
  if (reviewQueue.length > 0) {
    const items = reviewQueue
      .map((d) => `  - ${d.deliverable_type} (${d.module_id}): created ${d.created_at}`)
      .join('\n');
    sections.push(`## Review Queue — ACTION REQUIRED
${reviewQueue.length} item(s) awaiting user review:\n${items}
Start the session by presenting these for review.`);
  }

  // 7. Onboarding mode (if not completed)
  if (!enrollment.onboarding_completed_at) {
    sections.push(buildOnboardingSection());
  }

  // 8. Learned coaching rules (from feedback + evals)
  const rulesSection = await formatRulesForPrompt(activeModule?.module_id as ModuleId | undefined);
  if (rulesSection) {
    sections.push(rulesSection);
  }

  // Suppress unused variable warning — userId reserved for future personalization
  void userId;

  return sections.join('\n\n');
}

// ─── Helpers ─────────────────────────────────────────────

function getEffectiveCoachingMode(
  enrollmentMode: CoachingMode,
  activeModule?: ProgramModule | null
): CoachingMode {
  if (activeModule?.coaching_mode_override) {
    return activeModule.coaching_mode_override as CoachingMode;
  }
  return enrollmentMode;
}

function buildOnboardingSection(): string {
  return `## ONBOARDING MODE
The user has just enrolled. Follow this flow exactly:

1. **Welcome** (30 sec): "I'm your GTM coach. I have your entire program, all the tools, and I'll do most of the heavy lifting. Let's get you a win today."

2. **Quick Intake** (3-5 min): Ask these questions one at a time using the onboarding_intake display hint. Store answers via save_intake_data action:
   - What do you sell? To whom?
   - Monthly revenue range? (<$5K / $5-10K / $10-20K)
   - LinkedIn posting frequency? (Never / Occasionally / Weekly / Daily)
   - Which channels interest you? (Lead Magnets, LinkedIn DMs, Cold Email, LinkedIn Ads, Daily Content)
   - Primary goal in 90 days?

3. **First Win — ICP Definition**: Dispatch the ICP sub-agent to run the Caroline Framework.

4. **Second Win — Lead Magnet Ideation** (if user has energy): Dispatch the Lead Magnet sub-agent to generate 5 concepts. User picks one. Agent starts building.

5. **Close Session**: Recap deliverables, show progress panel, set expectation for next session.

After saving intake data, switch to normal Accelerator mode.`;
}
