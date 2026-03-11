/** Sub-Agent Config Builder.
 *  Assembles SubAgentConfig for each specialist type.
 *  Loads SOPs, user context, and agent-specific prompts. */

import type { SubAgentConfig } from '../sub-agent-dispatch';
import type { SubAgentType, ModuleId, CoachingMode } from '@/lib/types/accelerator';
import { getToolDefinitions } from '@/lib/actions';
import { getSopsByModule, getEnrollmentByUserId } from '@/lib/services/accelerator-program';
import { buildIcpAgentPrompt } from './icp-agent';
import { buildLeadMagnetAgentPrompt } from './lead-magnet-agent';
import { buildContentAgentPrompt } from './content-agent';
import { buildTamAgentPrompt } from './tam-agent';
import { buildOutreachAgentPrompt } from './outreach-agent';

// ─── Agent → Module Mapping ──────────────────────────────

const AGENT_MODULE_MAP: Record<SubAgentType, ModuleId> = {
  icp: 'm0',
  lead_magnet: 'm1',
  content: 'm7',
  tam: 'm2',
  outreach: 'm3', // Covers M3 (LinkedIn) + M4 (Cold Email)
  troubleshooter: 'm0', // Troubleshooter is cross-module, default to m0
};

// ─── Config Builder ──────────────────────────────────────

export async function buildSubAgentConfig(
  agentType: SubAgentType,
  context: string,
  userMessage: string,
  userId: string
): Promise<SubAgentConfig> {
  const moduleId = AGENT_MODULE_MAP[agentType];
  const sops = await getSopsByModule(moduleId);
  const enrollment = await getEnrollmentByUserId(userId);

  const userContext = {
    intake_data: enrollment?.intake_data || null,
    coaching_mode: (enrollment?.coaching_mode || 'guide_me') as CoachingMode,
    has_brain_content: false, // TODO: Check AI Brain content in Phase 2
  };

  const sopData = sops.map((s) => ({
    title: s.title,
    content: s.content,
    quality_bars: s.quality_bars as unknown[],
  }));

  let systemPrompt: string;

  switch (agentType) {
    case 'icp':
      systemPrompt = buildIcpAgentPrompt(sopData, userContext);
      break;
    case 'lead_magnet':
      systemPrompt = buildLeadMagnetAgentPrompt(sopData, userContext);
      break;
    case 'content':
      systemPrompt = buildContentAgentPrompt(sopData, userContext);
      break;
    case 'tam':
      systemPrompt = buildTamAgentPrompt(sopData, userContext);
      break;
    case 'outreach': {
      const focus =
        context.toLowerCase().includes('email') || context.toLowerCase().includes('cold')
          ? ('email' as const)
          : ('linkedin' as const);
      if (focus === 'email') {
        const m4Sops = await getSopsByModule('m4');
        const m4SopData = m4Sops.map((s) => ({
          title: s.title,
          content: s.content,
          quality_bars: s.quality_bars as unknown[],
        }));
        sopData.push(...m4SopData);
      }
      systemPrompt = buildOutreachAgentPrompt(sopData, userContext, focus);
      break;
    }
    case 'troubleshooter':
      // Stub for Phase 3
      systemPrompt = `You are the Troubleshooter agent. Help diagnose issues with: ${context}`;
      break;
    default:
      systemPrompt = `You are a GTM specialist. Help with: ${context}`;
  }

  // Filter tools to only those relevant to the agent's module
  const allTools = getToolDefinitions();
  const relevantToolNames = [
    'get_program_state',
    'get_module_sops',
    'create_deliverable',
    'validate_deliverable',
    'update_module_progress',
    'save_intake_data',
    'list_providers',
    'check_provider_status',
    'configure_provider',
    'get_guided_steps',
  ];
  const filteredTools = allTools.filter((t) => relevantToolNames.includes(t.name));

  return {
    type: agentType,
    systemPrompt,
    tools: filteredTools,
    contextSummary: context,
    userMessage,
  };
}
