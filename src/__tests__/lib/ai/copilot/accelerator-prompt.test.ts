/**
 * @jest-environment node
 */
import { buildAcceleratorPromptSection } from '@/lib/ai/copilot/accelerator-prompt';
import type { ProgramState, CoachingMode } from '@/lib/types/accelerator';

// Mock service
jest.mock('@/lib/services/accelerator-program', () => ({
  getSopsByModule: jest.fn().mockResolvedValue([
    {
      title: 'Define Your Caroline',
      content: 'Name your best client...',
      quality_bars: [{ check: 'Names a specific person', severity: 'critical' }],
    },
  ]),
}));

const baseProgramState: ProgramState = {
  enrollment: {
    id: 'e1',
    user_id: 'u1',
    enrolled_at: '2026-03-11T00:00:00Z',
    selected_modules: ['m0', 'm1', 'm7'],
    coaching_mode: 'guide_me' as CoachingMode,
    onboarding_completed_at: '2026-03-11T01:00:00Z',
    intake_data: null,
    stripe_subscription_id: null,
    stripe_customer_id: null,
    status: 'active',
    created_at: '2026-03-11T00:00:00Z',
    updated_at: '2026-03-11T00:00:00Z',
  },
  modules: [
    {
      id: 'mod1',
      enrollment_id: 'e1',
      module_id: 'm0',
      status: 'active',
      current_step: 'caroline-framework',
      coaching_mode_override: null,
      started_at: '2026-03-11',
      completed_at: null,
      created_at: '',
      updated_at: '',
    },
    {
      id: 'mod2',
      enrollment_id: 'e1',
      module_id: 'm1',
      status: 'not_started',
      current_step: null,
      coaching_mode_override: null,
      started_at: null,
      completed_at: null,
      created_at: '',
      updated_at: '',
    },
  ],
  deliverables: [],
  reviewQueue: [],
  usageThisPeriod: { sessions: 1, deliverables: 0, api_calls: 5 },
};

describe('buildAcceleratorPromptSection', () => {
  it('includes coaching mode instructions', async () => {
    const result = await buildAcceleratorPromptSection('u1', baseProgramState);
    expect(result).toContain('GUIDE ME');
    expect(result).toContain('heavy lifting');
  });

  it('includes program state summary', async () => {
    const result = await buildAcceleratorPromptSection('u1', baseProgramState);
    expect(result).toContain('m0: active');
    expect(result).toContain('Positioning & ICP');
  });

  it('includes SOPs for active module', async () => {
    const result = await buildAcceleratorPromptSection('u1', baseProgramState);
    expect(result).toContain('Define Your Caroline');
    expect(result).toContain('Names a specific person');
  });

  it('includes sub-agent dispatch instructions', async () => {
    const result = await buildAcceleratorPromptSection('u1', baseProgramState);
    expect(result).toContain('dispatch_sub_agent');
    expect(result).toContain('type="icp"');
  });

  it('includes onboarding when not completed', async () => {
    const notOnboarded = {
      ...baseProgramState,
      enrollment: { ...baseProgramState.enrollment, onboarding_completed_at: null },
    };
    const result = await buildAcceleratorPromptSection('u1', notOnboarded);
    expect(result).toContain('ONBOARDING MODE');
    expect(result).toContain('save_intake_data');
  });

  it('excludes onboarding when completed', async () => {
    const result = await buildAcceleratorPromptSection('u1', baseProgramState);
    expect(result).not.toContain('ONBOARDING MODE');
  });

  it('includes review queue items when present', async () => {
    const withReview = {
      ...baseProgramState,
      reviewQueue: [
        {
          id: 'r1',
          enrollment_id: 'e1',
          module_id: 'm0',
          deliverable_type: 'icp_definition',
          status: 'pending_review',
          entity_id: null,
          entity_type: null,
          validation_result: null,
          validated_at: null,
          created_at: '2026-03-11',
          updated_at: '2026-03-11',
        },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildAcceleratorPromptSection('u1', withReview as any);
    expect(result).toContain('ACTION REQUIRED');
    expect(result).toContain('icp_definition');
  });
});
